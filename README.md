# Tienda de Café de Origen: aplicación contenerizada en Docker

Actividad sumativa de la Unidad 2 del módulo Contenerización de Aplicaciones de Software.

Desarrollé una aplicación web para registrar el inventario de una tienda de café. Está compuesta por dos contenedores: un servidor web en Node.js con Express y una base de datos MySQL 8.4. Ambos se construyen con imágenes propias y se orquestan con Docker Compose.

## Requisitos

* Docker Desktop instalado y en ejecución.
* Conexión a internet la primera vez, para descargar las imágenes base `mysql:8.4`, `node:22-alpine` y `alpine:3.20`.

No necesito instalar Node.js ni MySQL en mi equipo: todo corre dentro de los contenedores.

## Cómo la ejecuto

Desde la carpeta del proyecto:

```bash
docker compose up -d --build
```

Cuando `docker compose ps` muestra los dos servicios como `healthy`, abro http://localhost:3000.

Para detenerla sin perder los datos:

```bash
docker compose down
```

Para borrar también los datos y empezar de cero:

```bash
docker compose down -v
```

## Páginas de la aplicación

| Ruta | Qué hace |
|---|---|
| `/` | Inicio con el avance hacia los 15 productos y los últimos registros. |
| `/productos/nuevo` | Formulario para registrar productos en la tabla `productos`. |
| `/categorias/nueva` | Formulario para registrar categorías en la tabla `categorias`. |
| `/registros` | Enlace independiente que muestra el contenido de las dos tablas leído desde MySQL. |
| `/contenedor` | Evidencia de que la aplicación corre dentro de Docker: identificador del contenedor, versiones y arquitectura. |
| `/salud` | Respuesta JSON que usa el HEALTHCHECK del contenedor. |

## Estructura

```
tienda-cafe-docker/
├── docker-compose.yml   orquestación de los servicios db y web
├── .env                 credenciales y puertos
├── db/
│   ├── Dockerfile       imagen tienda-cafe-db basada en mysql:8.4
│   └── init.sql         script de la base de datos
├── web/
│   ├── Dockerfile       imagen tienda-cafe-web basada en node:22-alpine
│   ├── package.json
│   ├── src/
│   │   ├── server.js    rutas y lógica de la aplicación
│   │   ├── db.js        conexión a MySQL con reintentos
│   │   └── validacion.js validaciones del lado del servidor
│   ├── views/           plantillas EJS de la interfaz
│   └── public/          hoja de estilos e icono
└── demo-imagen/
    └── Dockerfile       imagen mínima para la demostración de crear y eliminar
```

## Modelo de datos

Relación de uno a muchos: una categoría tiene muchos productos y cada producto pertenece a una categoría mediante la llave foránea `productos.categoria_id`.

| categorias | productos |
|---|---|
| id INT (PK) | id INT (PK) |
| codigo CHAR(4) único | categoria_id INT (FK a categorias.id) |
| nombre VARCHAR(60) | nombre VARCHAR(100) |
| descripcion TEXT | precio DECIMAL(10,2) |
| activa BOOLEAN | cantidad SMALLINT UNSIGNED |
| fecha_creacion DATE | disponible BOOLEAN |
| creado_en DATETIME | fecha_tostion DATE |

El script `db/init.sql` crea las tablas e inserta tres categorías iniciales. Los quince productos se ingresan desde la interfaz.

## Decisiones técnicas

* Elegí imágenes propias para ambos servicios, en lugar de usar las oficiales sin cambios, para que el script de la base de datos viaje dentro de la imagen.
* La web espera a que MySQL responda gracias a `depends_on` con `condition: service_healthy`, y además reintenta la conexión al arrancar.
* Todas las consultas usan parámetros (`?`), así que los datos del formulario nunca se concatenan dentro del SQL.
* Después de guardar aplico el patrón POST, redirección y GET, para que recargar la página no duplique registros.
* Valido los datos en el navegador y otra vez en el servidor, porque la validación del cliente se puede saltar.
* El contenedor web corre con el usuario `node` y no como root.
* Los datos viven en el volumen `db_data`, por eso sobreviven a `docker compose down`.

## Entregables

1. Código fuente de la aplicación web: carpeta `web/` y archivos de Docker.
2. Script de la base de datos: `db/init.sql`.
3. Enlace del video, publicado con visibilidad pública.
