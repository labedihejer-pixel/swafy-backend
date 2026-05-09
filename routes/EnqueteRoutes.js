console.log("✅ EnqueteRoutes.js LOADED");

const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

/* ══════════════════════════════════════════
   TEST
══════════════════════════════════════════ */
router.get("/ping", (req, res) => res.json({ ok: true }));

/* ══════════════════════════════════════════
   GET /api/enquetes/lives
   → lives de l'admin connecté
══════════════════════════════════════════ */
router.get("/lives", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin seulement" });
    const [rows] = await db.query(
      `SELECT l.id, l.title, l.description, l.date
       FROM lives l
       WHERE l.host_user_id = ?
       ORDER BY l.date DESC`,
      [req.user.id_user]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ GET /enquetes/lives", err);
    res.status(500).json({ message: "Erreur chargement lives" });
  }
});

/* ══════════════════════════════════════════
   GET /api/enquetes
   → liste de toutes les enquêtes
══════════════════════════════════════════ */
router.get("/", verifyToken, async (req, res) => {
  try {
   
const [rows] = await db.query(`
  SELECT
    e.id_enquete,
    e.titre,
    e.description,
    e.date_creation,
    l.title AS live_title
  FROM enquetes e
  LEFT JOIN lives l ON l.id = e.live_id
  ORDER BY e.date_creation DESC
`);

    res.json(rows);
  } catch (err) {
    console.error("❌ GET /enquetes ERROR:", err.message);
    res.status(500).json({ message: "Erreur chargement enquêtes" });
  }
});

/* ══════════════════════════════════════════
   POST /api/enquetes
   → créer une enquête
══════════════════════════════════════════ */
router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin seulement" });
    const { live_id, titre, description, template } = req.body;
    if (!titre) return res.status(400).json({ message: "Titre requis" });

    const [result] = await db.query(
      "INSERT INTO enquetes (live_id, titre, description, template, date_creation) VALUES (?, ?, ?, ?, NOW())",
      [live_id || null, titre, description || null, template || "style1"]
    );
    res.status(201).json({ message: "✅ Enquête créée", id_enquete: result.insertId });
  } catch (err) {
    console.error("❌ POST /enquetes", err);
    res.status(500).json({ message: "Erreur création enquête" });
  }
});

/* ══════════════════════════════════════════
   GET /api/enquetes/detail/:id
   → détail complet avec questions
══════════════════════════════════════════ */
router.get("/detail/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.query(
      `SELECT e.*, l.title AS live_title
       FROM enquetes e
       LEFT JOIN lives l ON l.id = e.live_id
       WHERE e.id_enquete = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Enquête introuvable" });

    const [qs] = await db.query(
      "SELECT * FROM questions_enquete WHERE enquete_id = ? ORDER BY id_question ASC",
      [id]
    );
    const questions = qs.map(q => {
  let opts = [];

  try {
    opts = q.options ? JSON.parse(q.options) : [];
  } catch (err) {
    console.log("❌ JSON ERROR OPTIONS:", q.options);
    opts = [];
  }

  return {
    ...q,
    options: opts
  };
});

    res.json({ ...rows[0], questions });
  } catch (err) {
    console.error("❌ GET /enquetes/detail/:id", err);
    res.status(500).json({ message: "Erreur détail enquête" });
  }
});

/* ══════════════════════════════════════════
   DELETE /api/enquetes/:id
   → supprimer une enquête
══════════════════════════════════════════ */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin seulement" });
    await db.query("DELETE FROM questions_enquete WHERE enquete_id = ?", [req.params.id]);
   await db.query("DELETE FROM reponses_enquete WHERE enquete_id = ?", [req.params.id]);
    await db.query("DELETE FROM enquetes WHERE id_enquete = ?", [req.params.id]);
    res.json({ message: "✅ Enquête supprimée" });
  } catch (err) {
    console.error("❌ DELETE /enquetes/:id", err);
    res.status(500).json({ message: "Erreur suppression" });
  }
});

/* ══════════════════════════════════════════
   POST /api/enquetes/:id/questions
   → ajouter une question  ← MANQUAIT !
══════════════════════════════════════════ */
router.post("/:id/questions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin seulement" });
    const { texte, type, options } = req.body;
    if (!texte) return res.status(400).json({ message: "Texte requis" });

    const [result] = await db.query(
      "INSERT INTO questions_enquete (enquete_id, texte, type, options) VALUES (?, ?, ?, ?)",
      [req.params.id, texte, type || "text", JSON.stringify(options || [])]
    );
    res.status(201).json({ message: "✅ Question ajoutée", id_question: result.insertId });
  } catch (err) {
    console.error("❌ POST /:id/questions", err);
    res.status(500).json({ message: "Erreur ajout question" });
  }
});

/* ══════════════════════════════════════════
   PUT /api/enquetes/:enqueteId/questions/:qid
   → modifier une question
══════════════════════════════════════════ */
router.put("/:enqueteId/questions/:qid", verifyToken, async (req, res) => {
  try {
    const { texte, type, options } = req.body;
    await db.query(
      "UPDATE questions_enquete SET texte = ?, type = ?, options = ? WHERE id_question = ?",
      [texte, type || "text", JSON.stringify(options || []), req.params.qid]
    );
    res.json({ message: "✅ Question modifiée" });
  } catch (err) {
    console.error("❌ PUT /:enqueteId/questions/:qid", err);
    res.status(500).json({ message: "Erreur modification question" });
  }
});

/* ══════════════════════════════════════════
   DELETE /api/enquetes/:enqueteId/questions/:qid
   → supprimer une question
══════════════════════════════════════════ */
router.delete("/:enqueteId/questions/:qid", verifyToken, async (req, res) => {
  try {
    await db.query(
      "DELETE FROM questions_enquete WHERE id_question = ?",
      [req.params.qid]
    );
    res.json({ message: "✅ Question supprimée" });
  } catch (err) {
    console.error("❌ DELETE /:enqueteId/questions/:qid", err);
    res.status(500).json({ message: "Erreur suppression question" });
  }
});

/* ══════════════════════════════════════════
   POST /api/enquetes/:id/partager
   → envoyer notification à tous les jeunes
══════════════════════════════════════════ */
router.post("/:id/partager", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin seulement" });

    const enqueteId = req.params.id;

    /* 1. récupérer l'enquête */
    const [enqueteRows] = await db.query(
      "SELECT titre FROM enquetes WHERE id_enquete = ?",
      [enqueteId]
    );
    if (!enqueteRows.length) return res.status(404).json({ message: "Enquête introuvable" });
    const titre = enqueteRows[0].titre;

    /* 2. récupérer tous les jeunes */
    const [jeunes] = await db.query(
      "SELECT id_user FROM users WHERE role = 'jeune_profiles'"
    );
    if (!jeunes.length) return res.json({ message: "Aucun jeune trouvé", sent: 0 });

    /* 3. créer une notification pour chaque jeune */
    const values = jeunes.map(j => [
      j.id_user,
      "enquete",
      `📋 Nouvelle enquête : "${titre}" — Donnez votre avis !`,
      enqueteId,
      0,         // lu = false
      new Date()
    ]);

    await db.query(
      `INSERT INTO notifications (id_user, type, message, reference_id, lu, date_creation)
       VALUES ?`,
      [values]
    );

    /* 4. marquer l'enquête comme partagée */
    await db.query(
      "UPDATE enquetes SET partagee = 1, date_partage = NOW() WHERE id_enquete = ?",
      [enqueteId]
    );

    res.json({ message: "✅ Notifications envoyées", sent: jeunes.length });
  } catch (err) {
    console.error("❌ POST /:id/partager", err);
    res.status(500).json({ message: "Erreur lors du partage" });
  }
});

/* ══════════════════════════════════════════
   POST /api/enquetes/:id/reponses
   → soumettre les réponses (jeune)
══════════════════════════════════════════ */
router.post("/:id/reponses", verifyToken, async (req, res) => {
  try {
    const enqueteId = req.params.id;
    const userId    = req.user.id_user;
    const { reponses } = req.body; // [{ question_id, contenu }]

    /* vérifier si déjà répondu */
    const [already] = await db.query(
  "SELECT id_reponse FROM reponses_enquete WHERE enquete_id = ? AND user_id = ? LIMIT 1",
  [enqueteId, userId]
);
    if (already.length) return res.status(409).json({ message: "Vous avez déjà répondu à cette enquête" });

    for (const rep of reponses) {
      await db.query(
        "INSERT INTO reponses_enquete (enquete_id, question_id, user_id, contenu_reponse, heure_reponse) VALUES (?, ?, ?, ?, NOW())",
        [enqueteId, rep.question_id, userId, rep.contenu]
      );
    }

    /* marquer la notification comme lue */
    await db.query(
      "UPDATE notifications SET lu = 1 WHERE id_user = ? AND type = 'enquete' AND reference_id = ?",
      [userId, enqueteId]
    );

    res.json({ message: "✅ Réponses enregistrées" });
  } catch (err) {
    console.error("❌ POST /:id/reponses", err);
    res.status(500).json({ message: "Erreur enregistrement réponses" });
  }
});

/* ══════════════════════════════════════════
   GET /api/enquetes/:id/stats
   → statistiques de l'enquête (admin)
══════════════════════════════════════════ */
router.get("/:id/stats", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    const [nb] = await db.query(
  "SELECT COUNT(DISTINCT user_id) AS nb FROM reponses_enquete WHERE enquete_id = ?",
  [id]
);

    const [qs] = await db.query(
      "SELECT * FROM questions_enquete WHERE enquete_id = ? ORDER BY id_question ASC",
      [id]
    );

    const questions = await Promise.all(qs.map(async q => {
      const [reps] = await db.query(
        `SELECT r.*, u.nom AS nom_user, u.prenom AS prenom_user
         FROM reponses_enquete r
         JOIN users u ON u.id_user = r.id_user
         WHERE r.enquete_id = ? AND r.question_id = ?`,
        [id, q.id_question]
      );

      let distribution = null;
      let opts = [];
        try {
          opts = q.options ? JSON.parse(q.options) : [];
        } catch {
          opts = [];
        }
      if (opts.length > 0) {
        distribution = {};
        opts.forEach(o => { distribution[o] = 0; });
        reps.forEach(r => {
          const parts = r.contenu_reponse.split(", ");
          parts.forEach(p => { if (distribution[p] !== undefined) distribution[p]++; });
        });
      }

      return {
        question:      { ...q, options: opts },
        nb_reponses:   reps.length,
        reponses:      reps,
        distribution,
      };
    }));

    res.json({ nb_repondants: nb[0].nb, questions });
  } catch (err) {
    console.error("❌ GET /:id/stats", err);
    res.status(500).json({ message: "Erreur stats" });
  }
});

module.exports = router;
