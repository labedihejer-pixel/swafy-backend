const express = require("express");
const router = express.Router();

const PublicationController = require("../controllers/PublicationController");
const { verifyToken } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// ✅ CREATE publication (protected)
router.post(
  "/",
  verifyToken,
  (req, res, next) => {
    upload.array("files", 10)(req, res, (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  PublicationController.createPublication
);
router.get("/", PublicationController.getAllPublications);
// ✅ PUBLIC – أي واحد ينجم يشوف publications
router.get("/public", PublicationController.getAllPublications);

// ✅ GET one publication (protected)
router.get("/:id", verifyToken, PublicationController.getOnePublication);

// ✅ COMMENTS
router.get("/:id/comments", verifyToken, PublicationController.getCommentaires);

// ✅ REACTIONS / ACTIONS
router.post("/react", verifyToken, PublicationController.addReaction);
router.post("/comment", verifyToken, PublicationController.addCommentaire);
router.post("/vote", verifyToken, PublicationController.voteDebat);
router.post("/comment-react", verifyToken, PublicationController.addCommentReaction);

// ✅ DELETE
router.delete("/:id", verifyToken, PublicationController.deletePublication);

module.exports = router;