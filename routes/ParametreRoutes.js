const express = require("express");
const router = express.Router();

const {
  getSettings,
  updateSettings,
} = require("../controllers/ParametreController");

// ✅ GET settings
router.get("/", getSettings);

// ✅ UPDATE settings
router.put("/", updateSettings);

module.exports = router;
