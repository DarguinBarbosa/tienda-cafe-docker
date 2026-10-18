// Conexión a MySQL mediante un pool de conexiones.
// Las credenciales llegan por variables de entorno que define docker-compose.yml.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',            // nombre del servicio en la red de Docker
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || 'app_pass',
  database: process.env.DB_NAME || 'tienda_cafe',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true // devuelvo las fechas como texto para evitar corrimientos de zona horaria
});

// MySQL tarda unos segundos en estar listo la primera vez.
// Aunque compose espera el healthcheck, reintento por si acaso.
async function esperarBaseDeDatos(intentos = 20, esperaMs = 3000) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await pool.query('SELECT 1');
      console.log(`Conectado a MySQL en ${process.env.DB_HOST || 'db'} (intento ${i})`);
      return;
    } catch (err) {
      console.log(`MySQL aún no responde (intento ${i}/${intentos}): ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
  throw new Error('No fue posible conectar con la base de datos.');
}

module.exports = { pool, esperarBaseDeDatos };
