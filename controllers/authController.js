const { sendEmail } = require("../utils/mailer");
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const https = require("https");
const seedAdmin = async () => {
const email = "admin@gmail.com";
const plainPassword = "adminadmin";
const { sendEmail } = require("../utils/mailer");

  // ✅ شيك هل موجود
  const [rows] = await db.execute(
    "SELECT * FROM utilisateurs WHERE email_user = ?",
    [email]
  );

  if (rows.length > 0) {
    console.log("✅ Admin already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  await db.execute(
  `INSERT INTO utilisateurs (nom_user, email_user, mot_de_passe_user, role, status_user)
   VALUES (?, ?, ?, ?, ?)`,
  ["Admin", email, hashedPassword, "admin", "actif"]
);
  console.log("✅ ADMIN CREATED ONCE");
};


const login = async (req, res) => {
  try {
    const { email_user, mot_de_passe_user } = req.body;

    if (!email_user || !mot_de_passe_user) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const [rows] = await db.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const user = rows[0];

    const validPassword = await bcrypt.compare(
      mot_de_passe_user,
      user.mot_de_passe_user
    );

    if (!validPassword) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const token = jwt.sign(
      {
        id_user: user.id_user,
        email_user: user.email_user,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token, user });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// ✅ REGISTER
// ===============================
const register = async (req, res) => {
  try {
    const { nom_user, email_user, mot_de_passe_user } = req.body;

    const [existing] = await db.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );

    if (existing.length) {
      return res.status(409).json({ message: "Cet email est déjà utilisé" });
    }

    const hash = await bcrypt.hash(mot_de_passe_user, 10);

    await db.query(
      `INSERT INTO utilisateurs (nom_user, email_user, mot_de_passe_user, role, status_user)
       VALUES (?, ?, ?, 'jeune', 'actif')`,
      [nom_user, email_user, hash]
    );

    res.status(201).json({ message: "Inscription réussie" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

const sendPassword = async (req, res) => {
  try {
    const { email_user } = req.body;

    const [existing] = await db.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );

    if (!existing.length) {
      await db.query(
        `INSERT INTO utilisateurs (nom_user, email_user, role, status_user)
         VALUES ('temp', ?, 'jeune', 'inactif')`,
        [email_user]
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    console.log("📤 Sending email to:", email_user);

    await db.query(
      `UPDATE utilisateurs 
       SET verification_code = ?, verification_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) 
       WHERE email_user = ?`,
      [code, email_user]
    );

    // ✅ إرسال email الحقيقي
    await sendEmail(
  email_user,
  "Code de vérification Swafy",
  `
  <p>Bonjour ${existing.length ? existing[0].nom_user : ""},</p>

  <p>Vous avez demandé un code de vérification.</p>

  <p>Votre code est :</p>

  <h2>${code}</h2>

  <p>Ce code est valable 10 minutes.</p>

  <p>Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>

  <p>Cordialement,<br/>L’équipe Swafy</p>
  `
);

    return res.json({
      success: true,
      message: " Code envoyé par email"
    });

  } catch (err) {
    console.error(" sendPassword:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
//  VERIFY CODE (TEST MODE)
// ===============================
const verifyCode = async (req, res) => {
  try {
    const { email_user, code } = req.body;

    const [rows] = await db.query(
      `SELECT * FROM utilisateurs 
       WHERE email_user = ? 
       AND verification_code = ? 
       AND verification_expires > NOW()`,
      [email_user, code]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "Code incorrect ou expiré" });
    }

    const user = rows[0];

    // ✅ نحذف الكود
    await db.query(
      "UPDATE utilisateurs SET verification_code = NULL, verification_expires = NULL WHERE email_user = ?",
      [email_user]
    );

    // ✅ نعطي token مباشرة
    const token = jwt.sign(
      {
        id_user: user.id_user,
        email_user: user.email_user,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({
      success: true,
      token,
      user,
      redirect: "/jeuneLayout"
    });

  } catch (err) {
    console.error("❌ verifyCode error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
// ===============================
// ✅ REGISTER FINAL (PRODUCTION)
// ===============================
const registerFinal = async (req, res) => {
 const {
  nom_user,
  prenom_user,
  date_naissance,
  sexe,
  gouvernorat,
  delegation, 
  ville,
  etablissement,
  statut,
  email_user,
  mot_de_passe_user
} = req.body;

  try {
    // ✅ 1. check code
    const [rows] = await db.query(
      `SELECT * FROM utilisateurs 
       WHERE email_user = ? 
       AND verification_code = ?
       AND verification_expires > NOW()`,
      [email_user, mot_de_passe_user]
    );

    if (!rows.length) {
      return res.status(400).json({
        message: "Code incorrect ou expiré ❌"
      });
    }

    // ✅ 2. hash password
    const hashedPassword = await bcrypt.hash(mot_de_passe_user, 10);

    // ✅ 3. update user
    await db.query(
      `UPDATE utilisateurs
       SET nom_user = ?, prenom_user = ?, date_naissance = ?, sexe = ?,
           mot_de_passe_user = ?, role = 'jeune', status_user = 'actif'
       WHERE email_user = ?`,
      [
        nom_user,
        prenom_user,
        date_naissance,
        sexe,
        hashedPassword,
        email_user
      ]
    );

    // ✅ 4. get userId
    const [userRow] = await db.query(
      "SELECT id_user FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );
    const userId = userRow[0].id_user;

    // ✅ 5. check profile
    const [existingProfile] = await db.query(
      "SELECT * FROM jeune_profiles WHERE user_id = ?",
      [userId]
    );

    // ✅ 6. insert profile only once
    if (!existingProfile.length) {
      await db.query(
        `INSERT INTO jeune_profiles
         (user_id, gouvernorat_jeune, delegation, ville, etablissement, statut, date_naissance, sexe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          gouvernorat,
          delegation,
          ville,
          etablissement,
          statut,
          date_naissance,
          sexe
        ]
      );
    }

    // ✅ 7. clear verification code
    await db.query(
      "UPDATE utilisateurs SET verification_code = NULL, verification_expires = NULL WHERE email_user = ?",
      [email_user]
    );

    // ✅ SUCCESS
    res.status(201).json({
      success: true,
      message: "✅ Inscription jeune réussie",
      id_user: userId
    });

  } catch (err) {
    console.error("❌ registerFinal error:", err);
    res.status(500).json({ message: "Erreur serveur inscription" });
  }
};

module.exports = {
  login,
  register,
  seedAdmin,
  sendPassword,
  verifyCode,
  registerFinal
};