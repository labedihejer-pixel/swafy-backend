const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

// ════════════════════════════════════════
// ✅ Compter le nombre de jeunes (utilisateurs)
// ════════════════════════════════════════
router.get("/count/jeune", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT COUNT(*) AS count FROM utilisateurs WHERE role = 'jeune'"
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error("count jeune error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ════════════════════════════════════════
// ✅ Compter tous les utilisateurs
// ════════════════════════════════════════
router.get("/count/all", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT COUNT(*) AS count FROM utilisateurs"
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ════════════════════════════════════════
// ✅ Compter les jeunes ayant un profil complet
// ════════════════════════════════════════
router.get("/count/jeune-profiles", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS count 
       FROM jeune_profiles j
       INNER JOIN utilisateurs u ON u.id_user = j.user_id
       WHERE u.role = 'jeune'`
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error("count jeune-profiles error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ════════════════════════════════════════
// ✅ Liste des utilisateurs (admin only)
// ════════════════════════════════════════
router.get("/list", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id_user, nom_user, email_user, role, status_user, gouvernorat 
       FROM utilisateurs 
       ORDER BY id_user DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ════════════════════════════════════════
// ✅ Liste des jeunes avec leur profil (pour Live)
// ════════════════════════════════════════
router.get("/jeunes-profiles", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT 
         u.id_user,
         u.nom_user,
         u.email_user,
         u.gouvernorat,
         j.id_profile,
         j.ville_jeune,
         j.delegation_jeune,
         j.etablissement,
         j.age,
         j.statut
       FROM utilisateurs u
       INNER JOIN jeune_profiles j ON j.user_id = u.id_user
       WHERE u.role = 'jeune'
       ORDER BY u.id_user DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("jeunes-profiles error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ════════════════════════════════════════
// ✅ Récupérer un utilisateur par ID
// ════════════════════════════════════════
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT id_user, nom_user, email_user, role, gouvernorat 
       FROM utilisateurs 
       WHERE id_user = ?`,
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ message: "Utilisateur introuvable" });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

module.exports = router;