const express = require("express");
const router = express.Router();

const PublicationController = require("../controllers/PublicationController");
const { verifyToken } = require("../middleware/authMiddleware");
//const { adminOnly } = require("../middleware/adminMiddleware");
const upload = require("../middleware/uploadMiddleware");

/* PUBLICATIONS */
router.post(
  "/",
  verifyToken,
  upload.array("files", 10),
  PublicationController.createPublication
);
router.get("/public", PublicationController.getAllPublications);

/* COMMENTS */
router.post("/comment", verifyToken, PublicationController.addComment);
router.get("/:id/comments", verifyToken, PublicationController.getCommentaires);
router.post("/comment", verifyToken, PublicationController.addComment);
/* REACTIONS */
router.post("/react", verifyToken, PublicationController.addReaction);
router.post("/comment-react", verifyToken, PublicationController.addCommentReaction);
/* ======================================================
   REACTIONS
====================================================== */

// ✅ ADD / UPDATE reaction on a comment (JEUNE + ADMIN)
/*router.post(
  "/comment/:id/reaction",
  verifyToken,
  PublicationController.addCommentReaction
);*/

// ✅ VOTE debat (JEUNE + ADMIN)
/*router.post(
  "/:id/vote",
  verifyToken,
  PublicationController.voteDebat
);*/

module.exports = router;