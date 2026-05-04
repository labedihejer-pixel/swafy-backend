const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

// GET conversations متاع user
router.get("/conversations", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const [rows] = await db.query(
      `SELECT mc.*, 
        u.nom_user, u.prenom_user, u.photo_user,
        (SELECT text FROM messenger_messages mm 
         WHERE mm.conversation_id = mc.id 
         ORDER BY mm.created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messenger_messages mm 
         WHERE mm.conversation_id = mc.id 
         ORDER BY mm.created_at DESC LIMIT 1) as last_time
       FROM messenger_conversations mc
       JOIN utilisateurs u ON (
         CASE WHEN mc.user_a_id = ? THEN mc.user_b_id ELSE mc.user_a_id END = u.id_user
       )
       WHERE mc.user_a_id = ? OR mc.user_b_id = ?
       ORDER BY last_time DESC`,
      [userId, userId, userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET messages متاع conversation
router.get("/messages/:conversationId", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT mm.*, u.nom_user, u.prenom_user, u.photo_user
       FROM messenger_messages mm
       JOIN utilisateurs u ON mm.sender_id = u.id_user
       WHERE mm.conversation_id = ?
       ORDER BY mm.created_at ASC`,
      [req.params.conversationId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/conversation", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const userRole = req.user.role;
    const { targetId } = req.body;

    // ✅ protections (باش ما يطيّحش 500)
    if (!targetId) {
      return res.status(400).json({ message: "targetId manquant" });
    }

    if (Number(targetId) === Number(userId)) {
      return res
        .status(400)
        .json({ message: "Conversation avec soi-même interdite" });
    }

    // ✅ jeune ينجم يبعث كان للإدمن
    if (userRole === "jeune") {
      const [admins] = await db.query(
        "SELECT id_user FROM utilisateurs WHERE role = 'admin' AND id_user = ?",
        [targetId]
      );

      if (admins.length === 0) {
        return res
          .status(403)
          .json({ message: "Jeune peut contacter seulement admin" });
      }
    }

    const a = Math.min(userId, targetId);
    const b = Math.max(userId, targetId);

    const [existing] = await db.query(
      "SELECT * FROM messenger_conversations WHERE user_a_id = ? AND user_b_id = ?",
      [a, b]
    );

    if (existing.length > 0) return res.json(existing[0]);

    const [result] = await db.query(
      "INSERT INTO messenger_conversations (user_a_id, user_b_id) VALUES (?, ?)",
      [a, b]
    );

    const [conv] = await db.query(
      "SELECT * FROM messenger_conversations WHERE id = ?",
      [result.insertId]
    );

    res.json(conv[0]);
  } catch (err) {
    console.error("conversation error:", err);
    res.status(500).json({ error: err.message });
  }
});


// POST بعث message
router.post("/messages", verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id_user;
    const { conversationId, text, type = "text" } = req.body;

    const [result] = await db.query(
      "INSERT INTO messenger_messages (conversation_id, sender_id, type, text) VALUES (?, ?, ?, ?)",
      [conversationId, senderId, type, text]
    );

    const [msg] = await db.query(
      `SELECT mm.*, u.nom_user, u.prenom_user, u.photo_user
       FROM messenger_messages mm
       JOIN utilisateurs u ON mm.sender_id = u.id_user
       WHERE mm.id = ?`,
      [result.insertId]
    );

    // ✅ Emit Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(String(conversationId)).emit("newMessage", msg[0]);
    }

    res.json(msg[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET كل الـ admins (للـ jeune باش يبعث)
router.get("/admins", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_user, nom_user, prenom_user FROM utilisateurs WHERE role = 'admin'"
    );
    res.json(rows);
  } catch (err) {
    console.error("admins error", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;