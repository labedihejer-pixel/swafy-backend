// middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const base = "uploads";
["photos", "videos", "pdfs"].forEach((f) => {
  const dir = path.join(base, f);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "photos";
    if (file.mimetype.startsWith("video")) folder = "videos";
    if (file.mimetype === "application/pdf") folder = "pdfs";
    cb(null, path.join(base, folder));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

module.exports = multer({ storage });