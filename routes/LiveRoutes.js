const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

const LIVE_SECRET = process.env.LIVE_SECRET || process.env.JWT_SECRET;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// ✅ Générateur de code
function generateRoomCode() {
  return (
    Math.random().toString(36).slice(2, 8) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

// ✅ GET — récupérer tous les lives (calendar)
router.get("/", verifyToken, async (req, res) => {
  try {
    const [lives] = await db.execute(
      "SELECT * FROM lives ORDER BY date DESC, time DESC"
    );
    res.json(lives);
  } catch (err) {
    console.error("❌ GET /api/lives:", err);
    res.status(500).json({ message: "Erreur récupération lives" });
  }
});

// ✅ POST — créer une session live (SÉCURISÉ)
router.post("/session/create", verifyToken, async (req, res) => {
  try {
    // ✅ ✅ FIX PRINCIPAL
    if (!req.user || (!req.user.id_user && !req.user.id)) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const userId = req.user.id_user || req.user.id;

    const {
      title = "Live session",
      description = "",
      date = null,
      time = null,
      thematique = "",
      status = "Programmé",
      category = "other",
      liveId = null,
    } = req.body;

    const roomCode = generateRoomCode();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6h

    // ✅ UPDATE live existant
    if (liveId) {
      await db.execute(
        `UPDATE lives 
         SET room_code=?, host_user_id=?, is_active=1, token_version=token_version+1, expires_at=? 
         WHERE id=?`,
        [roomCode, userId, expiresAt, liveId]
      );
    } 
    // ✅ CREATE nouveau live
    else {
      const viewerToken = jwt.sign(
        { type: "live", role: "guest", roomCode, v: 1 },
        LIVE_SECRET,
        { expiresIn: "6h" }
      );

      const viewerLink = `${CLIENT_URL}/live/${roomCode}?vt=${viewerToken}`;

      await db.execute(
        `INSERT INTO lives 
          (title, description, link, date, time, thematique, status, category, room_code, host_user_id, is_active, expires_at, token_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1)`,
        [
          title,
          description,
          viewerLink,
          date,
          time,
          thematique,
          status,
          category,
          roomCode,
          userId,
          expiresAt,
        ]
      );
    }

    const [rows] = await db.execute(
      "SELECT * FROM lives WHERE room_code=? LIMIT 1",
      [roomCode]
    );

    const live = rows[0];

    // ✅ Tokens sécurisés
    const hostAccessToken = jwt.sign(
      { type: "live", role: "host", roomCode, userId, v: live.token_version },
      LIVE_SECRET,
      { expiresIn: "6h" }
    );

    const viewerAccessToken = jwt.sign(
      { type: "live", role: "guest", roomCode, v: live.token_version },
      LIVE_SECRET,
      { expiresIn: "6h" }
    );

    res.json({
      success: true,
      roomCode,
      hostAccessToken,
      viewerAccessToken,
      hostLink: `${CLIENT_URL}/live/${roomCode}?at=${hostAccessToken}`,
      viewerLink: `${CLIENT_URL}/live/${roomCode}?vt=${viewerAccessToken}`,
      liveId: live.id,
    });
  } catch (err) {
    console.error("❌ POST /session/create:", err);
    res.status(500).json({ message: "Erreur création live" });
  }
});

module.exports = router;
