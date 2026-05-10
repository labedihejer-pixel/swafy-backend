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
 io.on("connection", (socket) => {
  const userId = socket.user.id_user;
  users.set(userId, socket.id);

  console.log(`✅ User ${userId} connected`);

  socket.on("disconnect", () => {
    users.delete(userId);
  });
});

  
  return io;
};