const db = require("../config/db");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary").v2;

// GET /api/profile/me
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id_user || req.user.id;
    if (!userId) {
      return res.status(401).json({ message: "Utilisateur non identifié" });
    }

    const [rows] = await db.query(
      `SELECT id_user, nom_user, prenom_user, email_user, telephone_user,
       TIMESTAMPDIFF(YEAR, date_naissance, CURDATE()) AS age,
       sexe, statut, etablissement, gouvernorat,
       delegation, ville, photo_user, role, status_user, created_at
       FROM utilisateurs
       WHERE id_user = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Profil introuvable" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("getMyProfile error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// GET /api/profile/:id
// GET /api/profile/:id
const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT id_user, nom_user, prenom_user, email_user, telephone_user,
       TIMESTAMPDIFF(YEAR, date_naissance, CURDATE()) AS age,
       sexe, statut, etablissement, gouvernorat,
       delegation, ville, photo_user
       FROM utilisateurs
       WHERE id_user = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Profil introuvable" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("getUserProfile error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

// GET /api/profile/:id/publications
const getUserPublications = async (req, res) => {
  try {
    const { id } = req.params;

    const [publications] = await db.query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM publication_reactions r 
         WHERE r.id_publication = p.id_publication AND r.type_reaction = 'like') AS nb_likes,
        (SELECT COUNT(*) FROM publication_reactions r 
         WHERE r.id_publication = p.id_publication AND r.type_reaction = 'love') AS nb_loves,
        (SELECT COUNT(*) FROM publication_commentaires c 
         WHERE c.id_publication = p.id_publication) AS nb_comments
       FROM publications p
       WHERE p.user_id = ?
       ORDER BY p.date_publication DESC`,
      [id]
    );

    const publicationsWithMedias = await Promise.all(
      publications.map(async (pub) => {
        const [medias] = await db.query(
          "SELECT * FROM publication_medias WHERE id_publication = ?",
          [pub.id_publication]
        );
        return { ...pub, medias };
      })
    );

    res.json(publicationsWithMedias);
  } catch (err) {
    console.error("getUserPublications error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};


// PUT /api/profile/update
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id_user || req.user.id;
    const data = req.body;

    const allowedFields = [
      "nom_user", "prenom_user", "email_user", "telephone_user",
      "sexe", "statut", "etablissement", "gouvernorat",
      "delegation", "ville"
    ];

    const updates = [];
    const values = [];

    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(data[key]);
      }
    });

    if (!updates.length) {
      return res.status(400).json({ message: "Aucune donnée à modifier" });
    }

    values.push(userId);

    await db.query(
      `UPDATE utilisateurs SET ${updates.join(", ")} WHERE id_user = ?`,
      values
    );

    const [updated] = await db.query(
      "SELECT * FROM utilisateurs WHERE id_user = ?",
      [userId]
    );

    res.json({ message: "✅ Profil mis à jour !", user: updated[0] });
  } catch (error) {
    console.error("updateMyProfile error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
};


// PUT /api/profile/avatar
const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id_user || req.user.id;

    if (!req.file) return res.status(400).json({ message: "Aucun fichier envoyé" });

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "swafy/avatars" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const photoUrl = result.secure_url;

   await db.query(
  "UPDATE utilisateurs SET photo_user = ? WHERE id_user = ?",
  [photoUrl, userId]
);


    res.json({ message: "✅ Avatar mis à jour !", photo_user: photoUrl });
  } catch (error) {
    console.error("uploadAvatar error:", error);
    res.status(500).json({ error: "Erreur upload avatar" });
  }
};
// PUT /api/profile/change-password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id_user || req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Mot de passe requis" });
    }

    const [rows] = await db.query(
      "SELECT mot_de_passe_user FROM utilisateurs WHERE id_user = ?",
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.mot_de_passe_user);
    if (!isMatch) {
      return res.status(400).json({ message: "❌ Mot de passe actuel incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query(
      "UPDATE utilisateurs SET mot_de_passe_user = ? WHERE id_user = ?",
      [hashed, userId]
    );

    res.json({ message: "✅ Mot de passe changé avec succès !" });
  } catch (error) {
    console.error("changePassword error:", error);
    res.status(500).json({ error: "Erreur changement mot de passe" });
  }
};


module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  changePassword,
  getUserProfile,
  getUserPublications,
};