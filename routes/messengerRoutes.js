const express = require("express");
const router  = express.Router();
const db      = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

/* ── helper: quel nom de table? ──
   Mets "users" ou "utilisateurs" selon ta vraie table.
   On utilise une constante pour éviter les incohérences. */
const USERS_TABLE = "utilisateurs"; // ← change ici si ta table s'appelle "users"

/* ══════════════════════════════════════════
   GET /messages/admins
   → liste les admins (pour la page jeune)
══════════════════════════════════════════ */
router.get("/admins", verifyToken, async (req, res) => {
  try {
    const [admins] = await db.query(
      `SELECT id_user, nom_user, prenom_user, role
       FROM ${USERS_TABLE}
       WHERE role = 'admin'
       ORDER BY nom_user ASC`
    );
    res.json(admins || []);
  } catch (err) {
    console.error("❌ GET /admins error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   GET /messages/jeunes                    ← NOUVEAU
   → liste les jeunes (pour la page admin)
══════════════════════════════════════════ */
router.get("/jeunes", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin seulement" });
    }

    /*
      UNION des deux sources :
        1. utilisateurs  WHERE role IN ('jeune','jeune_profile')
        2. jeune_profiles (table dédiée) — on prend toutes les lignes
           et on fait un LEFT JOIN sur utilisateurs pour récupérer nom/prénom
           si la table jeune_profiles les stocke directement, adaptez les colonnes.

      On déduplique par id_user avec GROUP BY.
    */
    const [jeunes] = await db.query(`
      SELECT id_user, nom_user, prenom_user, role, 'utilisateurs' AS source
      FROM ${USERS_TABLE}
      WHERE role IN ('jeune', 'jeune_profile')

      UNION

      SELECT
        jp.id_user,
        COALESCE(jp.nom,   u.nom_user,   'Jeune')   AS nom_user,
        COALESCE(jp.prenom, u.prenom_user, '')       AS prenom_user,
        'jeune'                                      AS role,
        'jeune_profiles'                             AS source
      FROM jeune_profiles jp
      LEFT JOIN ${USERS_TABLE} u ON u.id_user = jp.id_user

      ORDER BY nom_user ASC
    `);

    /* dédupliquer côté serveur si un user est dans les 2 tables */
    const seen = new Set();
    const unique = (jeunes || []).filter(j => {
      if (seen.has(j.id_user)) return false;
      seen.add(j.id_user);
      return true;
    });

    res.json(unique);
  } catch (err) {
    console.error("❌ GET /jeunes error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
/* ══════════════════════════════════════════
   GET /messages/conversations
   → toutes les conversations du user connecté
══════════════════════════════════════════ */
router.get("/conversations", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;

    const [rows] = await db.query(
      `SELECT
         mc.id, mc.user_a_id, mc.user_b_id, mc.created_at,
         u.id_user, u.nom_user, u.prenom_user,
         (SELECT text FROM messenger_messages
          WHERE conversation_id = mc.id
          ORDER BY created_at DESC LIMIT 1) AS last_message,
         (SELECT created_at FROM messenger_messages
          WHERE conversation_id = mc.id
          ORDER BY created_at DESC LIMIT 1) AS last_time
       FROM messenger_conversations mc
       LEFT JOIN ${USERS_TABLE} u
         ON (CASE WHEN mc.user_a_id = ? THEN mc.user_b_id ELSE mc.user_a_id END) = u.id_user
       WHERE mc.user_a_id = ? OR mc.user_b_id = ?
       ORDER BY last_time DESC`,
      [userId, userId, userId]
    );

    res.json(rows || []);
  } catch (err) {
    console.error("❌ GET /conversations error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════
   POST /messages/messages
   → envoyer un message
══════════════════════════════════════════ */
router.post("/", verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id_user;
    const { conversationId, text } = req.body;
   
    console.log("📥 INCOMING MESSAGE:");
    console.log("👉 senderId:", senderId);
    console.log("👉 conversationId:", conversationId);
    console.log("👉 text:", text);


    console.log("✅ POST /messages ROUTE LOADED");
  
    if (!conversationId || !text) {
      return res.status(400).json({ message: "Données manquantes" });
    }

    /* vérifier que le sender appartient à la conversation */
    const [convCheck] = await db.query(
      "SELECT id FROM messenger_conversations WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)",
      [conversationId, senderId, senderId]
    );
    console.log("📊 convCheck result:", convCheck);
    if (!convCheck.length) {
      return res.status(403).json({ message: "Accès refusé à cette conversation" });
    }

    await db.query(
  `INSERT INTO messenger_messages (conversation_id, sender_id, type, text, created_at)
   VALUES (?, ?, 'text', ?, NOW())`,
  [conversationId, senderId, text.trim()]
    );
   console.log("✅ MESSAGE INSERTED INTO DB ✅");
    /* ✅ EMIT REALTIME */
    const io = req.app.get("io"); // نجيبو socket

    io.emit("messageReceived", {
      conversationId,
      senderId,
      text: text.trim()
    });

res.status(201).json({ message: "Message envoyé" });
  } catch (err) {
    console.error("❌ POST /messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});




/* ══════════════════════════════════════════
   POST /messages/conversation
   → créer ou récupérer une conversation
══════════════════════════════════════════ */
router.post("/conversation", verifyToken, async (req, res) => {
  const userId   = req.user?.id_user;
  const userRole = req.user?.role;
  const { targetId } = req.body;

  try {
    if (!targetId) return res.status(400).json({ message: "targetId requis" });
    if (Number(targetId) === Number(userId)) {
      return res.status(400).json({ message: "Impossible de vous contacter vous-même" });
    }

    /* ── vérification rôle jeune → ne peut contacter que les admins ──
       On accepte "jeune" ET "jeune_profile" */
    const isJeune = userRole === "jeune" || userRole === "jeune_profile";
    if (isJeune) {
      const [adminCheck] = await db.query(
        `SELECT id_user FROM ${USERS_TABLE} WHERE role = 'admin' AND id_user = ?`,
        [targetId]
      );
      if (!adminCheck || adminCheck.length === 0) {
        return res.status(403).json({ message: "Les jeunes ne peuvent contacter que les admins" });
      }
    }

    /* toujours stocker a < b pour éviter les doublons */
    const a = Math.min(Number(userId), Number(targetId));
    const b = Math.max(Number(userId), Number(targetId));

    /* chercher si conversation existe déjà */
    const [existing] = await db.query(
      "SELECT * FROM messenger_conversations WHERE user_a_id = ? AND user_b_id = ?",
      [a, b]
    );
    if (existing && existing.length > 0) {
      return res.json(existing[0]);
    }

    /* créer */
    const [result] = await db.query(
      "INSERT INTO messenger_conversations (user_a_id, user_b_id, created_at) VALUES (?, ?, NOW())",
      [a, b]
    );
    const [conv] = await db.query(
      "SELECT * FROM messenger_conversations WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(conv[0]);

  } catch (err) {
    /* gestion doublon race condition */
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

/* ══════════════════════════════════════════
   GET /messages/messages/:conversationId
   → messages d'une conversation
══════════════════════════════════════════ */
router.get("/conversation/:conversationId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id_user;
    const { conversationId } = req.params;

    const [convResult] = await db.query(
      "SELECT * FROM messenger_conversations WHERE id = ?",
      [conversationId]
    );
    if (!convResult || convResult.length === 0) {
      return res.status(404).json({ message: "Conversation introuvable" });
    }

    const conv = convResult[0];
    const hasAccess =
      Number(conv.user_a_id) === Number(userId) ||
      Number(conv.user_b_id) === Number(userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Accès refusé" });
    }

    const [messages] = await db.query(
      `SELECT id, conversation_id, sender_id, type, text, created_at
       FROM messenger_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversationId]
    );

    res.json(messages || []);
  } catch (err) {
    console.error("❌ GET /messages/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;