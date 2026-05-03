const db = require("../config/db");

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id_user;

    const [rows] = await db.query(`
      SELECT n.*
      FROM notifications n
      WHERE n.id_user_to = ?
      ORDER BY n.created_at DESC
    `, [userId]);

    const [[unread]] = await db.query(`
      SELECT COUNT(*) AS unread_count
      FROM notifications
      WHERE id_user_to = ? AND is_read = 0
    `, [userId]);

    res.json({
      notifications: rows,
      unread_count: unread.unread_count
    });

  } catch (err) {
    console.error("❌ Notifications error:", err);
    res.status(500).json({ message: "Erreur serveur notifications" });
  }
};

exports.markAsRead = async (req, res) => {
  try {

    if (!req.user || !req.user.id_user) {
      return res.status(200).json({ message: "OK" });
    }

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

    if (!req.user || !req.user.id_user) {
      return res.status(200).json({ message: "OK" });
    }

    const userId = req.user.id_user;

    await db.query(
      "UPDATE notifications SET is_read = 1 WHERE id_user_to = ?",
      [userId]
    );

    res.json({ message: "OK" });

  } catch (err) {
    console.error("markAllRead:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};