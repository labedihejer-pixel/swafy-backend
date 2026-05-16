const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const db = require("./config/db");

// ===============================
// ✅ ROUTES IMPORTS
// ===============================
const fs = require("fs");

console.log("📁 ROUTES DIR:", fs.readdirSync("./routes"));
console.log("📁 CONTROLLERS DIR:", fs.readdirSync("./controllers"));
const { seedAdmin } = require("./controllers/authController");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/EventRoutes");
const liveRoutes = require("./routes/LiveRoutes");
const archiveRoutes = require("./routes/ArchiveRoutes");
const meetRoutes = require("./routes/MeetRoutes");
const userRoutes = require("./routes/UserRoutes");
const gouvernoratRoutes = require("./routes/GouvernoratRoutes");
const enqueteRoutes = require("./routes/EnqueteRoutes");
const parametreRoutes = require("./routes/ParametreRoutes");
const publicationRoutes = require("./routes/PublicationRoutes");
const notificationRoutes = require("./routes/NotificationRoutes");
const messengerRoutes = require("./routes/messengerRoutes");
//const adminRoutes = require("./routes/adminRoutes");

// ===============================
// ✅ CONFIG
// ===============================
const PORT = process.env.PORT;
const LIVE_SECRET = process.env.LIVE_SECRET || process.env.JWT_SECRET;

const app = express();
const server = http.createServer(app);

// ===============================
// ✅ MIDDLEWARE
// ===============================
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// ===============================
// ✅ API ROUTES
// ===============================
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/lives", liveRoutes);
app.use("/api/archive", archiveRoutes);
app.use("/api/meet", meetRoutes);
app.use("/api/users", userRoutes);
app.use("/api/gouvernorats", gouvernoratRoutes);
app.use("/api/enquetes", enqueteRoutes);
app.use("/api/settings", parametreRoutes);
app.use("/api/publications", publicationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messengerRoutes);
app.use("/uploads", express.static("uploads"));
//app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.json({ message: "🚀 Serveur lancé avec succès" });
});

const { sendEmail } = require("./utils/mailer");

app.get("/api/test-email", async (req, res) => {
  try {
    await sendEmail(
      "labedihejer@gmail.com",
      "Test Swafy ✅",
      "<p>Email OK ✅</p>"
    );

    res.json({ success: false, error: err.message });

  } catch (err) {
    console.error("❌ ERROR FULL:", err); // ✅ مهم
    res.json({
      success: false,
      error: err.message
    });
  }
});

// ===============================
// ✅ SOCKET.IO
// ===============================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
app.set("io", io);
const roomUsers = {};
const socketRoomMap = {};

async function validateLiveSocketAccess(roomCode, accessToken, role) {
  try {
    const decoded = jwt.verify(accessToken, LIVE_SECRET);
    if (decoded.type !== "live")
      return { ok: false, message: "Token live invalide" };
    if (decoded.roomCode !== roomCode)
      return { ok: false, message: "Room non autorisée" };
    if (decoded.role !== role)
      return { ok: false, message: "Rôle non autorisé" };

    const [rows] = await db.execute(
      "SELECT * FROM lives WHERE room_code = ? LIMIT 1",
      [roomCode]
    );
    if (!rows.length) return { ok: false, message: "Live introuvable" };

    const live = rows[0];
    if (!live.is_active) return { ok: false, message: "Live terminé" };
    if (live.expires_at && new Date(live.expires_at) < new Date())
      return { ok: false, message: "Lien expiré" };
    if (Number(decoded.v) !== Number(live.token_version || 1))
      return { ok: false, message: "Lien expiré ou remplacé" };
    if (
      role === "host" &&
      decoded.userId &&
      live.host_user_id &&
      Number(decoded.userId) !== Number(live.host_user_id)
    ) {
      return { ok: false, message: "Host non autorisé" };
    }
    return { ok: true, decoded, live };
  } catch (err) {
    return { ok: false, message: "Accès socket refusé" };
  }
}

function leaveRoom(socket) {
  const roomCode = socketRoomMap[socket.id];
  if (!roomCode) return;
  if (roomUsers[roomCode]) {
    roomUsers[roomCode] = roomUsers[roomCode].filter(
      (u) => u.socketId !== socket.id
    );
    socket.to(roomCode).emit("user-left", { socketId: socket.id });
    if (roomUsers[roomCode].length === 0) delete roomUsers[roomCode];
  }
  delete socketRoomMap[socket.id];
  socket.leave(roomCode);
}

io.on("connection", (socket) => {
  console.log("✅ Socket connecté:", socket.id);

  socket.on("join-room", async (payload, ack = () => {}) => {
    try {
      const { roomCode, userName, role = "guest", accessToken } = payload || {};
      if (!roomCode || !accessToken) {
        ack({ ok: false, message: "Données manquantes" });
        return;
      }
      const check = await validateLiveSocketAccess(roomCode, accessToken, role);
      if (!check.ok) { ack({ ok: false, message: check.message }); return; }

      socket.join(roomCode);
      socketRoomMap[socket.id] = roomCode;
      socket.data.roomCode = roomCode;
      socket.data.role = role;
      socket.data.userName = userName || "Invité";

      if (!roomUsers[roomCode]) roomUsers[roomCode] = [];
      roomUsers[roomCode].push({
        socketId: socket.id,
        userName: socket.data.userName,
        role,
      });
      ack({ ok: true });
    } catch (err) {
      console.error("join-room error:", err);
      ack({ ok: false, message: "Erreur serveur socket" });
    }
  });

  socket.on("send-message", ({ roomCode, message }) => {
    if (!socket.data?.roomCode) return;
    if (socket.data.roomCode !== roomCode) return;
    io.to(roomCode).emit("receive-message", {
      user: socket.data.userName || "Invité",
      text: message,
      time: new Date().toLocaleTimeString(),
    });
  });

  socket.on("leave-room", () => leaveRoom(socket));
  socket.on("disconnect", () => {
    leaveRoom(socket);
    console.log("❌ Socket déconnecté:", socket.id);
  });
});

// ===============================
// ✅ NOTIFICATIONS TABLE
// ===============================
db.query(`
  CREATE TABLE IF NOT EXISTS notifications (
    id_notification INT NOT NULL AUTO_INCREMENT,
    id_user_to INT NOT NULL,
    id_user_from INT DEFAULT NULL,
    type_notification VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    message VARCHAR(255) NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_notification),
    KEY idx_notification_user_to (id_user_to),
    KEY idx_notification_user_from (id_user_from),
    KEY idx_notification_entity (entity_type, entity_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`)
  .then(() => console.log("✅ notifications table ready"))
  .catch((err) => console.error("❌ notifications table error", err));
app.post("/api/meet/invite", async (req, res) => {

  try {

    const { email } = req.body;

    console.log("📨 Invitation envoyée à:", email);

    return res.json({
      success: true
    });

  } catch (err) {

    return res.status(500).json({
      success: false
    });

  }

});
// ===============================
// ✅ START SERVER
// ===============================
seedAdmin();
app.get("/api/test-final", (req, res) => {
  res.json({ ok: true, msg: "SERVER ROUTE OK" });
});
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur lancé sur port ${PORT}`);
});
const messaging = io.of("/messaging");

const connectedUsers = new Map();

messaging.on("connection", (socket) => {
  const token = socket.handshake.auth?.token;
  if (!token) return socket.disconnect();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    connectedUsers.set(decoded.id_user, socket.id);
    console.log("✅ Messaging user:", decoded.id_user);
  } catch {
    return socket.disconnect();
  }

  socket.on("new_message", ({ conversationId, recipientId, text }) => {
    if (connectedUsers.has(recipientId)) {
      messaging.to(connectedUsers.get(recipientId))
        .emit("message_received", {
          conversationId,
          senderId: socket.user.id_user,
          text
        });
    }
  });

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.user?.id_user);
  });
});
