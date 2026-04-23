const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Archive complet
router.get("/", (req, res) => {

  const sql = `
    SELECT 
      l.id AS live_id,
      l.title AS live_title,
      l.description AS live_description,
      l.date,
      l.time,

      e.id_enquete,
      e.titre AS enquete_titre,
      e.description AS enquete_description,

      q.id_question,
      q.contenu_enquete,

      r.id_reponse,
      r.contenu_reponse

    FROM lives l
    LEFT JOIN enquetes e ON e.live_id = l.id
    LEFT JOIN questions_enquete q ON q.enquete_id = e.id_enquete
    LEFT JOIN reponses r ON r.question_id = q.id_question

    ORDER BY l.date DESC, l.time DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });

});

module.exports = router;