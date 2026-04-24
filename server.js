const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/EventRoutes");
const liveRoutes = require("./routes/LiveRoutes");
const archiveRoutes = require("./routes/ArchiveRoutes");
const meetRoutes = require("./routes/MeetRoutes");
const userRoutes = require("./routes/UserRoutes");

const app = express();
const server = http.createServer(app);

// ===============================
// ✅ CONFIG
// ===============================
const PORT = process.env.PORT || 5000;
const LIVE_SECRET = process.env.LIVE_SECRET || process.env.JWT_SECRET;

// ✅ Frontends autorisés
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://finale-scalping-overstuff.ngrok-free.dev",
];

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

// ✅ Test route (مرة وحدة فقط)
app.get("/", (req, res) => {
  res.json({ message: "🚀 Serveur lancé avec succès" });
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


const roomUsers = {};
const socketRoomMap = {};

// ✅ Vérifier accès socket
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

    if (!rows.length)
      return { ok: false, message: "Live introuvable" };

    const live = rows[0];

    if (!live.is_active)
      return { ok: false, message: "Live terminé" };

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

    if (roomUsers[roomCode].length === 0) {
      delete roomUsers[roomCode];
    }
  }

  delete socketRoomMap[socket.id];
  socket.leave(roomCode);
}

// ===============================
// ✅ SOCKET EVENTS
// ===============================
io.on("connection", (socket) => {
  console.log("✅ Socket connecté:", socket.id);

  socket.on("join-room", async (payload, ack = () => {}) => {
    try {
      const { roomCode, userName, role = "guest", accessToken } = payload || {};

      if (!roomCode || !accessToken) {
        ack({ ok: false, message: "Données manquantes" });
        return;
      }

      const check = await validateLiveSocketAccess(
        roomCode,
        accessToken,
        role
      );

      if (!check.ok) {
        ack({ ok: false, message: check.message });
        return;
      }

      socket.join(roomCode);
      socketRoomMap[socket.id] = roomCode;

      socket.data.roomCode = roomCode;
      socket.data.role = role;
      socket.data.userName = userName || "Invité";

      if (!roomUsers[roomCode]) roomUsers[roomCode] = [];

      roomUsers[roomCode].push({
        socketId: socket.id,
        userName: userName || "Invité",
        role,
      });

      const others = roomUsers[roomCode].filter(
        (u) => u.socketId !== socket.id
      );

      socket.emit("all-users", others);

      socket.to(roomCode).emit("user-joined", {
        socketId: socket.id,
        userName: userName || "Invité",
        role,
      });

      ack({ ok: true });
    } catch (err) {
      console.error("join-room error:", err);
      ack({ ok: false, message: "Erreur serveur socket" });
    }
  });

  socket.on("offer", ({ target, sdp }) => {
    if (!socket.data?.roomCode || !target || !sdp) return;
    if (socketRoomMap[target] !== socket.data.roomCode) return;
    io.to(target).emit("offer", { caller: socket.id, sdp });
  });

  socket.on("answer", ({ target, sdp }) => {
    if (!socket.data?.roomCode || !target || !sdp) return;
    if (socketRoomMap[target] !== socket.data.roomCode) return;
    io.to(target).emit("answer", { responder: socket.id, sdp });
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    if (!socket.data?.roomCode || !target || !candidate) return;
    if (socketRoomMap[target] !== socket.data.roomCode) return;
    io.to(target).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("toggle-media", ({ roomCode, type, enabled }) => {
    if (!socket.data?.roomCode || socket.data.roomCode !== roomCode) return;

    socket.to(roomCode).emit("user-media-toggled", {
      socketId: socket.id,
      type,
      enabled,
    });
  });

  socket.on("leave-room", () => leaveRoom(socket));

  socket.on("disconnect", () => {
    leaveRoom(socket);
    console.log("❌ Socket déconnecté:", socket.id);
  });
});

// ===============================
// ✅ START SERVER
// ===============================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Serveur lancé sur le port ${PORT}`);
});
