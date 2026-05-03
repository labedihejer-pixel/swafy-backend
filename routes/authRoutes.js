const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// ✅ IMPORT من authController (نفس الاسم)
const {
  login,
  register,
  sendPassword,
  verifyCode,
  registerFinal
} = require("../controllers/authController");

// ✅ ROUTES AUTH
router.post("/login", login);
router.post("/register", register);
router.post("/send-password-code-v2", sendPassword);
router.post("/verify-code", verifyCode);
router.post("/register-final", registerFinal);

// ✅ ROUTE /me
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token non fourni" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      `SELECT 
        u.id_user, u.nom_user, u.email_user, u.role, u.status_user,
        jp.age, jp.statut, jp.etablissement, jp.gouvernorat_jeune AS gouvernorat, 
        jp.date_naissance, jp.sexe, jp.tel_user
       FROM utilisateurs u
       LEFT JOIN jeune_profiles jp ON u.id_user = jp.user_id
       WHERE u.id_user = ?`,
      [decoded.id_user]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.json({ user: rows[0] });
  } catch (error) {
    console.error("Erreur token:", error.message);
    return res.status(401).json({ message: "Token invalide ou expiré" });
  }
});

module.exports = router;