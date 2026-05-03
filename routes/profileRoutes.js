const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const profileController = require("../controllers/profileController");
const avatarUpload = require("../middleware/avatarUpload");

router.get("/me", verifyToken, profileController.getMyProfile);
router.put("/update", verifyToken, profileController.updateMyProfile);
router.put("/avatar", verifyToken, avatarUpload.single("avatar"), profileController.uploadAvatar);
router.put("/change-password", verifyToken, profileController.changePassword);
router.get("/:id", verifyToken, profileController.getUserProfile);
router.get("/:id/publications", verifyToken, profileController.getUserPublications);

module.exports = router;