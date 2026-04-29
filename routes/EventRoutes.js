const express = require("express");
const router = express.Router();
const pool = require("../config/db");
console.log("✅ EventRoutes version: 2026-04-29 v3");

// ✅ GET /api/events/stats-gouvernorat?year=YYYY
router.get("/stats-gouvernorat", async (req, res) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    console.log("STATS GOUVERNORAT - année =", y);

    const [rows] = await pool.query(
      "SELECT id_gouvernorat, COUNT(*) AS total FROM evenement WHERE YEAR(date_evenement) = ? GROUP BY id_gouvernorat",
      [y]
    );

    const totals = new Array(24).fill(0);
    rows.forEach((r) => {
      const idx = r.id_gouvernorat - 1;
      if (idx >= 0 && idx < 24) totals[idx] = r.total;
    });

    res.json(totals.map((t, i) => ({ id_gouvernorat: i + 1, total: t })));
  } catch (e) {
    console.error("stats-gouvernorat error:", e);
    res.status(500).json({ message: "Erreur serveur", error: e.message });
  }
});

async function addEventHandler(req, res) {
  try {
    console.log("BODY ADD EVENT:", req.body);

    // ✅ تعريف المتغيّرات لازم يكون قبل أي استعمال
    const { titre_evenement, id_gouvernorat, date_evenement, id_user } = req.body;

    const govId = parseInt(id_gouvernorat, 10);

    // ✅ توا تنجم تعمل debug
    console.log("DEBUG TYPES:", {
      titre_evenement,
      id_gouvernorat,
      govId,
      date_evenement,
      id_user,
    });

    if (!titre_evenement || !date_evenement || !govId) {
      return res.status(400).json({
        message: "Champs obligatoires manquants",
        required: ["titre_evenement", "id_gouvernorat", "date_evenement"],
        received: req.body,
      });
    }

    const [result] = await pool.query(
      "INSERT INTO evenement (titre_evenement, date_evenement, id_gouvernorat) VALUES (?, ?, ?)",
      [titre_evenement, date_evenement, govId]
    );

    console.log("✅ INSERT OK, insertId =", result.insertId);

    return res.status(201).json({
      message: "Événement ajouté avec succès",
      id_evenement: result.insertId,
    });
  } catch (e) {
    console.error("ADD EVENT ERROR >>>", e);

    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "⚠️ Événement déjà existant (doublon)",
        code: e.code,
        sqlMessage: e.sqlMessage,
      });
    }

    return res.status(500).json({
      message: "Erreur lors de l'ajout de l'événement",
      code: e.code,
      sqlMessage: e.sqlMessage,
      error: e.message,
    });
  }
}

// ✅ Routes
router.post("/", addEventHandler);
router.post("/add", addEventHandler);

module.exports = router;
