// Servidor web de la Tienda de Café de Origen.
// Express sirve las páginas (plantillas EJS) y guarda los datos en MySQL.
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const { pool, esperarBaseDeDatos } = require('./db');
const { validarProducto, validarCategoria } = require('./validacion');

const app = express();
const PUERTO = Number(process.env.PORT || 3000);
const META_REGISTROS = 15; // la actividad pide ingresar 15 datos
const VERSION = process.env.APP_VERSION || '1.0'; // se fija al construir la imagen

// Dónde corre la aplicación. Kubernetes inyecta KUBERNETES_SERVICE_HOST en
// todos los pods; Docker crea /.dockerenv, pero containerd (el motor de los
// nodos de AKS) no lo crea, así que reviso primero Kubernetes.
const ENTORNO = process.env.KUBERNETES_SERVICE_HOST
  ? 'kubernetes'
  : fs.existsSync('/.dockerenv') ? 'docker' : 'local';

// Datos del pod que entrega la Downward API (ver k8s/web.yaml)
const POD = {
  nombre: process.env.POD_NAME || os.hostname(),
  namespace: process.env.POD_NAMESPACE || 'default',
  nodo: process.env.NODE_NAME || 'desconocido',
  ip: process.env.POD_IP || 'desconocida'
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.disable('x-powered-by');

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

// Variables disponibles en todas las vistas
const formatoPesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const ZONA = process.env.TZ || 'America/Bogota';
const formatoISO = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA }); // sv-SE produce AAAA-MM-DD

app.use((req, res, next) => {
  res.locals.ruta = req.path;
  res.locals.contenedor = os.hostname(); // en Docker es el ID corto del contenedor; en Kubernetes, el nombre del pod
  res.locals.entorno = ENTORNO;
  res.locals.pod = POD;
  res.locals.version = VERSION;
  res.locals.pesos = (v) => formatoPesos.format(Number(v));
  res.locals.fecha = (v) => (v ? formatoFecha.format(new Date(`${String(v).slice(0, 10)}T00:00:00Z`)) : '');
  res.locals.fechaHora = (v) => {
    if (!v) return '';
    const [d, h] = String(v).split(' ');
    return `${res.locals.fecha(d)}, ${(h || '').slice(0, 5)}`;
  };
  res.locals.hoy = formatoISO.format(new Date());
  next();
});

// Envuelve rutas async para que los errores lleguen al manejador central
const asincrono = (fn) => (req, res, next) => fn(req, res, next).catch(next);

async function contarProductos() {
  const [[fila]] = await pool.query('SELECT COUNT(*) AS total FROM productos');
  return fila.total;
}

// ---------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------
app.get('/', asincrono(async (req, res) => {
  const [[conteo]] = await pool.query(
    'SELECT (SELECT COUNT(*) FROM categorias) AS categorias, (SELECT COUNT(*) FROM productos) AS productos'
  );
  const [ultimos] = await pool.query(
    `SELECT p.nombre, c.nombre AS categoria, p.precio
       FROM productos p JOIN categorias c ON c.id = p.categoria_id
      ORDER BY p.id DESC LIMIT 3`
  );
  res.render('inicio', { titulo: 'Inicio', conteo, ultimos, meta: META_REGISTROS });
}));

// ---------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------
async function categoriasActivas() {
  const [filas] = await pool.query('SELECT id, nombre FROM categorias WHERE activa = TRUE ORDER BY nombre');
  return filas;
}

app.get('/productos/nuevo', asincrono(async (req, res) => {
  res.render('producto-form', {
    titulo: 'Registrar producto',
    categorias: await categoriasActivas(),
    total: await contarProductos(),
    meta: META_REGISTROS,
    valores: { disponible: true, fecha_tostion: res.locals.hoy },
    errores: {},
    guardado: req.query.guardado || null
  });
}));

app.post('/productos', asincrono(async (req, res) => {
  const { errores, valores, datos } = validarProducto(req.body);

  if (Object.keys(errores).length === 0) {
    try {
      await pool.execute(
        `INSERT INTO productos (categoria_id, nombre, precio, cantidad, disponible, fecha_tostion)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [datos.categoria_id, datos.nombre, datos.precio, datos.cantidad, datos.disponible, datos.fecha_tostion]
      );
      // Patrón PRG: redirijo después de guardar para que recargar no duplique el registro
      return res.redirect(303, `/productos/nuevo?guardado=${encodeURIComponent(datos.nombre)}`);
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') errores.categoria_id = 'Esa categoría ya no existe. Elige otra.';
      else throw err;
    }
  }

  res.status(422).render('producto-form', {
    titulo: 'Registrar producto',
    categorias: await categoriasActivas(),
    total: await contarProductos(),
    meta: META_REGISTROS,
    valores,
    errores,
    guardado: null
  });
}));

// ---------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------
app.get('/categorias/nueva', (req, res) => {
  res.render('categoria-form', {
    titulo: 'Registrar categoría',
    valores: { activa: true, fecha_creacion: res.locals.hoy },
    errores: {},
    guardado: req.query.guardado || null
  });
});

app.post('/categorias', asincrono(async (req, res) => {
  const { errores, valores, datos } = validarCategoria(req.body);

  if (Object.keys(errores).length === 0) {
    try {
      await pool.execute(
        `INSERT INTO categorias (codigo, nombre, descripcion, activa, fecha_creacion)
         VALUES (?, ?, ?, ?, ?)`,
        [datos.codigo, datos.nombre, datos.descripcion, datos.activa, datos.fecha_creacion]
      );
      return res.redirect(303, `/categorias/nueva?guardado=${encodeURIComponent(datos.nombre)}`);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') errores.codigo = `Ya existe una categoría con el código ${datos.codigo}.`;
      else throw err;
    }
  }

  res.status(422).render('categoria-form', { titulo: 'Registrar categoría', valores, errores, guardado: null });
}));

// ---------------------------------------------------------------------
// Consulta de la base de datos (enlace diferente al de registro)
// ---------------------------------------------------------------------
app.get('/registros', asincrono(async (req, res) => {
  const [productos] = await pool.query(
    `SELECT p.id, p.nombre, p.precio, p.cantidad, p.disponible, p.fecha_tostion,
            c.id AS categoria_id, c.codigo AS categoria_codigo, c.nombre AS categoria
       FROM productos p
       INNER JOIN categorias c ON c.id = p.categoria_id
      ORDER BY p.id`
  );
  const [categorias] = await pool.query(
    `SELECT c.*, COUNT(p.id) AS total_productos
       FROM categorias c LEFT JOIN productos p ON p.categoria_id = c.id
      GROUP BY c.id ORDER BY c.id`
  );
  res.render('registros', { titulo: 'Base de datos', productos, categorias });
}));

// ---------------------------------------------------------------------
// Evidencia de ejecución dentro de un contenedor (Docker o Kubernetes)
// ---------------------------------------------------------------------
app.get('/contenedor', asincrono(async (req, res) => {
  const [[bd]] = await pool.query('SELECT VERSION() AS version, @@hostname AS host, DATABASE() AS base');
  const segundos = Math.floor(process.uptime());
  res.render('contenedor', {
    titulo: 'Contenedor',
    web: {
      hostname: os.hostname(),
      imagen: process.env.APP_IMAGE || `tienda-cafe-web:${VERSION}`,
      version: VERSION,
      node: process.version,
      sistema: `${os.type()} ${os.release()} (${os.arch()})`,
      puerto: PUERTO,
      activo: `${Math.floor(segundos / 60)} min ${segundos % 60} s`
    },
    bd: {
      servicio: process.env.DB_HOST || 'db',
      hostname: bd.host,
      version: bd.version,
      base: bd.base
    }
  });
}));

// Liveness: solo confirma que el proceso de Node responde.
// No consulta MySQL a propósito: si la base cae, reiniciar los pods web no
// la arregla y solo provoca reinicios en cascada.
app.get('/vivo', (req, res) => {
  res.json({ estado: 'vivo', pod: POD.nombre, version: VERSION });
});

// Readiness (y HEALTHCHECK de Docker): el pod recibe tráfico solo si
// además alcanza la base de datos.
app.get('/salud', asincrono(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ estado: 'ok', contenedor: os.hostname(), pod: POD.nombre, nodo: POD.nodo, version: VERSION });
}));

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    titulo: 'Página no encontrada',
    mensaje: 'La dirección que escribiste no existe en esta aplicación.',
    detalle: null
  });
});

// Errores no controlados
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const sinBD = ['ECONNREFUSED', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR'].includes(err.code);
  res.status(sinBD ? 503 : 500).render('error', {
    titulo: sinBD ? 'Sin conexión con la base de datos' : 'Algo falló en el servidor',
    mensaje: sinBD
      ? (ENTORNO === 'kubernetes'
          ? 'El pod de MySQL no responde. Revisa su estado con kubectl get pods.'
          : 'El contenedor de MySQL no responde. Revisa que esté en ejecución con docker compose ps.')
      : 'Ocurrió un error inesperado al procesar la solicitud.',
    detalle: err.code || null
  });
});

esperarBaseDeDatos()
  .then(() => {
    const servidor = app.listen(PUERTO, '0.0.0.0', () =>
      console.log(`Aplicación ${VERSION} escuchando en el puerto ${PUERTO} (entorno: ${ENTORNO}, pod: ${POD.nombre})`)
    );

    // Apagado ordenado. Kubernetes envía SIGTERM antes de eliminar un pod
    // (rolling update, escalado hacia abajo). Node corre como PID 1 dentro del
    // contenedor y, sin este manejador, ignora la señal: el pod esperaría los
    // 30 segundos de gracia y luego lo matarían cortando peticiones en curso.
    const apagar = (senal) => {
      console.log(`${senal} recibido: dejo de aceptar conexiones y cierro el pool de MySQL`);
      servidor.close(() => pool.end().finally(() => process.exit(0)));
      setTimeout(() => process.exit(0), 10000).unref();
    };
    process.on('SIGTERM', apagar);
    process.on('SIGINT', apagar);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
