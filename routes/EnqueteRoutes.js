console.log("✅ EnqueteRoutes.js LOADED");

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

// ✅ TEST ROUTE
router.get("/ping", (req, res) => {
  res.json({ ok: true, from: "enquetes/ping" });
});

// ✅ GET /api/enquetes/lives
router.get("/lives", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin seulement" });
    }

    const adminId = req.user.id_user;

    const [rows] = await db.query(`
      SELECT
        l.id_live AS id,
        l.titre_live AS title,
        l.description_live AS description,
        l.date_live AS date
      FROM lives l
      WHERE l.id_user = ?
      ORDER BY l.date_live DESC
    `, [adminId]);

    res.json(rows);
  } catch (err) {
    console.error("❌ GET /enquetes/lives", err);
    res.status(500).json({ message: "Erreur chargement lives" });
  }
});

// ✅ GET /api/enquetes
router.get("/", verifyToken, async (req, res) => {
  const [rows] = await db.query("SELECT * FROM enquetes");
  res.json(rows);
});

module.exports = router;