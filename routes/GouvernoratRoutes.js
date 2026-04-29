const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ✅ GET /api/gouvernorats
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id_gouvernorat, nom_gouvernorat FROM gouvernorat ORDER BY id_gouvernorat"
    );

    return res.json(rows);
  } catch (e) {
    console.error("Erreur chargement gouvernorats:", e);
    return res.status(500).json({
      message: "Erreur serveur gouvernorats",
      error: e.message,
    });
  }
});

module.exports = router;