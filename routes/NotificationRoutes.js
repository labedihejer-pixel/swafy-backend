const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const ctrl = require("../controllers/notificationController");

router.get("/", ctrl.getMyNotifications);
router.put("/read-all", ctrl.markAllRead);
router.put("/:id/read", ctrl.markAsRead);

module.exports = router;