-- =====================================================================
-- Script de base de datos: Tienda de Café de Origen
-- Motor: MySQL 8.4
-- Este archivo lo ejecuta automáticamente la imagen oficial de MySQL
-- la primera vez que arranca el contenedor (carpeta /docker-entrypoint-initdb.d).
--
-- Modelo entidad relación:
--   categorias (1) ────< (N) productos
--   Una categoría agrupa muchos productos; cada producto pertenece
--   a una sola categoría (llave foránea productos.categoria_id).
-- =====================================================================

-- Fuerzo UTF-8 en la conexión para que las tildes y la ñ se guarden bien.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS tienda_cafe
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tienda_cafe;

-- ---------------------------------------------------------------------
-- Tabla padre: categorias (7 columnas)
-- Tipos usados: INT, CHAR, VARCHAR, TEXT, BOOLEAN, DATE, DATETIME
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id              INT           NOT NULL AUTO_INCREMENT,               -- entero
  codigo          CHAR(4)       NOT NULL,                              -- carácter de longitud fija
  nombre          VARCHAR(60)   NOT NULL,                              -- cadena variable
  descripcion     TEXT          NULL,                                  -- texto largo
  activa          BOOLEAN       NOT NULL DEFAULT TRUE,                 -- booleano
  fecha_creacion  DATE          NOT NULL,                              -- fecha
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,    -- fecha y hora
  CONSTRAINT pk_categorias PRIMARY KEY (id),
  CONSTRAINT uq_categorias_codigo UNIQUE (codigo)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Tabla hija: productos (7 columnas)
-- Tipos usados: INT, INT (FK), VARCHAR, DECIMAL, SMALLINT, BOOLEAN, DATE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id              INT               NOT NULL AUTO_INCREMENT,           -- entero
  categoria_id    INT               NOT NULL,                          -- entero, llave foránea
  nombre          VARCHAR(100)      NOT NULL,                          -- cadena variable
  precio          DECIMAL(10,2)     NOT NULL,                          -- decimal exacto (dinero)
  cantidad        SMALLINT UNSIGNED NOT NULL DEFAULT 0,                -- entero pequeño sin signo
  disponible      BOOLEAN           NOT NULL DEFAULT TRUE,             -- booleano
  fecha_tostion   DATE              NOT NULL,                          -- fecha
  CONSTRAINT pk_productos PRIMARY KEY (id),
  CONSTRAINT fk_productos_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT ck_productos_precio CHECK (precio >= 0)
) ENGINE = InnoDB;
-- Nota: InnoDB crea automáticamente un índice sobre categoria_id
-- por ser llave foránea, así que no declaro uno adicional.

-- ---------------------------------------------------------------------
-- Datos iniciales: tres categorías para poder registrar productos.
-- Los 15 productos se ingresan desde la aplicación web.
-- ---------------------------------------------------------------------
INSERT INTO categorias (codigo, nombre, descripcion, activa, fecha_creacion) VALUES
  ('GRAN', 'Café en grano', 'Café tostado entero para moler en casa justo antes de preparar.', TRUE, '2026-01-15'),
  ('MOLI', 'Café molido',   'Café tostado y molido listo para cafetera de goteo, prensa o greca.', TRUE, '2026-01-15'),
  ('ACCE', 'Accesorios',    'Utensilios de preparación: filtros, molinos, prensas y jarras.', TRUE, '2026-02-01');

-- ---------------------------------------------------------------------
-- Consulta de verificación (la uso en el video para mostrar la relación):
-- SELECT p.id, p.nombre, c.nombre AS categoria, p.precio, p.cantidad,
--        p.disponible, p.fecha_tostion
-- FROM productos p
-- INNER JOIN categorias c ON c.id = p.categoria_id
-- ORDER BY p.id;
-- ---------------------------------------------------------------------
