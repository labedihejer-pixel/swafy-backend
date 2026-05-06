const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

// ═══════════════════════════════════════════════════════════════
// 👨‍💼 GET /admins
// ═══════════════════════════════════════════════════════════════
router.get("/admins", verifyToken, async (req, res) => {
  try {
    const [admins] = await db.query(
      `SELECT id_user, nom_user, prenom_user, role 
       FROM utilisateurs 
       WHERE role = 'admin' 
       ORDER BY nom_user ASC`
    );
    res.json(admins || []);
  } catch (err) {
    console.error("❌ GET /admins error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 📋 GET /conversations
// ✅ FIX: kenet manqanich params [userId, userId, userId]
// ═══════════════════════════════════════════════════════════════
router.get("/conversations", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;

    const [rows] = await db.query(
      `SELECT mc.id, mc.user_a_id, mc.user_b_id, mc.created_at,
              u.id_user, u.nom_user, u.prenom_user,
              (SELECT text FROM messenger_messages 
               WHERE conversation_id = mc.id 
               ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM messenger_messages 
               WHERE conversation_id = mc.id 
               ORDER BY created_at DESC LIMIT 1) as last_time
       FROM messenger_conversations mc
       LEFT JOIN utilisateurs u ON 
         (CASE 
           WHEN mc.user_a_id = ? THEN mc.user_b_id 
           ELSE mc.user_a_id 
         END) = u.id_user
       WHERE mc.user_a_id = ? OR mc.user_b_id = ?
       ORDER BY last_time DESC`,
      [userId, userId, userId]  // ✅ FIX: params kenu manqanich
    );

    res.json(rows || []);
  } catch (err) {
    console.error("❌ GET /conversations error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 📨 GET /messages/:conversationId
// ═══════════════════════════════════════════════════════════════
router.get("/messages/:conversationId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { conversationId } = req.params;

    // CHECK: conversation mawjouda?
    const [convResult] = await db.query(
      "SELECT * FROM messenger_conversations WHERE id = ?",
      [conversationId]
    );

    if (!convResult || convResult.length === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const conversation = convResult[0];

    // CHECK: user 3andou access?
    const hasAccess =
      Number(conversation.user_a_id) === Number(userId) ||
      Number(conversation.user_b_id) === Number(userId);

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // GET messages
    const [messages] = await db.query(
      `SELECT id, conversation_id, sender_id, type, text, created_at
       FROM messenger_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversationId]
    );

    res.json(messages || []);
  } catch (err) {
    console.error("❌ GET /messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ✉️ POST /messages - ba3th message
// ═══════════════════════════════════════════════════════════════
router.post("/messages", verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id_user;
    const { text } = req.body;

    // نلقى conversation متاع sender مع admin
    const [conv] = await db.query(
      `SELECT * FROM messenger_conversations 
       WHERE user_a_id = LEAST(?, ?) 
         AND user_b_id = GREATEST(?, ?)`,
      [senderId, 147, senderId, 147] // 147 = admin id
    );

    if (!conv || conv.length === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const conversationId = conv[0].id;

    const [result] = await db.query(
      `INSERT INTO messenger_messages (conversation_id, sender_id, type, text, created_at)
       VALUES (?, ?, 'text', ?, NOW())`,
      [conversationId, senderId, text.trim()]
    );

    res.status(201).json({ message: "Message sent" });

  } catch (err) {
    console.error("❌ POST /messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ═══════════════════════════════════════════════════════════════
// 💬 POST /conversation - create or get
// ═══════════════════════════════════════════════════════════════
router.post("/conversation", verifyToken, async (req, res) => {
  const userId = req.user?.id_user;
  const userRole = req.user?.role;
  const { targetId } = req.body;

  try {
    if (!targetId) {
      return res.status(400).json({ message: "targetId required" });
    }

    if (Number(targetId) === Number(userId)) {
      return res.status(400).json({ message: "Cannot create conversation with yourself" });
    }

    // jeune yibi3 kaan lel admin
    if (userRole === "jeune") {
      const [adminCheck] = await db.query(
        "SELECT id_user FROM utilisateurs WHERE role = 'admin' AND id_user = ?",
        [targetId]
      );
      if (!adminCheck || adminCheck.length === 0) {
        return res.status(403).json({ message: "Jeunes can only contact admins" });
      }
    }

    const a = Math.min(Number(userId), Number(targetId));
    const b = Math.max(Number(userId), Number(targetId));

    // CHECK: mawjouda?
    const [existing] = await db.query(
      "SELECT * FROM messenger_conversations WHERE user_a_id = ? AND user_b_id = ?",
      [a, b]
    );

    if (existing && existing.length > 0) {
      return res.json(existing[0]);
    }

    // CREATE
    const [result] = await db.query(
      `INSERT INTO messenger_conversations (user_a_id, user_b_id, created_at) VALUES (?, ?, NOW())`,
      [a, b]
    );

    const [conv] = await db.query(
      "SELECT * FROM messenger_conversations WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(conv[0]);

  } catch (err) {
    // Handle duplicate key
    if (err.code === "ER_DUP_ENTRY") {
      try {
        const a = Math.min(Number(userId), Number(targetId));
        const b = Math.max(Number(userId), Number(targetId));
        const [existing] = await db.query(
          "SELECT * FROM messenger_conversations WHERE user_a_id = ? AND user_b_id = ?",
          [a, b]
        );
        if (existing && existing.length > 0) return res.json(existing[0]);
      } catch (e) {
        console.error("❌ Duplicate recovery failed:", e.message);
      }
    }
    console.error("❌ POST /conversation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
