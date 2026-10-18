# Imagen propia de la base de datos relacional.
# Parto de la imagen oficial de MySQL y le agrego mi script de creación.
FROM mysql:8.4

LABEL org.opencontainers.image.title="tienda-cafe-db" \
      org.opencontainers.image.description="MySQL con el esquema de la Tienda de Café de Origen"

# Todo archivo .sql dentro de esta carpeta se ejecuta solo la primera vez
# que el contenedor inicializa su volumen de datos.
COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

EXPOSE 3306
