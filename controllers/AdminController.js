const db = require("../config/db");

// ✅ 1. Get all JEUNES
const getAllJeunes = async (req, res) => {
  try {
    const query = `
      SELECT u.id_user, u.nom_user, u.prenom_user, u.email_user, u.status_user, u.created_at,
             jp.age, jp.gouvernorat_jeune, jp.etablissement
      FROM utilisateurs u
      LEFT JOIN jeune_profiles jp ON u.id_user = jp.user_id
      WHERE u.role = 'jeune'
      ORDER BY u.created_at DESC
    `;
    const [results] = await db.query(query);
    res.json(results);
  } catch (err) {
    console.error("Erreur getAllJeunes:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ✅ 2. Approve user
const approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      "UPDATE utilisateurs SET status_user = 'actif' WHERE id_user = ?",
      [id]
    );
    res.json({ message: "Utilisateur approuvé" });
  } catch (err) {
    res.status(500).json({ message: "Erreur mise à jour" });
  }
};

// ✅ 3. Block user
const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      "UPDATE utilisateurs SET status_user = 'bloque' WHERE id_user = ?",
      [id]
    );
    res.json({ message: "Utilisateur bloqué" });
  } catch (err) {
    res.status(500).json({ message: "Erreur mise à jour" });
  }
};

// ✅ 4. Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      "DELETE FROM utilisateurs WHERE id_user = ?",
      [id]
    );
    res.json({ message: "Utilisateur supprimé" });
  } catch (err) {
    res.status(500).json({ message: "Erreur suppression" });
  }
};

module.exports = {
  getAllJeunes,
  approveUser,
  blockUser,
  deleteUser
};