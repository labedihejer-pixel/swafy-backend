const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const seedAdmin = async () => {
  const email = "admin@gmail.com";
  const plainPassword = "adminadmin";

  // نمسحو admin القديم مهما كان
  await db.execute(
    "DELETE FROM utilisateurs WHERE email_user = ?",
    [email]
  );

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  await db.execute(
    `INSERT INTO utilisateurs 
     (nom_user, email_user, mot_de_passe_user, role, status_user)
     VALUES (?, ?, ?, ?, ?)`,
    ["Admin", email, hashedPassword, "admin", "actif"]
  );

  console.log("✅ ADMIN SEEDED SUCCESSFULLY (admin@gmail.com / adminadmin)");
};

// ===============================
// ✅ LOGIN
// ===============================
const login = async (req, res) => {
  try {
    const { email_user, mot_de_passe_user } = req.body;

    if (!email_user || !mot_de_passe_user) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    const [rows] = await db.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );

    if (rows.length === 0) {
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
        nom_user: user.nom_user,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id_user: user.id_user,
        email_user: user.email_user,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
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


// ===============================
// ✅ SEND PASSWORD CODE (TEST MODE)
// ===============================
const sendPassword = async (req, res) => {
  try {
    const { email_user } = req.body;

    if (!email_user) {
      return res.status(400).json({ message: "Email requis" });
    }

    console.log("📩 TEST sendPassword pour:", email_user);

    // ✅ test فقط (بلا email)
    res.json({
      success: true,
      message: "Code envoyé (TEST MODE)",
      code: "123456" // ✅ كود ثابت للتجربة
    });
  } catch (err) {
    console.error("sendPassword error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// ✅ VERIFY CODE (TEST MODE)
// ===============================
const verifyCode = async (req, res) => {
  try {
    const { email_user, code } = req.body;

    if (code !== "123456") {
      return res.status(401).json({ message: "Code incorrect" });
    }

    const [rows] = await db.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    const user = rows[0];

    const token = jwt.sign(
      {
        id_user: user.id_user,
        email_user: user.email_user,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id_user: user.id_user,
        email_user: user.email_user,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("verifyCode error:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// ✅ REGISTER FINAL (TEST MODE)
// ===============================
const registerFinal = async (req, res) => {
  try {
    res.json({ success: true, message: "Register final OK (TEST MODE)" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
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