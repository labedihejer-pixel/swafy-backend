exports.createPublication = async (req, res) => {
  console.log("🔥 CREATE PUBLICATION HIT");
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin uniquement" });
    }

    const {
      titre_publication,
      contenu,
      question_debat,
      type_publication
    } = req.body;

    const userId = req.user.id_user;
    const mediaPath = req.file ? req.file.path : null;

    const [result] = await db.query(
  `INSERT INTO publications
   (user_id, titre_publication, type_publication, contenu, question_debat, media_path, status_publication, date_publication)
   VALUES (?, ?, ?, ?, ?, ?, 'publie', NOW())`,
  [
    userId,
    titre_publication || null,
    type_publication,
    contenu || null,
    question_debat || null,
    mediaPath
  ]
);

const publicationId = result.insertId;

// ✅ message
const notifMessage = "📢 Nouvelle publication ajoutée";

// ✅ admin id (ديناميك)
const adminId = req.user.id_user;

console.log("🔥 CREATE PUBLICATION HIT ✅");

const [jeunes] = await db.query(
  "SELECT id_user FROM utilisateurs WHERE role = 'jeune'"
);

for (const jeune of jeunes) {
  console.log("📤 SEND NOTIF TO:", jeune.id_user);

  await db.query(
    `INSERT INTO notifications
    (id_user_to, id_user_from, type_notification, entity_type, entity_id, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
    [
      jeune.id_user,      // ✅ TO (jeune)
      userId,             // ✅ FROM (admin)
      "new_post",
      "publication",
      publicationId,
      notifMessage
    ]
  );
}
// ✅ بعد كل شي نرجع response
res.json({
  message: "✅ Publication créée + notifications envoyées",
  publicationId
});

} catch (error) {
  console.error(" createPublication error:", error);
  res.status(500).json({ message: "Erreur serveur" });
}
};

exports.getAllPublications = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM publications WHERE status_publication = 'publie'"
    );
    console.log(" publications from DB:", rows); 
    res.json(rows);
  } catch (error) {
    console.error("getAllPublications error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
exports.getOnePublication = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM publications WHERE id_publication = ?",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Publication introuvable" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("getOnePublication error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
exports.getCommentaires = async (req, res) => {
  try {
    const publicationId = req.params.id;
    const userId = req.user.id_user;

    const [rows] = await db.query(
      `
      SELECT 
        c.id_commentaire,
        c.id_publication,
        c.user_id,
        c.contenu,
        c.parent_id,
        c.created_at,

        u.nom_user,
        u.prenom_user,

        MAX(CASE WHEN cr.user_id = ? THEN cr.type_reaction END) AS userReaction,

        COALESCE(SUM(CASE WHEN cr.type_reaction = 'like'  THEN 1 ELSE 0 END), 0) AS likes,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'love'  THEN 1 ELSE 0 END), 0) AS loves,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'haha'  THEN 1 ELSE 0 END), 0) AS hahas,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'wow'   THEN 1 ELSE 0 END), 0) AS wows,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'sad'   THEN 1 ELSE 0 END), 0) AS sads,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'angry' THEN 1 ELSE 0 END), 0) AS angrys

      FROM commentaires c
      JOIN utilisateurs u ON u.id_user = c.user_id
      LEFT JOIN comment_reactions cr ON cr.id_commentaire = c.id_commentaire
      WHERE c.id_publication = ?
      GROUP BY c.id_commentaire
      ORDER BY c.created_at ASC
      `,
      [userId, publicationId]
    );

    res.json(rows);
  } catch (error) {
    console.error("❌ getCommentaires error:", error);
    res.status(500).json({ message: "Erreur récupération commentaires" });
  }
};
exports.addReaction = async (req, res) => {
  try {
    const { id_publication, type_reaction } = req.body;
    const userId = req.user.id_user;

    await db.query(
      `
      INSERT INTO publication_reactions (id_publication, user_id, type_reaction)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE type_reaction = VALUES(type_reaction)
      `,
      [id_publication, userId, type_reaction]
    );

    res.json({ message: "✅ Reaction ajoutée" });
  } catch (error) {
    console.error("❌ addReaction error:", error);
    res.status(500).json({ message: "Erreur reaction publication" });
  }
};


exports.addCommentReaction = async (req, res) => {
  try {
    const { id_commentaire, type_reaction } = req.body;
    const userId = req.user.id_user;

    await db.query(
      `
      INSERT INTO comment_reactions (id_commentaire, user_id, type_reaction)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE type_reaction = VALUES(type_reaction)
      `,
      [id_commentaire, userId, type_reaction]
    );

    res.json({ message: "✅ Reaction commentaire ajoutée" });
  } catch (error) {
    console.error("❌ addCommentReaction error:", error);
    res.status(500).json({ message: "Erreur reaction commentaire" });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { id_publication, contenu, parent_id } = req.body;
    const userId = req.user.id_user; // ✅ نفس id متاع JWT

    if (!id_publication || !contenu) {
      return res.status(400).json({ message: "Données manquantes" });
    }

    await db.query(
      `
      INSERT INTO commentaires
      (id_publication, user_id, contenu, parent_id, created_at)
      VALUES (?, ?, ?, ?, NOW())
      `,
      [
        id_publication,
        userId,
        contenu,
        parent_id || null
      ]
    );

    res.json({ message: "✅ Commentaire ajouté" });
  } catch (error) {
    console.error("❌ addComment error:", error);
    res.status(500).json({ message: "Erreur ajout commentaire" });
  }
};

