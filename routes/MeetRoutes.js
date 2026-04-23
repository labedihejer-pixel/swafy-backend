const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
function generateRoomCode() {
  return "swafy-" + Math.random().toString(36).substring(2, 10);
}

router.post("/create", (req, res) => {
  const roomCode = generateRoomCode();
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  // ✅ توليد token (vt)
  const token = jwt.sign(
    {
      type: "live",
      role: "host",
      roomCode,
      v: 1,
    },
    process.env.JWT_SECRET, // ✅ لازم موجودة في .env
    { expiresIn: "1h" }
  );

  // ✅ لينك فيه token
  const joinLink = `${clientUrl}/meet/${roomCode}?vt=${token}`;

  res.json({
    success: true,
    roomCode,
    token,     // ✅ مهم
    joinLink,  // ✅ فيه vt
  });
});

// Get meeting info by room code
router.get("/:roomCode", (req, res) => {
  const { roomCode } = req.params;
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  if (!roomCode) {
    return res.status(400).json({
      success: false,
      message: "Room code obligatoire",
    });
  }

  res.json({
    success: true,
    roomCode,
    joinLink: `${clientUrl}/meet/${roomCode}`,
  });
});

module.exports = router;