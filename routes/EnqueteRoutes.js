const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ✅ TEST ROUTE (باش نتاكدو)
router.get("/test", (req, res) => {
  res.json({ ok: true, message: "✅ Enquete route works" });
});

// ✅ SATISFACTION TREND
router.get("/:enqueteId/satisfaction-trend", async (req, res) => {
  try {
    const { enqueteId } = req.params;
    const { period = "month" } = req.query;

    let sql;
    if (period === "week") {
      sql = `
        SELECT
          YEARWEEK(r.heure_reponse, 1) AS k,
          MIN(DATE(r.heure_reponse)) AS label,
          AVG(CAST(r.contenu_reponse AS UNSIGNED)) AS avg_satisfaction,
          COUNT(*) AS nb_reponses
        FROM reponses r
        JOIN questions_enquete q ON q.id_question = r.question_id
        WHERE q.enquete_id = ?
          AND r.question_id = 1
        GROUP BY YEARWEEK(r.heure_reponse, 1)
        ORDER BY k
      `;
    } else {
      sql = `
        SELECT 
          DATE_FORMAT(r.heure_reponse, '%Y-%m') AS label,
          AVG(CAST(r.contenu_reponse AS UNSIGNED)) AS avg_satisfaction,
          COUNT(*) AS nb_reponses
        FROM reponses r
        JOIN questions_enquete q ON q.id_question = r.question_id
        WHERE q.enquete_id = ?
          AND r.question_id = 1
        GROUP BY DATE_FORMAT(r.heure_reponse, '%Y-%m')
        ORDER BY label
      `;
    }

    const [rows] = await pool.query(sql, [enqueteId]);

    res.json({
      labels: rows.map(r => r.label),
      datasets: [
        { label: "Satisfaction moyenne", data: rows.map(r => Number(r.avg_satisfaction)) },
        { label: "Nb réponses", data: rows.map(r => Number(r.nb_reponses)) },
      ],
    });
  } catch (err) {
    console.error("❌ Enquete route error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;
