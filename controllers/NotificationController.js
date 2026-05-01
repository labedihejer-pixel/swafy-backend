const db = require("../config/db");

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id_user;

    // Jointure avec la table utilisateurs pour avoir le nom et la photo
    const [rows] = await db.query(
      `SELECT n.*, u.nom_user, u.photo_user 
       FROM notifications n
       LEFT JOIN utilisateurs u ON n.id_user_from = u.id_user
       WHERE n.id_user_to = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const [[unread]] = await db.query(
      "SELECT COUNT(*) AS unread_count FROM notifications WHERE id_user_to = ? AND is_read = 0",
      [userId]
    );

    res.json({ notifications: rows, unread_count: unread.unread_count });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { id } = req.params;

    await db.query(
      "UPDATE notifications SET is_read = 1 WHERE id_notification = ? AND id_user_to = ?",
      [id, userId]
    );

    res.json({ message: "OK" });
  } catch (err) {
    console.error("markAsRead:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user.id_user;
    await db.query("UPDATE notifications SET is_read = 1 WHERE id_user_to = ?", [userId]);
    res.json({ message: "OK" });
  } catch (err) {
    console.error("markAllRead:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
module.exports = {  
  getMyNotifications: exports.getMyNotifications,
  markAsRead: exports.markAsRead,
  markAllRead: exports.markAllRead
};