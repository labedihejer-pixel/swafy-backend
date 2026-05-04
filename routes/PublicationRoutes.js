const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ Setup multer
const uploadsDir = path.join(__dirname, "../uploads/publications");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
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
      "application/pdf",
      "video/mp4",
      "video/quicktime",
      "text/plain",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// ===============================
// 📋 GET /publications/public - List public publications
// ===============================
router.get("/public", async (req, res) => {
  try {
    console.log("📋 GET /publications/public called");

    const [publications] = await db.query(
      `SELECT 
        p.id_publication,
        p.user_id,
        p.titre_publication,
        p.contenu_publication,
        p.type_publication,
        p.date_publication,
        p.status_publication,
        u.nom_user,
        u.prenom_user,
        (SELECT COUNT(*) FROM publication_medias pm WHERE pm.id_publication = p.id_publication) as media_count,
        (SELECT COUNT(*) FROM publication_commentaires pc WHERE pc.id_publication = p.id_publication AND pc.statut_commentaire = 'visible') as comments_count,
        (SELECT COUNT(*) FROM commentaire_reactions cr WHERE cr.id_publication = p.id_publication) as reactions_count
      FROM publications p
      LEFT JOIN utilisateurs u ON p.user_id = u.id_user
      WHERE p.status_publication = 'publie'
      ORDER BY p.date_publication DESC
      LIMIT 50`
    );

    console.log(`✅ Found ${publications?.length || 0} public publications`);

    // ✅ Get media for each publication
    const publicationsWithMedia = await Promise.all(
      (publications || []).map(async (pub) => {
        const [medias] = await db.query(
          `SELECT id_media, type_media, url_media, nom_original
           FROM publication_medias
           WHERE id_publication = ?`,
          [pub.id_publication]
        );

        return {
          ...pub,
          medias: medias || [],
        };
      })
    );

    res.json(publicationsWithMedia);
  } catch (err) {
    console.error("❌ GET /publications/public error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📋 GET /publications - All publications (auth required)
// ===============================
router.get("/", verifyToken, async (req, res) => {
  try {
    console.log("📋 GET /publications called");

    const [publications] = await db.query(
      `SELECT 
        p.id_publication,
        p.user_id,
        p.titre_publication,
        p.contenu_publication,
        p.type_publication,
        p.date_publication,
        p.status_publication,
        u.nom_user,
        u.prenom_user,
        (SELECT COUNT(*) FROM publication_medias WHERE id_publication = p.id_publication) as media_count,
        (SELECT COUNT(*) FROM publication_commentaires WHERE id_publication = p.id_publication AND statut_commentaire = 'visible') as comments_count
      FROM publications p
      LEFT JOIN utilisateurs u ON p.user_id = u.id_user
      WHERE p.status_publication != 'supprime'
      ORDER BY p.date_publication DESC
      LIMIT 100`
    );

    console.log(`✅ Found ${publications?.length || 0} publications`);

    // ✅ Get media for each publication
    const publicationsWithMedia = await Promise.all(
      (publications || []).map(async (pub) => {
        const [medias] = await db.query(
          `SELECT id_media, type_media, url_media, nom_original
           FROM publication_medias
           WHERE id_publication = ?`,
          [pub.id_publication]
        );

        return {
          ...pub,
          medias: medias || [],
        };
      })
    );

    res.json(publicationsWithMedia);
  } catch (err) {
    console.error("❌ GET /publications error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📝 POST /publications - Create publication
// ===============================
router.post("/", verifyToken, upload.array("files", 10), async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { titre_publication, contenu_publication, type_publication = "texte" } = req.body;

    console.log("📝 POST /publications called:", {
      userId,
      titre: titre_publication?.substring(0, 30),
      type: type_publication,
      files: req.files?.length || 0,
    });

    // ✅ Validation
    if (!titre_publication || !titre_publication.trim()) {
      console.warn("⚠️ Title missing");
      return res.status(400).json({ message: "Title is required" });
    }

    // ✅ Map type
    const typeMap = {
      text: "texte",
      image: "photo",
      video: "video",
      pdf: "pdf",
      texte: "texte",
      photo: "photo",
      debat: "debat",
    };

    const finalType = typeMap[type_publication] || "texte";

    // ✅ Insert publication
    const [result] = await db.query(
      `INSERT INTO publications 
       (user_id, titre_publication, contenu_publication, type_publication, date_publication, status_publication)
       VALUES (?, ?, ?, ?, NOW(), 'publie')`,
      [
        userId,
        titre_publication.trim(),
        contenu_publication?.trim() || "",
        finalType,
      ]
    );

    const publicationId = result.insertId;
    console.log("✅ Publication created:", publicationId);

    // ✅ Handle file uploads
    if (req.files && req.files.length > 0) {
      console.log(`📎 Processing ${req.files.length} files...`);

      for (const file of req.files) {
        try {
          const mimeType = file.mimetype;
          let mediaType = "photo";

          if (mimeType.startsWith("image/")) mediaType = "photo";
          else if (mimeType.startsWith("video/")) mediaType = "video";
          else if (mimeType === "application/pdf") mediaType = "pdf";

          const urlMedia = `/uploads/publications/${file.filename}`;

          await db.query(
            `INSERT INTO publication_medias 
             (id_publication, type_media, url_media, nom_original, taille_fichier, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [publicationId, mediaType, urlMedia, file.originalname, file.size]
          );

          console.log(`✅ Media added: ${urlMedia} (${mediaType})`);
        } catch (fileErr) {
          console.error(`❌ Error adding media file:`, fileErr);
        }
      }
    }

    // ✅ Get created publication with media
    const [publication] = await db.query(
      `SELECT 
        id_publication,
        user_id,
        titre_publication,
        contenu_publication,
        type_publication,
        date_publication
      FROM publications
      WHERE id_publication = ?`,
      [publicationId]
    );

    const [medias] = await db.query(
      `SELECT id_media, type_media, url_media, nom_original
       FROM publication_medias
       WHERE id_publication = ?`,
      [publicationId]
    );

    console.log("✅ Publication created successfully");

    res.status(201).json({
      ...publication[0],
      medias: medias || [],
    });
  } catch (err) {
    console.error("❌ POST /publications error:", {
      message: err.message,
      code: err.code,
      sqlMessage: err.sqlMessage,
    });

    res.status(500).json({
      error: "Failed to create publication",
      message: err.message,
    });
  }
});

// ===============================
// ✏️ PUT /publications/:id - Update publication
// ===============================
router.put("/:id", verifyToken, upload.array("files", 10), async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;
    const { titre_publication, contenu_publication, type_publication } = req.body;

    console.log("✏️ PUT /publications/:id called:", { userId, id });

    // ✅ Get existing publication
    const [existing] = await db.query(
      "SELECT * FROM publications WHERE id_publication = ?",
      [id]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: "Publication not found" });
    }

    // ✅ Check ownership
    if (Number(existing[0].user_id) !== Number(userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ✅ Update publication
    await db.query(
      `UPDATE publications 
       SET titre_publication = ?, contenu_publication = ?, type_publication = ?, updated_at = NOW()
       WHERE id_publication = ?`,
      [
        titre_publication?.trim() || existing[0].titre_publication,
        contenu_publication?.trim() || existing[0].contenu_publication,
        type_publication || existing[0].type_publication,
        id,
      ]
    );

    // ✅ Handle new files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const mimeType = file.mimetype;
        let mediaType = "photo";

        if (mimeType.startsWith("image/")) mediaType = "photo";
        else if (mimeType.startsWith("video/")) mediaType = "video";
        else if (mimeType === "application/pdf") mediaType = "pdf";

        const urlMedia = `/uploads/publications/${file.filename}`;

        await db.query(
          `INSERT INTO publication_medias 
           (id_publication, type_media, url_media, nom_original, taille_fichier, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [id, mediaType, urlMedia, file.originalname, file.size]
        );
      }
    }

    console.log("✅ Publication updated:", id);

    res.json({ message: "Publication updated successfully" });
  } catch (err) {
    console.error("❌ PUT /publications/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 🗑️ DELETE /publications/:id - Delete publication
// ===============================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;

    console.log("🗑️ DELETE /publications/:id called:", { userId, id });

    // ✅ Get publication
    const [publication] = await db.query(
      "SELECT * FROM publications WHERE id_publication = ?",
      [id]
    );

    if (!publication || publication.length === 0) {
      return res.status(404).json({ message: "Publication not found" });
    }

    // ✅ Check ownership
    if (Number(publication[0].user_id) !== Number(userId)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ✅ Delete media files
    const [medias] = await db.query(
      "SELECT url_media FROM publication_medias WHERE id_publication = ?",
      [id]
    );

    for (const media of medias || []) {
      const filePath = path.join(__dirname, "..", media.url_media);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // ✅ Update status to supprime
    await db.query(
      "UPDATE publications SET status_publication = 'supprime', updated_at = NOW() WHERE id_publication = ?",
      [id]
    );

    console.log("✅ Publication deleted:", id);

    res.json({ message: "Publication deleted successfully" });
  } catch (err) {
    console.error("❌ DELETE /publications/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 💬 POST /publications/:id/comments - Add comment
// ===============================
router.post("/:id/comments", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;
    const { contenu_commentaire, type_commentaire = "texte" } = req.body;

    console.log("💬 POST /comments called:", { userId, id, type: type_commentaire });

    if (!contenu_commentaire || !contenu_commentaire.trim()) {
      return res.status(400).json({ message: "Comment content required" });
    }

    // ✅ Insert comment
    const [result] = await db.query(
      `INSERT INTO publication_commentaires 
       (id_publication, id_user, contenu, type_commentaire, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, userId, contenu_commentaire.trim(), type_commentaire]
    );

    console.log("✅ Comment added:", result.insertId);

    // ✅ Get the created comment with user info
    const [comment] = await db.query(
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

    res.status(201).json(comment[0]);
  } catch (err) {
    console.error("❌ POST /comments error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 📝 GET /publications/:id/comments - Get all comments
// ===============================
router.get("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;

    console.log("📝 GET /:id/comments called:", { id });

    const [comments] = await db.query(
      `SELECT 
        pc.id_commentaire,
        pc.id_publication,
        pc.id_user,
        pc.contenu,
        pc.type_commentaire,
        pc.created_at,
        u.nom_user,
        u.prenom_user,
        (SELECT COUNT(*) FROM commentaire_reactions cr WHERE cr.id_commentaire = pc.id_commentaire) as reactions_count
      FROM publication_commentaires pc
      LEFT JOIN utilisateurs u ON pc.id_user = u.id_user
      WHERE pc.id_publication = ? AND pc.statut_commentaire = 'visible'
      ORDER BY pc.created_at DESC`,
      [id]
    );

    console.log(`✅ Found ${comments?.length || 0} comments`);

    res.json(comments || []);
  } catch (err) {
    console.error("❌ GET /comments error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// 👍 POST /publications/:id/reactions - Add reaction
// ===============================
router.post("/:id/reactions", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;
    const { reaction_type = "like" } = req.body;

    console.log("👍 POST /reactions called:", { userId, id, reaction: reaction_type });

    // ✅ Check if already reacted
    const [existing] = await db.query(
      `SELECT * FROM commentaire_reactions 
       WHERE id_publication = ? AND user_id = ?`,
      [id, userId]
    );

    if (existing && existing.length > 0) {
      // ✅ Remove reaction
      await db.query(
        `DELETE FROM commentaire_reactions 
         WHERE id_publication = ? AND user_id = ?`,
        [id, userId]
      );

      console.log("✅ Reaction removed");
      return res.json({ message: "Reaction removed", reacted: false });
    }

    // ✅ Add reaction
    await db.query(
      `INSERT INTO commentaire_reactions 
       (id_publication, user_id, reaction_type, created_at)
       VALUES (?, ?, ?, NOW())`,
      [id, userId, reaction_type]
    );

    console.log("✅ Reaction added");

    res.json({ message: "Reaction added", reacted: true });
  } catch (err) {
    console.error("❌ POST /reactions error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;