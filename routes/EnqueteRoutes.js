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
  const [rows] = await db.query("SELECT * FROM enquetes");
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
      "UPDATE questions SET texte = ?, type = ? WHERE id_question = ?",
      [texte, type, qid]
    );

    // ✅ options (إذا مش text)
    await db.query("DELETE FROM options WHERE id_question = ?", [qid]);

    if (type !== "text" && options?.length > 0) {
      for (const opt of options) {
        await db.query(
          "INSERT INTO options (id_question, contenu) VALUES (?, ?)",
          [qid, opt]
        );
      }
    }
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

    // نحذف options أولاً
    await db.query("DELETE FROM options WHERE id_question = ?", [qid]);

    // نحذف السؤال
    await db.query("DELETE FROM questions WHERE id_question = ?", [qid]);

    res.json({ message: "✅ Question supprimée" });

  } catch (err) {
    console.error("❌ DELETE QUESTION:", err);
    res.status(500).json({ message: "Erreur suppression question" });
  }
});
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    const [enquete] = await db.query(
      "SELECT * FROM enquetes WHERE id_enquete = ?",
      [id]
    );

    const [questions] = await db.query(
      "SELECT * FROM questions WHERE id_enquete = ?",
      [id]
    );

    for (let q of questions) {
      if (q.type !== "text") {
        const [opts] = await db.query(
          "SELECT contenu FROM options WHERE id_question = ?",
          [q.id_question]
        );
        q.options = opts.map(o => o.contenu);
      }
    }

    res.json({
      ...enquete[0],
      questions
    });

  } catch (err) {
    console.error("❌ GET DETAIL:", err);
    res.status(500).json({ message: "Erreur chargement enquête" });
  }
});

module.exports = router;