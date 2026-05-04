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

// ===============================
// ✅ CONFIG
// ===============================
const PORT = process.env.PORT || 5000;
const LIVE_SECRET = process.env.LIVE_SECRET || process.env.JWT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

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

app.get("/", (req, res) => {
  res.json({ message: "🚀 Serveur lancé avec succès" });
});

// ===============================
// ✅ SOCKET.IO SETUP
// ===============================
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ Store connected users (userId → socketId)
const connectedUsers = new Map();
const roomUsers = {};
const socketRoomMap = {};

// ===============================
// ✅ SOCKET.IO - MESSAGING NAMESPACE
// ===============================
const messageNamespace = io.of("/messaging");

messageNamespace.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    console.log("❌ Socket auth: No token provided");
    return next(new Error("No token provided"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    console.log("✅ Socket auth success for user:", decoded.id_user);
    next();
  } catch (err) {
    console.log("❌ Socket auth: Invalid token");
    next(new Error("Invalid token"));
  }
});

messageNamespace.on("connection", (socket) => {
  const userId = socket.user.id_user;
  
  // ✅ Store user connection
  connectedUsers.set(userId, socket.id);
  
  console.log(`✅ [Messaging] User ${userId} connected. Socket: ${socket.id}`);
  console.log(`📊 [Messaging] Active users: ${connectedUsers.size}`);

  // ✅ Event: New message
  socket.on("new_message", (data) => {
    const { conversationId, recipientId, text, senderName } = data;

    console.log(`📨 [Messaging] New message from ${userId} to ${recipientId}:`, text?.substring(0, 50));

    // ✅ Send notification to recipient if online
    if (connectedUsers.has(recipientId)) {
      const recipientSocketId = connectedUsers.get(recipientId);
      
      messageNamespace.to(recipientSocketId).emit("message_received", {
        conversationId,
        senderId: userId,
        senderName,
        text,
        timestamp: new Date().toISOString()
      });

      console.log(`🔔 [Messaging] Notification sent to user ${recipientId}`);
    } else {
      console.log(`⚠️ [Messaging] User ${recipientId} not online`);
    }
  });

  // ✅ Event: Typing indicator
  socket.on("typing", (data) => {
    const { conversationId, recipientId } = data;
    
    if (connectedUsers.has(recipientId)) {
      const recipientSocketId = connectedUsers.get(recipientId);
      messageNamespace.to(recipientSocketId).emit("user_typing", {
        conversationId,
        senderId: userId
      });
    }
  });

  // ✅ Event: Stop typing
  socket.on("stop_typing", (data) => {
    const { conversationId, recipientId } = data;
    
    if (connectedUsers.has(recipientId)) {
      const recipientSocketId = connectedUsers.get(recipientId);
      messageNamespace.to(recipientSocketId).emit("user_stop_typing", {
        conversationId,
        senderId: userId
      });
    }
  });

  // ✅ Event: Mark as read
  socket.on("mark_read", (data) => {
    const { conversationId, recipientId } = data;
    
    if (connectedUsers.has(recipientId)) {
      const recipientSocketId = connectedUsers.get(recipientId);
      messageNamespace.to(recipientSocketId).emit("messages_read", {
        conversationId,
        readBy: userId
      });
    }
  });

  // ✅ Disconnect
  socket.on("disconnect", () => {
    connectedUsers.delete(userId);
    console.log(`❌ [Messaging] User ${userId} disconnected. Active: ${connectedUsers.size}`);
  });
});

/// Dans votre server.js - Modifiez la partie Socket.io


// Garder trace des utilisateurs connectés
const onlineUsers = new Map(); // userId -> socketId
const socketUserMap = new Map(); // socketId -> userId

io.on("connection", (socket) => {
  console.log("✅ Socket connecté:", socket.id);

  // Authentification de l'utilisateur
  socket.on("authenticate", ({ userId, token }) => {
    try {
      // Vérifiez le token si nécessaire
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Enregistrer l'utilisateur comme connecté
      onlineUsers.set(parseInt(userId), socket.id);
      socketUserMap.set(socket.id, parseInt(userId));
      
      console.log(`Utilisateur ${userId} authentifié et en ligne`);
      io.emit("user_status", { userId, status: "online" });
    } catch (err) {
      console.error("Erreur d'authentification:", err);
    }
  });

  // Envoi de message privé
  socket.on("send_message", async (messageData) => {
    try {
      const { senderId, receiverId, message, conversationId } = messageData;
      console.log(`Message de ${senderId} à ${receiverId}: ${message}`);
      
      // Enregistrer le message dans la base de données
      const [result] = await db.execute(
        "INSERT INTO messages (conversation_id, sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?, NOW())",
        [conversationId, senderId, receiverId, message]
      );
      
      const messageId = result.insertId;
      
      // Créer une notification pour le destinataire
      await db.execute(
        "INSERT INTO notifications (id_user_to, id_user_from, type_notification, entity_type, entity_id, message) VALUES (?, ?, ?, ?, ?, ?)",
        [receiverId, senderId, "message", "message", messageId, `Vous avez reçu un nouveau message`]
      );
      
      // Envoyer le message au destinataire en temps réel s'il est connecté
      if (onlineUsers.has(parseInt(receiverId))) {
        const receiverSocketId = onlineUsers.get(parseInt(receiverId));
        io.to(receiverSocketId).emit("receive_message", {
          messageId,
          conversationId,
          senderId,
          message,
          timestamp: new Date().toISOString()
        });
        
        // Envoyer aussi une notification
        io.to(receiverSocketId).emit("notification", {
          type: "message",
          senderId,
          message: `Nouveau message reçu`
        });
      }
      
      // Confirmation au sender
      socket.emit("message_sent", { 
        success: true, 
        messageId,
        conversationId,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      console.error("Erreur d'envoi de message:", err);
      socket.emit("message_sent", { success: false, error: "Échec d'envoi du message" });
    }
  });

  // Marquage des messages comme lus
  socket.on("mark_as_read", async ({ conversationId, userId }) => {
    try {
      await db.execute(
        "UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0",
        [conversationId, userId]
      );
      
      // Informer l'expéditeur que ses messages ont été lus
      const [messages] = await db.execute(
        "SELECT sender_id FROM messages WHERE conversation_id = ? AND receiver_id = ? GROUP BY sender_id",
        [conversationId, userId]
      );
      
      messages.forEach(message => {
        const senderId = message.sender_id;
        if (onlineUsers.has(parseInt(senderId))) {
          io.to(onlineUsers.get(parseInt(senderId))).emit("messages_read", { conversationId, byUserId: userId });
        }
      });
      
    } catch (err) {
      console.error("Erreur de marquage des messages comme lus:", err);
    }
  });

  // Déconnexion
  socket.on("disconnect", () => {
    const userId = socketUserMap.get(socket.id);
    if (userId) {
      console.log(`Utilisateur ${userId} déconnecté`);
      onlineUsers.delete(userId);
      socketUserMap.delete(socket.id);
      io.emit("user_status", { userId, status: "offline" });
    }
    console.log("❌ Socket déconnecté:", socket.id);
  });
});

// Garder les anciennes fonctionnalités pour la compatibilité
// Conservez le reste de votre code socket pour les lives, etc.
// ===============================
// ✅ MESSENGER TABLES
// ===============================
const createMessengerTables = async () => {
  try {
    // ✅ Conversations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messenger_conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_a_id INT NOT NULL,
        user_b_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_conv (user_a_id, user_b_id),
        INDEX idx_user_a (user_a_id),
        INDEX idx_user_b (user_b_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ messenger_conversations table ready");

    // ✅ Messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messenger_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        type VARCHAR(20) DEFAULT 'text',
        text LONGTEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conversation (conversation_id),
        INDEX idx_sender (sender_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ messenger_messages table ready");

  } catch (err) {
    console.error("❌ Messenger tables error:", err.message);
  }
};

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

// ===============================
// ✅ START SERVER
// ===============================
const startServer = async () => {
  await createMessengerTables();
  await seedAdmin();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Serveur lancé sur port ${PORT}`);
    console.log(`📡 Socket.io ready:`);
    console.log(`   - Main namespace: /`);
    console.log(`   - Messaging namespace: /messaging`);
  });
};

startServer();