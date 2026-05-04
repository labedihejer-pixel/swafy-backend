const socketIo = require("socket.io");
const { verifyToken } = require("../middleware/authMiddleware");

const users = new Map(); // { userId: socketId }

module.exports = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:3000", "https://swafy-frontend.netlify.app"],
      credentials: true
    }
  });

  // ✅ Middleware: تحقق من token
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("No token provided"));
    }
    
    try {
      const decoded = require("jsonwebtoken").verify(
        token,
        process.env.JWT_SECRET || "your_secret_key"
      );
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  // ✅ Connection
  io.on("connection", (socket) => {
    const userId = socket.user.id_user;
    users.set(userId, socket.id);

    console.log(`✅ User ${userId} connected. Socket ID: ${socket.id}`);
    console.log(`📊 Active users: ${users.size}`);

    // ✅ Event: جديد message من Jeune → Admin
    socket.on("new_message", (data) => {
      const { conversationId, senderId, recipientId, text, timestamp } = data;

      console.log(`📨 New message from ${senderId} to ${recipientId}:`, text);

      // ✅ أرسل notification لـ Admin
      if (users.has(recipientId)) {
        const recipientSocketId = users.get(recipientId);
        io.to(recipientSocketId).emit("message_notification", {
          conversationId,
          senderId,
          text,
          timestamp,
          senderName: data.senderName
        });

        console.log(`🔔 Notification sent to user ${recipientId}`);
      } else {
        console.log(`⚠️ User ${recipientId} not online`);
      }
    });

    // ✅ Disconnect
    socket.on("disconnect", () => {
      users.delete(userId);
      console.log(`❌ User ${userId} disconnected. Active users: ${users.size}`);
    });
  });

  return io;
};