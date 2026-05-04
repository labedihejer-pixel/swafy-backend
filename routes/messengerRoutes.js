const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

// ═══════════════════════════════════════════════════════════════
// 👨‍💼 GET /admins - قائمة الـ admins
// ═══════════════════════════════════════════════════════════════
router.get("/admins", verifyToken, async (req, res) => {
  try {
    console.log("📋 GET /admins called by user:", req.user?.id_user);

    const [admins] = await db.query(
      `SELECT id_user, nom_user, prenom_user, role 
       FROM utilisateurs 
       WHERE role = 'admin' 
       ORDER BY nom_user ASC`
    );

    console.log(`✅ Found ${admins?.length || 0} admins`);

    res.json(admins || []);

  } catch (err) {
    console.error("❌ GET /admins error:", {
      message: err.message,
      code: err.code,
      sqlMessage: err.sqlMessage
    });
    
    res.status(500).json({ 
      error: "Failed to fetch admins",
      message: err.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 📋 GET /conversations - قائمة conversations
// ═══════════════════════════════════════════════════════════════
router.get("/conversations", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    
    console.log("📋 GET /conversations called by user:", userId);

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
       ORDER BY last_time DESC`
    );
    
    console.log(`✅ Found ${rows?.length || 0} conversations`);

    res.json(rows || []);

  } catch (err) {
    console.error("❌ GET /conversations error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 📨 GET /messages/:conversationId - Messages متاع conversation
// ═══════════════════════════════════════════════════════════════
router.get("/messages/:conversationId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { conversationId } = req.params;

    console.log("📥 GET /messages/:conversationId called:", {
      userId,
      conversationId
    });

    // ✅ CHECK: conversation موجودة؟
    const [convResult] = await db.query(
      "SELECT * FROM messenger_conversations WHERE id = ?",
      [conversationId]
    );

    if (!convResult || convResult.length === 0) {
      console.warn("⚠️ Conversation not found:", conversationId);
      return res.status(404).json({ message: "Conversation not found" });
    }

    const conversation = convResult[0];

    // ✅ CHECK: user عندو access؟
    const hasAccess = 
      Number(conversation.user_a_id) === Number(userId) ||
      Number(conversation.user_b_id) === Number(userId);

    if (!hasAccess) {
      console.warn("⛔ Access denied");
      return res.status(403).json({ message: "Access denied" });
    }

    // ✅ GET messages
    const [messages] = await db.query(
      `SELECT id, conversation_id, sender_id, type, text, created_at
       FROM messenger_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversationId]
    );

    console.log(`✅ Found ${messages?.length || 0} messages`);

    res.json(messages || []);

  } catch (err) {
    console.error("❌ GET /messages/:conversationId error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ✉️ POST /messages - بعث message
// ═══════════════════════════════════════════════════════════════
router.post("/messages", verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id_user;
    const { conversationId, text, type = "text" } = req.body;

    console.log("📤 POST /messages called:", { senderId, conversationId });

    // ✅ Validation
    if (!conversationId || !text?.trim()) {
      return res.status(400).json({ 
        message: "conversationId and text required" 
      });
    }

    // ✅ CHECK: conversation موجودة؟
    const [convResult] = await db.query(
      "SELECT * FROM messenger_conversations WHERE id = ?",
      [conversationId]
    );

    if (!convResult || convResult.length === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // ✅ CHECK: sender عندو access؟
    const conversation = convResult[0];
    const hasAccess = 
      Number(conversation.user_a_id) === Number(senderId) ||
      Number(conversation.user_b_id) === Number(senderId);

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // ✅ INSERT message
    const [result] = await db.query(
      `INSERT INTO messenger_messages 
       (conversation_id, sender_id, type, text, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [conversationId, senderId, type, text.trim()]
    );

    // ✅ GET message جديد
    const [messages] = await db.query(
      `SELECT id, conversation_id, sender_id, type, text, created_at
       FROM messenger_messages
       WHERE id = ?`,
      [result.insertId]
    );

    console.log("✅ Message created:", result.insertId);

    res.status(201).json(messages[0]);

  } catch (err) {
    console.error("❌ POST /messages error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 💬 POST /conversation - create or get conversation
// ═══════════════════════════════════════════════════════════════
router.post("/conversation", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const userRole = req.user.role;
    const { targetId } = req.body;

    console.log("🆕 POST /conversation called:", { 
      userId, 
      userRole, 
      targetId 
    });

    // ✅ Validation
    if (!targetId) {
      return res.status(400).json({ message: "targetId required" });
    }

    if (Number(targetId) === Number(userId)) {
      return res.status(400).json({ 
        message: "Cannot create conversation with yourself" 
      });
    }

    // ✅ jeune يبعث كان للـ admin
    if (userRole === "jeune") {
      const [adminCheck] = await db.query(
        "SELECT id_user FROM utilisateurs WHERE role = 'admin' AND id_user = ?",
        [targetId]
      );

      if (!adminCheck || adminCheck.length === 0) {
        return res.status(403).json({ 
          message: "Jeunes can only contact admins" 
        });
      }
    }

    // ✅ Order canonique (a < b)
    const a = Math.min(Number(userId), Number(targetId));
    const b = Math.max(Number(userId), Number(targetId));

    // ✅ CHECK: موجودة بالفعل؟
    const [existing] = await db.query(
      "SELECT * FROM messenger_conversations WHERE user_a_id = ? AND user_b_id = ?",
      [a, b]
    );

    if (existing && existing.length > 0) {
      console.log("♻️ Conversation already exists:", existing[0].id);
      return res.json(existing[0]);
    }

    // ✅ CREATE جديدة
    const [result] = await db.query(
      `INSERT INTO messenger_conversations (user_a_id, user_b_id, created_at)
       VALUES (?, ?, NOW())`,
      [a, b]
    );

    const [conv] = await db.query(
      "SELECT * FROM messenger_conversations WHERE id = ?",
      [result.insertId]
    );

    console.log("✅ Conversation created:", result.insertId);

    res.status(201).json(conv[0]);

  } catch (err) {
    // ✅ Handle duplicate
    if (err.code === "ER_DUP_ENTRY") {
      const a = Math.min(Number(userId), Number(targetId));
      const b = Math.max(Number(userId), Number(targetId));

      try {
        const [existing] = await db.query(
          "SELECT * FROM messenger_conversations WHERE user_a_id = ? AND user_b_id = ?",
          [a, b]
        );

        if (existing && existing.length > 0) {
          return res.json(existing[0]);
        }
      } catch (e) {
        console.error("❌ Duplicate recovery failed:", e);
      }
    }

    console.error("❌ POST /conversation error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;