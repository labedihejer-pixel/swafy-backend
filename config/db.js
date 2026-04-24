const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),   // ⭐ المهم
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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
