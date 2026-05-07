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
    l.id AS id,
    l.title AS title,
    l.description AS description,
    l.date AS date
  FROM lives l
  WHERE l.host_user_id = ?
  ORDER BY l.date DESC
`, [adminId]);

    res.json(rows);
    
  } catch (err) {
    console.error("❌ GET /enquetes/lives", err);
    res.status(500).json({ message: "Erreur chargement lives" });
  }
});

// ✅ GET /api/enquetes
router.get("/", verifyToken, async (req, res) => {
  const [rows] = await db.query("SELECT * FROM questions_enquete");
  res.json(rows);
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { live_id, titre, description, template } = req.body;

    if (!titre) {
      return res.status(400).json({ message: "Titre requis" });
    }

    // ✅ مهم: ناخذ result
    const [result] = await db.query(
      "INSERT INTO enquetes (live_id, titre, description, template) VALUES (?, ?, ?, ?)",
      [live_id || null, titre, description, template || "style1"]
    );
    res.status(201).json({
      message: "✅ Enquête créée avec succès",
      id_enquete: result.insertId   // 🔥 هذا هو الحل
    });
      } catch (err) {
        console.error("❌ CREATE ENQUETE ERROR:", err);
        res.status(500).json({ message: "Erreur création enquête" });
      }
    });

router.get("/detail/:id", verifyToken, async (req, res) => {
  res.json({
    id_enquete: 999,
    titre: "TEST ENQUETE",
    description: "test desc",
    template: "style3",
    questions: [
      {
        id_question: 1,
        texte: "Question test ?",
        type: "text",
        options: []
      }
    ]
  });
});
// ✅ POST réponse enquête
router.post("/:id/reponses", verifyToken, async (req, res) => {
  try {
    const enqueteId = req.params.id;
    const userId = req.user.id_user;

    const { reponses } = req.body;
    // reponses = [{ question_id, contenu }]

    for (const rep of reponses) {
      await db.query(
        "INSERT INTO reponses (id_enquete, id_question, id_user, contenu_reponse) VALUES (?, ?, ?, ?)",
        [enqueteId, rep.question_id, userId, rep.contenu]
      );
    }

    res.json({ message: "✅ Réponses enregistrées" });

  } catch (err) {
    console.error("❌ SAVE REPONSES:", err);
    res.status(500).json({ message: "Erreur save réponses" });
  }
});
// ✅ UPDATE QUESTION
router.put("/:enqueteId/questions/:qid", verifyToken, async (req, res) => {
  try {
    const { texte, type, options } = req.body;
    const qid = req.params.qid;

    await db.query(
      "UPDATE questions_enquete SET texte = ?, type = ?, options = ? WHERE  id_question = ?",
      [texte, type, JSON.stringify(options || []), qid]
    );

    res.json({ message: "✅ Question modifiée" });

  } catch (err) {
    console.error("❌ UPDATE QUESTION:", err);
    res.status(500).json({ message: "Erreur update question" });
  }
});
// ✅ DELETE QUESTION
router.delete("/:enqueteId/questions/:qid", verifyToken, async (req, res) => {
  try {
    const { qid } = req.params;

    await db.query(
      "DELETE FROM questions_enquete WHERE id_question = ?",
      [qid]
    );

    res.json({ message: "✅ Question supprimée" });

  } catch (err) {
    console.error("❌ DELETE QUESTION:", err);
    res.status(500).json({ message: "Erreur suppression question" });
  }
});

module.exports = router;