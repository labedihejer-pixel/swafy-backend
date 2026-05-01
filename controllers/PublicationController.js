const db = require("../config/db");

// helper: create notification (safe)
async function createNotification({ toUserId, fromUserId, type, entityType, entityId, message }) {
  if (!toUserId || !entityId || !entityType || !type) return;
  if (toUserId === fromUserId) return; // ما نبعتوش notif لروحو

  await db.query(
    `INSERT INTO notifications
     (id_user_to, id_user_from, type_notification, entity_type, entity_id, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [toUserId, fromUserId || null, type, entityType, entityId, message || ""]
  );
}

// ==========================================
// CRÉER UNE PUBLICATION
// ==========================================
// controllers/publicationController.js
exports.createPublication = async (req, res) => {
  try {
    const {
      titre_publication,
      contenu_publication,
      type_publication,
      contenu,
      question_debat
    } = req.body;

    const userId = req.user.id_user;

    const [result] = await db.query(
      `INSERT INTO publications
       (user_id, titre_publication, contenu_publication, type_publication, contenu, question_debat, status_publication, date_publication)
       VALUES (?, ?, ?, ?, ?, ?, 'publie', NOW())`,
      [
        userId,
        titre_publication,
        contenu_publication,
        type_publication || "texte",
        contenu || null,
        question_debat || null
      ]
    );

    const publicationId = result.insertId;

    // ✅ medias (sans mimetype)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const mediaType =
          file.mimetype.startsWith("image/") ? "photo"
          : file.mimetype.startsWith("video/") ? "video"
          : "pdf";

        await db.query(
          `INSERT INTO publication_medias
           (id_publication, type_media, url_media, nom_original, taille_fichier)
           VALUES (?, ?, ?, ?, ?)`,
          [
            publicationId,
            mediaType,
            file.path.replace(/\\/g, "/"),
            file.originalname,
            file.size
          ]
        );
      }
    }

    res.status(201).json({
      success: true,
      id_publication: publicationId
    });
  } catch (error) {
    console.error("❌ createPublication:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};


// ==========================================
// FEED: RÉCUPÉRER TOUTES LES PUBLICATIONS
// ==========================================
exports.getAllPublications = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id_publication,
        p.titre_publication,
        p.contenu_publication,
        p.date_publication,
        p.status_publication,
        p.type_publication,
        p.contenu,
        p.question_debat,
        u.id_user,
        u.nom_user,
        u.prenom_user,
        u.role,
        u.gouvernorat
      FROM publications p
      JOIN utilisateurs u ON u.id_user = p.user_id
      WHERE p.status_publication = 'publie'
      ORDER BY p.date_publication DESC
      LIMIT 20
    `);

    res.json(rows);
  } catch (error) {
    console.error("❌ getAllPublications:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// RÉACTION publication + NOTIFICATION
// ==========================================
exports.addReaction = async (req, res) => {
  try {
    const { id_publication, type_reaction } = req.body;
    const id_user = req.user.id_user;

    const validTypes = ["like", "love", "haha", "wow", "sad", "angry"];
    if (!validTypes.includes(type_reaction)) {
      return res.status(400).json({ message: "Type invalide" });
    }

    const [[pub]] = await db.query(
      "SELECT user_id FROM publications WHERE id_publication = ?",
      [id_publication]
    );
    if (!pub) return res.status(404).json({ message: "Publication introuvable" });

    const [[existing]] = await db.query(
      "SELECT * FROM publication_reactions WHERE id_publication = ? AND id_user = ?",
      [id_publication, id_user]
    );

    // toggle off
    if (existing && existing.type_reaction === type_reaction) {
      await db.query(
        "DELETE FROM publication_reactions WHERE id_publication = ? AND id_user = ?",
        [id_publication, id_user]
      );
      return res.json({ message: "Réaction supprimée" });
    }

    // update
    if (existing && existing.type_reaction !== type_reaction) {
      await db.query(
        "UPDATE publication_reactions SET type_reaction = ? WHERE id_publication = ? AND id_user = ?",
        [type_reaction, id_publication, id_user]
      );

      await createNotification({
        toUserId: pub.user_id,
        fromUserId: id_user,
        type: "publication_reaction",
        entityType: "publication",
        entityId: id_publication,
        message: "Quelqu'un a réagi à votre publication",
      });

      return res.json({ message: "Réaction mise à jour" });
    }

    // insert new
    await db.query(
      "INSERT INTO publication_reactions (id_publication, id_user, type_reaction) VALUES (?, ?, ?)",
      [id_publication, id_user, type_reaction]
    );

    await createNotification({
      toUserId: pub.user_id,
      fromUserId: id_user,
      type: "publication_reaction",
      entityType: "publication",
      entityId: id_publication,
      message: "Quelqu'un a réagi à votre publication",
    });

    res.json({ message: "Réaction ajoutée" });
  } catch (error) {
    console.error("❌ addReaction:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// COMMENTAIRE (pour/contre للـ débat) + NOTIF
// ==========================================
exports.addCommentaire = async (req, res) => {
  try {
    const { id_publication, contenu, parent_id, debat_side } = req.body;
    const id_user = req.user.id_user;

    if (!id_publication) return res.status(400).json({ message: "id_publication requis" });
    if (!contenu?.trim()) return res.status(400).json({ message: "Commentaire vide" });

    if (debat_side && !["pour", "contre"].includes(debat_side)) {
      return res.status(400).json({ message: "debat_side invalide" });
    }

    // إذا reply و ما عطاش side => ناخذ side متاع parent
    let finalSide = debat_side || null;
    if (parent_id && !debat_side) {
      const [[parentComment]] = await db.query(
        "SELECT debat_side FROM publication_commentaires WHERE id_commentaire = ?",
        [parent_id]
      );
      if (parentComment) finalSide = parentComment.debat_side;
    }

    const [result] = await db.query(
      `INSERT INTO publication_commentaires 
       (id_publication, id_user, contenu, parent_id, debat_side, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id_publication, id_user, contenu.trim(), parent_id || null, finalSide]
    );

    // notif لمالك publication
    const [[pub]] = await db.query(
      "SELECT user_id FROM publications WHERE id_publication = ?",
      [id_publication]
    );
    if (pub) {
      await createNotification({
        toUserId: pub.user_id,
        fromUserId: id_user,
        type: "publication_comment",
        entityType: "publication",
        entityId: id_publication,
        message: "Quelqu'un a commenté votre publication",
      });
    }

    res.status(201).json({ message: "Commentaire ajouté", id: result.insertId });
  } catch (error) {
    console.error("❌ addCommentaire:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// GET COMMENTAIRES (side optional)
// ?side=pour | ?side=contre | no side => all
// ==========================================
exports.getCommentaires = async (req, res) => {
  try {
    const { id } = req.params;
    const { side } = req.query;
    const userId = req.user.id_user;

    if (!id || isNaN(id)) return res.status(400).json({ message: "ID invalide" });

    let query = `
      SELECT 
        pc.*, 
        u.nom_user, 
        u.prenom_user,
        u.photo_user,

        COALESCE(SUM(CASE WHEN cr.type_reaction = 'like'  THEN 1 ELSE 0 END), 0) as likes,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'love'  THEN 1 ELSE 0 END), 0) as loves,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'haha'  THEN 1 ELSE 0 END), 0) as hahas,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'wow'   THEN 1 ELSE 0 END), 0) as wows,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'sad'   THEN 1 ELSE 0 END), 0) as sads,
        COALESCE(SUM(CASE WHEN cr.type_reaction = 'angry' THEN 1 ELSE 0 END), 0) as angrys,

        MAX(CASE WHEN cr.id_user = ? THEN cr.type_reaction END) as userReaction

      FROM publication_commentaires pc
      JOIN utilisateurs u ON pc.id_user = u.id_user
      LEFT JOIN commentaire_reactions cr ON pc.id_commentaire = cr.id_commentaire
      WHERE pc.id_publication = ?
    `;

    const params = [userId, id];

    if (side && ["pour", "contre"].includes(side)) {
      query += ` AND pc.debat_side = ?`;
      params.push(side);
    }

    query += ` GROUP BY pc.id_commentaire ORDER BY pc.created_at ASC`;

    const [comments] = await db.query(query, params);

    const formatted = comments.map((c) => ({
      ...c,
      reactions: [
        { type: "like", count: c.likes },
        { type: "love", count: c.loves },
        { type: "haha", count: c.hahas },
        { type: "wow", count: c.wows },
        { type: "sad", count: c.sads },
        { type: "angry", count: c.angrys },
      ],
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ getCommentaires:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.getOnePublication = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id_user || null;
    
    const [[pub]] = await db.query(
      `SELECT p.*, u.nom_user, u.prenom_user
       FROM publications p
       JOIN utilisateurs u ON p.user_id = u.id_user
       WHERE p.id_publication = ?`,
      [id]
    );
    if (!pub) return res.status(404).json({ message: "Introuvable" });
    
    // ✅ جيب الـ medias
    const [medias] = await db.query(
      "SELECT * FROM publication_medias WHERE id_publication = ?",
      [id]
    );
    pub.medias = medias;
    
    res.json(pub);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// VOTE DÉBAT + NOTIF (في البلاصة الصحيحة)
// ==========================================
exports.voteDebat = async (req, res) => {
  try {
    const { id_publication, position } = req.body;
    const id_user = req.user.id_user;

    if (!["pour", "contre"].includes(position)) {
      return res.status(400).json({ message: "Position invalide" });
    }

    const [[pub]] = await db.query(
      "SELECT user_id FROM publications WHERE id_publication = ?",
      [id_publication]
    );
    if (!pub) return res.status(404).json({ message: "Publication introuvable" });

    const [[existing]] = await db.query(
      "SELECT * FROM debat_positions WHERE id_publication = ? AND id_user = ?",
      [id_publication, id_user]
    );

    if (existing) {
      if (existing.position === position) {
        await db.query(
          "DELETE FROM debat_positions WHERE id_publication = ? AND id_user = ?",
          [id_publication, id_user]
        );
        return res.json({ message: "Vote retiré" });
      }

      await db.query(
        "UPDATE debat_positions SET position = ? WHERE id_publication = ? AND id_user = ?",
        [position, id_publication, id_user]
      );

      await createNotification({
        toUserId: pub.user_id,
        fromUserId: id_user,
        type: "debat_vote",
        entityType: "publication",
        entityId: id_publication,
        message: "Quelqu'un a voté sur votre débat",
      });

      return res.json({ message: "Vote modifié" });
    }

    await db.query(
      "INSERT INTO debat_positions (id_publication, id_user, position) VALUES (?, ?, ?)",
      [id_publication, id_user, position]
    );

    await createNotification({
        toUserId: pub.user_id,
      fromUserId: id_user,
      type: "debat_vote",
      entityType: "publication",
      entityId: id_publication,
      message: "Quelqu'un a voté sur votre débat",
    });

    res.json({ message: "Vote enregistré" });
  } catch (error) {
    console.error("❌ voteDebat:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// RÉACTION COMMENTAIRE
// ==========================================
exports.addCommentReaction = async (req, res) => {
  try {
    const { id_commentaire, type_reaction } = req.body;
    const id_user = req.user.id_user;

    const validTypes = ["like", "love", "haha", "wow", "sad", "angry"];
    if (!validTypes.includes(type_reaction)) {
      return res.status(400).json({ message: "Type invalide" });
    }

    const [[comment]] = await db.query(
      "SELECT id_user, id_publication FROM publication_commentaires WHERE id_commentaire = ?",
      [id_commentaire]
    );
    if (!comment) return res.status(404).json({ message: "Commentaire introuvable" });

    const [[existing]] = await db.query(
      "SELECT * FROM commentaire_reactions WHERE id_commentaire = ? AND id_user = ?",
      [id_commentaire, id_user]
    );

    if (existing && existing.type_reaction === type_reaction) {
      await db.query(
        "DELETE FROM commentaire_reactions WHERE id_commentaire = ? AND id_user = ?",
        [id_commentaire, id_user]
      );
      return res.json({ message: "Réaction supprimée" });
    }

    if (existing && existing.type_reaction !== type_reaction) {
      await db.query(
        "UPDATE commentaire_reactions SET type_reaction = ? WHERE id_commentaire = ? AND id_user = ?",
        [type_reaction, id_commentaire, id_user]
      );

      await createNotification({
        toUserId: comment.id_user,
        fromUserId: id_user,
        type: "comment_reaction",
        entityType: "commentaire",
        entityId: id_commentaire,
        message: "Quelqu'un a réagi à votre commentaire",
      });

      return res.json({ message: "Réaction mise à jour" });
    }

    await db.query(
      "INSERT INTO commentaire_reactions (id_commentaire, id_user, type_reaction) VALUES (?, ?, ?)",
      [id_commentaire, id_user, type_reaction]
    );

    await createNotification({
      toUserId: comment.id_user,
      fromUserId: id_user,
      type: "comment_reaction",
      entityType: "commentaire",
      entityId: id_commentaire,
      message: "Quelqu'un a réagi à votre commentaire",
    });

    res.json({ message: "Réaction ajoutée" });
  } catch (error) {
    console.error("❌ addCommentReaction:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ==========================================
// SUPPRIMER
// ==========================================
exports.deletePublication = async (req, res) => {
  try {
    const id_user = req.user.id_user;

    const [[pub]] = await db.query(
      "SELECT * FROM publications WHERE id_publication = ?",
      [req.params.id]
    );

    if (!pub) return res.status(404).json({ message: "Introuvable" });

    if (pub.user_id !== id_user && req.user.role !== "admin") {
      return res.status(403).json({ message: "Non autorisé" });
    }

    await db.query("DELETE FROM publications WHERE id_publication = ?", [req.params.id]);
    res.json({ message: "Supprimé" });
  } catch (error) {
    console.error("❌ deletePublication:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
module.exports = {
  createPublication: exports.createPublication,
  getAllPublications: exports.getAllPublications,
  addReaction: exports.addReaction,
  addCommentaire: exports.addCommentaire,
  getCommentaires: exports.getCommentaires,
  getOnePublication: exports.getOnePublication,
  voteDebat: exports.voteDebat,
  addCommentReaction: exports.addCommentReaction,
  deletePublication: exports.deletePublication
};