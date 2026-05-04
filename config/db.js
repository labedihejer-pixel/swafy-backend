const mysql = require("mysql2/promise");
require("dotenv").config();

console.log("DB_HOST =", process.env.DB_HOST);
console.log("DB_PORT =", process.env.DB_PORT);
console.log("DB_NAME =", process.env.DB_NAME);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, // ✅ هكّا الصحيح
  port: process.env.DB_PORT,
});

pool.getConnection()
  .then((conn) => {
    console.log("✅ Connecté à MySQL");
    console.log("✅ Base utilisée:", process.env.DB_NAME);
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Erreur connexion MySQL:", err);
  });

module.exports = pool;
