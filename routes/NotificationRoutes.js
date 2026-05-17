const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const ctrl = require("../controllers/notificationController");

router.get("/", verifyToken, ctrl.getMyNotifications);
router.put("/read-all", verifyToken, ctrl.markAllRead);
router.put("/:id/read", verifyToken, ctrl.markAsRead);


module.exports = router;