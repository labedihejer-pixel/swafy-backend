const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET /api/events/stats-gouvernorat?year=YYYY
router.get("/stats-gouvernorat", async (req, res) => {
  try {
    const y = req.query.year || new Date().getFullYear();
    // GET /api/events/stats-gouvernorat?year=YYYY
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

// POST /api/events  ou  /api/events/add
async function addEventHandler(req, res) {
  try {
    console.log("BODY ADD EVENT:", req.body);
    const { titre_evenement, id_gouvernorat, date_evenement } = req.body;

    if (!titre_evenement || !date_evenement || !id_gouvernorat) {
      return res.status(400).json({
        message: "Champs obligatoires manquants",
        required: ["titre_evenement", "id_gouvernorat", "date_evenement"],
        received: req.body,
      });
    }

    const [result] = await pool.query(
      "INSERT INTO evenement (titre_evenement, date_evenement, id_gouvernorat) VALUES (?, ?, ?)",
      [titre_evenement, date_evenement, id_gouvernorat]
    );

    console.log("Inserted id =", result.insertId);

    res.status(201).json({
      message: "Evenement ajoute",
      id_evenement: result.insertId,
    });
  } catch (e) {
    console.error("addEvent error:", e);
    res.status(500).json({ mcdessage: "Erreur serveur", error: e.message });
  }
}

router.post("/", addEventHandler);
router.post("/add", addEventHandler);

module.exports = router;
