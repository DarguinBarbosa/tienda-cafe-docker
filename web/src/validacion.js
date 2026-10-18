// Validación del lado del servidor. El navegador también valida con HTML5,
// pero nunca confío solo en el cliente.

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function esFechaValida(valor) {
  if (!FECHA_RE.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function limpiar(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function validarProducto(body) {
  const valores = {
    categoria_id: limpiar(body.categoria_id),
    nombre: limpiar(body.nombre),
    precio: limpiar(body.precio),
    cantidad: limpiar(body.cantidad),
    disponible: body.disponible === 'on',
    fecha_tostion: limpiar(body.fecha_tostion)
  };
  const errores = {};

  if (!/^\d+$/.test(valores.categoria_id)) errores.categoria_id = 'Elige la categoría a la que pertenece el producto.';

  if (valores.nombre.length < 2) errores.nombre = 'Escribe un nombre de al menos 2 caracteres.';
  else if (valores.nombre.length > 100) errores.nombre = 'El nombre admite máximo 100 caracteres.';

  const precio = Number(valores.precio);
  if (valores.precio === '' || Number.isNaN(precio)) errores.precio = 'Escribe el precio en pesos, solo números.';
  else if (precio < 0 || precio > 99999999.99) errores.precio = 'El precio debe estar entre 0 y 99.999.999.';

  const cantidad = Number(valores.cantidad);
  if (!/^\d+$/.test(valores.cantidad)) errores.cantidad = 'Escribe la cantidad como número entero.';
  else if (cantidad > 65535) errores.cantidad = 'La cantidad máxima es 65.535 unidades.';

  if (!esFechaValida(valores.fecha_tostion)) errores.fecha_tostion = 'Elige una fecha válida.';

  return {
    errores,
    valores,
    datos: {
      categoria_id: Number(valores.categoria_id),
      nombre: valores.nombre,
      precio: Math.round(precio * 100) / 100,
      cantidad,
      disponible: valores.disponible,
      fecha_tostion: valores.fecha_tostion
    }
  };
}

function validarCategoria(body) {
  const valores = {
    codigo: limpiar(body.codigo).toUpperCase(),
    nombre: limpiar(body.nombre),
    descripcion: limpiar(body.descripcion),
    activa: body.activa === 'on',
    fecha_creacion: limpiar(body.fecha_creacion)
  };
  const errores = {};

  if (!/^[A-Z0-9]{4}$/.test(valores.codigo)) errores.codigo = 'El código lleva exactamente 4 letras o números, por ejemplo TOST.';
  if (valores.nombre.length < 2) errores.nombre = 'Escribe un nombre de al menos 2 caracteres.';
  else if (valores.nombre.length > 60) errores.nombre = 'El nombre admite máximo 60 caracteres.';
  if (valores.descripcion.length > 500) errores.descripcion = 'La descripción admite máximo 500 caracteres.';
  if (!esFechaValida(valores.fecha_creacion)) errores.fecha_creacion = 'Elige una fecha válida.';

  return { errores, valores, datos: { ...valores, descripcion: valores.descripcion || null } };
}

module.exports = { validarProducto, validarCategoria };
