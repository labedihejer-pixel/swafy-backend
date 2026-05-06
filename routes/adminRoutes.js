const express = require("express");
const router = express.Router();

const {
  getAllJeunes,
  approveUser,
  blockUser,
  deleteUser
} = require("../controllers/AdminController");

const { verifyToken } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/adminMiddleware");

// ✅ Admin only routes
router.get("/jeunes", verifyToken, adminOnly, getAllJeunes);
router.put("/approve/:id", verifyToken, adminOnly, approveUser);
router.put("/block/:id", verifyToken, adminOnly, blockUser);
router.delete("/delete/:id", verifyToken, adminOnly, deleteUser);

module.exports = router;