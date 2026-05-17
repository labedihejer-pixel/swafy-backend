console.log("✅ PublicationRoutes LOADED");// routes/PublicationRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const adminId = 286;
// ===============================
// ✅ Setup multer
// ===============================
const uploadsDir = path.join(__dirname, "../uploads/publications");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "video/mp4",
      "video/quicktime",
    ];
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

// ===============================
// Helpers
// ===============================
const normalizeType = (t) => {
  const typeMap = {
    text: "texte",
    texte: "texte",

    image: "photo",
    photo: "photo",

    video: "video",

    pdf: "pdf",

    debat: "debat",
  };

  return typeMap[String(t).toLowerCase()] || "texte";
};

const buildReactionsObject = (rows) => {
  const reactions = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
  for (const r of rows || []) {
    reactions[r.type_reaction] = Number(r.cnt) || 0;
  }
  return reactions;
};

const safeDiskPathFromUrlMedia = (url_media) => {
  // url_media example: "/uploads/publications/xxx.png"
  const rel = String(url_media || "").replace(/^\/+/, ""); // remove leading "/"
  return path.join(__dirname, "..", rel);
};

// ===============================
// 📋 GET /publications/public
// ===============================
router.get("/public", async (req, res) => {
  try {
    const [publications] = await db.query(`
      SELECT
        p.id_publication,
        p.user_id,
        p.titre_publication,
        p.contenu,
        p.type_publication,
        p.created_at,
        p.updated_at,
        p.status_publication,
        u.nom_user,
        u.prenom_user,
        (SELECT COUNT(*) FROM publication_commentaires pc WHERE pc.id_publication = p.id_publication) AS comments_count,
        (SELECT COUNT(*) FROM publication_reactions pr WHERE pr.id_publication = p.id_publication) AS reactions_count
      FROM publications p
      LEFT JOIN utilisateurs u ON p.user_id = u.id_user
      WHERE p.status_publication != 'supprime'
      ORDER BY p.updated_at DESC

    `);

    res.json(publications || []);
  } catch (err) {
    console.error("❌ GET /publications/public error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📋 GET /publications (auth)
// ===============================
router.get("/", verifyToken, async (req, res) => {
  try {
    const [publications] = await db.query(
      `SELECT 
        p.id_publication,
        p.user_id,
        p.titre_publication,
        p.contenu,
        p.type_publication,
        p.created_at,
        p.updated_at,
        p.status_publication,
        u.nom_user,
        u.prenom_user,
        (SELECT COUNT(*) FROM publication_commentaires pc WHERE pc.id_publication = p.id_publication) AS comments_count,
        (SELECT COUNT(*) FROM publication_reactions pr WHERE pr.id_publication = p.id_publication) AS reactions_count
      FROM publications p
      LEFT JOIN utilisateurs u ON p.user_id = u.id_user
      WHERE p.status_publication != 'supprime'
      ORDER BY p.updated_at DESC `
    );

    const withData = await Promise.all(
      (publications || []).map(async (pub) => {
        const [medias] = await db.query(
          `SELECT id_media, type_media, url_media, nom_original
           FROM publication_medias
           WHERE id_publication = ?`,
          [pub.id_publication]
        );

        const [reacRows] = await db.query(
          `SELECT type_reaction, COUNT(*) cnt
           FROM publication_reactions
           WHERE id_publication = ?
           GROUP BY type_reaction`,
          [pub.id_publication]
        );

        return {
          ...pub,
          medias: medias || [],
          reactions: buildReactionsObject(reacRows),
        };
      })
    );

    res.json(withData);
  } catch (err) {
    console.error("❌ GET /publications error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📝 POST /publications (create)
// supports multipart (files[]) + also supports body "contenu" coming from frontend
// ===============================
router.post("/", verifyToken, upload.array("files", 10), async (req, res) => {
  console.log("🔥🔥🔥 POST /publications HIT 🔥🔥🔥");
  console.log("🔥 POST /publications — NEW CODE RUNNING"); 
  
  console.log("🚀 BEFORE INSERT NOTIF");
  try {
    const userId = req.user.id_user;
    console.log("🚀 INSERTING NOTIF...");

    const {
      titre_publication,
      contenu_publication,
      contenu,
      type_publication = "texte",
      question_debat,
    } = req.body;

    const finalType = normalizeType(type_publication);

    let finalTitle = (titre_publication || "").trim();
    let finalContent = (contenu_publication ?? contenu ?? "").trim();

    if (finalType === "debat" && question_debat?.trim()) {
      finalTitle = question_debat.trim();
    }

    const hasFiles = req.files && req.files.length > 0;
    if (!finalTitle && !finalContent && !hasFiles) {
      return res.status(400).json({ error: "Write something or upload a file" });
    }

    
    console.log("✅ USER FROM TOKEN:", userId);

    const [result] = await db.query(
  `INSERT INTO publications
   (
     user_id,
     titre_publication,
     contenu,
     type_publication,
     created_at,
     status_publication
   )
   VALUES (?, ?, ?, ?, NOW(), ?)`,
  [
    userId,
    finalTitle || null,
    finalContent || "",
    finalType,
    "publie"
  ]
);
    
    console.log("RESULT INSERT:", result);
    const publicationId = result?.insertId || result?.[0]?.insertId;
    const notifMessage = "📢 Nouvelle publication ajoutée";
    console.log("publicationId FIXED:", publicationId);
    console.log("VALUES TEST:", userId, publicationId);
    


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
      jeune.id_user, 
      userId,         
      "new_post",
      "publication",
      publicationId,
      notifMessage,
    ]
  );
}


console.log(" notification admin créée ");
    //  INSERT medias
    if (hasFiles) {
      for (const file of req.files) {
        let mediaType = "photo";
        if (file.mimetype.startsWith("image/")) mediaType = "photo";
        else if (file.mimetype.startsWith("video/")) mediaType = "video";
        else if (file.mimetype === "application/pdf") mediaType = "pdf";

        const urlMedia = `/uploads/publications/${file.filename}`;

        await db.query(
          `INSERT INTO publication_medias 
           (id_publication, type_media, url_media, nom_original, taille_fichier, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [publicationId, mediaType, urlMedia, file.originalname, file.size]
        );
      }
    }
  
    // ✅ Return
    const [[pub]] = await db.query(
      `SELECT p.*, u.nom_user, u.prenom_user
       FROM publications p
       LEFT JOIN utilisateurs u ON p.user_id = u.id_user
       WHERE p.id_publication = ?`,
      [publicationId]
    );

    const [medias] = await db.query(
      `SELECT id_media, type_media, url_media, nom_original
       FROM publication_medias WHERE id_publication = ?`,
      [publicationId]
    );

    res.status(201).json({
      ...pub,
      medias: medias || [],
      comments_count: 0,
      reactions_count: 0,
      reactions: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
    });
 
} catch (err) {
  console.error("🔥 FULL ERROR:", err);
  res.status(500).json({ error: err.message });
}

});
// ===============================
// 💬 POST /publications/:id/comments
// ===============================
router.post("/:id/comments", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;
    const { contenu_commentaire, type_commentaire = "texte" } = req.body;

    if (!contenu_commentaire?.trim()) {
      return res.status(400).json({ error: "Comment required" });
    }

 const [result] = await db.query(
  `INSERT INTO publication_commentaires
   (
     id_publication,
     id_user,
     contenu,
     type_commentaire,
     statut_commentaire,
     created_at
   )
   VALUES (?, ?, ?, ?, 'visible', NOW())`,
  [
    id,
    userId,
    contenu_commentaire.trim(),
    type_commentaire,
  ]
);

    const [[comment]] = await db.query(
      `SELECT 
        pc.id_commentaire,
        pc.id_publication,
        pc.id_user,
        pc.contenu,
        pc.type_commentaire,
        pc.created_at,
        u.nom_user,
        u.prenom_user
       FROM publication_commentaires pc
       LEFT JOIN utilisateurs u ON pc.id_user = u.id_user
       WHERE pc.id_commentaire = ?`,
      [result.insertId]
    );

    res.status(201).json(comment);
  } catch (err) {
    console.error("❌ POST /:id/comments error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📝 GET /publications/:id/comments
// ===============================
router.get("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;

    const [comments] = await db.query(
      `SELECT 
        pc.id_commentaire,
        pc.id_publication,
        pc.id_user,
        pc.contenu,
        pc.type_commentaire,
        pc.created_at,
        u.nom_user,
        u.prenom_user
       FROM publication_commentaires pc
       LEFT JOIN utilisateurs u ON pc.id_user = u.id_user
       WHERE pc.id_publication = ?
       ORDER BY pc.created_at DESC`,
      [id]
    );

    res.json(comments || []);
  } catch (err) {
    console.error("❌ GET /:id/comments error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


router.post("/:id/reactions", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    
    const pubId = req.params.id;
    const { type_reaction } = req.body;

    const allowed = ["like", "love", "haha", "wow", "sad", "angry"];
    if (!allowed.includes(type_reaction)) {
      return res.status(400).json({ error: "Invalid reaction type" });
    }

    const [existing] = await db.query(
      `SELECT type_reaction 
       FROM publication_reactions
       WHERE id_publication = ? AND id_user = ?`,
      [pubId, userId]
    );

    let reacted = true;

    if (existing.length > 0 && existing[0].type_reaction === type_reaction) {
      // toggle off
      await db.query(
        `DELETE FROM publication_reactions
         WHERE id_publication = ? AND id_user = ?`,
        [pubId, userId]
      );
      reacted = false;
    } else {
      // upsert
      await db.query(
        `INSERT INTO publication_reactions (id_publication, id_user, type_reaction, created_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE type_reaction = VALUES(type_reaction)`,
        [pubId, userId, type_reaction]
      );
    }

    const [[cntRow]] = await db.query(
      `SELECT COUNT(*) cnt FROM publication_reactions WHERE id_publication = ?`,
      [pubId]
    );

    const [breakdownRows] = await db.query(
      `SELECT type_reaction, COUNT(*) cnt
       FROM publication_reactions
       WHERE id_publication = ?
       GROUP BY type_reaction`,
      [pubId]
    );

    res.json({
      reacted,
      reactions_count: Number(cntRow.cnt) || 0,
      reactions: buildReactionsObject(breakdownRows),
    });
  } catch (err) {
    console.error("❌ POST /:id/reactions error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📄 GET /publications/:id (detail)
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [[pub]] = await db.query(
      `SELECT 
        p.id_publication,
        p.user_id,
        p.titre_publication,
        p.contenu,
        p.type_publication,
       
        p.status_publication,
        u.nom_user,
        u.prenom_user,
        (SELECT COUNT(*) FROM publication_commentaires pc WHERE pc.id_publication = p.id_publication) AS comments_count,
        (SELECT COUNT(*) FROM publication_reactions pr WHERE pr.id_publication = p.id_publication) AS reactions_count
      FROM publications p
      LEFT JOIN utilisateurs u ON p.user_id = u.id_user
      WHERE p.id_publication = ? AND p.status_publication != 'supprime'`,
      [id]
    );

    if (!pub) return res.status(404).json({ error: "Publication introuvable" });
    const [medias] = await db.query(
      `SELECT id_media, type_media, url_media, nom_original
       FROM publication_medias
       WHERE id_publication = ?`,
      [id]
    );

    const [reacRows] = await db.query(
      `SELECT type_reaction, COUNT(*) cnt
       FROM publication_reactions
       WHERE id_publication = ?
       GROUP BY type_reaction`,
      [id]
    );

    res.json({
      ...pub,
      medias: medias || [],
      reactions: buildReactionsObject(reacRows),
    });
  } catch (err) {
    console.error("❌ GET /:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
//  PUT /publications/:id
// ===============================
router.put("/:id", verifyToken, upload.array("files", 10), async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;

    const {
      titre_publication,
      contenu_publication,
      contenu,
      type_publication,
      question_debat,
    } = req.body;

    const [existingRows] = await db.query(
      "SELECT * FROM publications WHERE id_publication = ?",
      [id]
    );
    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const existing = existingRows[0];
    if (Number(existing.user_id) !== Number(userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const finalType = type_publication
      ? normalizeType(type_publication)
      : existing.type_publication;

    let newTitle = (titre_publication ?? existing.titre_publication ?? "").trim();
     let newContent = (contenu_publication ?? contenu ?? existing.contenu ?? "").trim();

    if (finalType === "debat" && question_debat?.trim()) {
      newTitle = question_debat.trim();
    }

    await db.query(
      `UPDATE publications 
       SET titre_publication = ?, contenu = ?, type_publication = ?, updated_at = NOW()
       WHERE id_publication = ?`,
      [newTitle || null, newContent || "", finalType, id]
    );

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let mediaType = "photo";
        if (file.mimetype.startsWith("image/")) mediaType = "photo";
        else if (file.mimetype.startsWith("video/")) mediaType = "video";
        else if (file.mimetype === "application/pdf") mediaType = "pdf";

        const urlMedia = `/uploads/publications/${file.filename}`;

        await db.query(
          `INSERT INTO publication_medias
           (id_publication, type_media, url_media, nom_original, taille_fichier, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, mediaType, urlMedia, file.originalname, file.size]
        );
      }
    }

    res.json({ message: "Updated" });
  } catch (err) {
    console.error("❌ PUT /:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
//  DELETE /publications/:id (soft delete + remove files)
// ===============================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;

    const [pubRows] = await db.query(
      "SELECT * FROM publications WHERE id_publication = ?",
      [id]
    );
    if (!pubRows || pubRows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const pub = pubRows[0];
    if (Number(pub.user_id) !== Number(userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const [medias] = await db.query(
      "SELECT url_media FROM publication_medias WHERE id_publication = ?",
      [id]
    );

    for (const media of medias || []) {
      try {
        const filePath = safeDiskPathFromUrlMedia(media.url_media);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        // ignore file errors, keep soft delete
        console.warn("⚠️ Failed deleting media:", media.url_media, e.message);
      }
    }

    await db.query(
      `UPDATE publications 
       SET status_publication = 'supprime', updated_at = NOW()
       WHERE id_publication = ?`,
      [id]
    );

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ DELETE /:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;