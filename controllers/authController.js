const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// LOGIN (دائماً من جدول utilisateurs)
const login = async (req, res) => {
  try {
    console.log("📥 BODY LOGIN:", req.body);
    const { email_user, mot_de_passe_user } = req.body;

    if (!email_user || !mot_de_passe_user) {
      return res.status(400).json({ message: "Email et mot de passe requis" });
    }

    // ✅ نلقاوه في utilisateurs
    const [rows] = await db.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const user = rows[0];

    const validPassword = await bcrypt.compare(mot_de_passe_user, user.mot_de_passe_user);
    if (!validPassword) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    const token = jwt.sign(
  { 
    id: user.id_user,            // ✅ ✅ ✅ مهم
    id_user: user.id_user,
    email_user: user.email_user, 
    role: user.role,
    nom_user: user.nom_user
  },
  process.env.JWT_SECRET,
  { expiresIn: "24h" }
);

    return res.status(200).json({
      message: "Connexion réussie",
      token,
      user: {
        id_user: user.id_user,
        nom_user: user.nom_user,
        email_user: user.email_user,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("❌ LOGIN ERROR:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// REGISTER (في الجدولين في نفس الوقت)
const register = async (req, res) => {
  const connection = await db.getConnection(); // ✅ ناخدوا connection للـ Transaction
  try {
    console.log("📥 BODY REGISTER:", req.body);
    const {
      nom_user, email_user, date_naissance, age,
      mot_de_passe_user, sexe, statut, etablissement,
      gouvernorat, tel_user,
    } = req.body;

    if (!nom_user || !email_user || !date_naissance || !mot_de_passe_user || !sexe || !statut || !etablissement || !gouvernorat) {
      return res.status(400).json({ message: "Tous les champs sont obligatoires" });
    }

    // ✅ نتأكدوا الإيميل ما يتكررش في utilisateurs
    const [existing] = await connection.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Cet email est déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(mot_de_passe_user, 10);

    // ✅ نبداوا Transaction
    await connection.beginTransaction();

    // 1️⃣ نزيدوه في utilisateurs
    const [userResult] = await connection.query(
      `INSERT INTO utilisateurs (nom_user, email_user, mot_de_passe_user, role, status_user)
       VALUES (?, ?, ?, ?, ?)`,
      [nom_user, email_user, hashedPassword, "jeune", "actif"]
    );

    const newUserId = userResult.insertId; // ✅ هادا هو id_user تاعو

    // 2️⃣ نزيدوا بروفايلو في jeune_profiles بالـ id_user اللي جبناه
    await connection.query(
      `INSERT INTO jeune_profiles 
      (user_id, age, statut, etablissement, gouvernorat_jeune, date_naissance, sexe, tel_user)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUserId,               // ✅ Foreign key
        age || null, 
        statut, 
        etablissement, 
        gouvernorat,             // ✅ gouvernorat_jeune في الجدول
        date_naissance, 
        sexe, 
        tel_user || null
      ]
    );

    // ✅ كولشي مزيان، نرسلو للقاعدة
    await connection.commit();

  const token = jwt.sign(
  { 
    id: newUserId,                // ✅ ✅
    id_user: newUserId,
    email_user, 
    role: "jeune",
    nom_user
  },
  process.env.JWT_SECRET,
  { expiresIn: "24h" }
);

    return res.status(201).json({
      message: "Inscription réussie",
      token,
      user: {
        id_user: newUserId,
        nom_user,
        email_user,
        role: "jeune",
      },
    });
  } catch (error) {
    // ❌ إذا كان خطأ، نرجعو كلشي كيف كان
    await connection.rollback();
    console.error("❌ REGISTER ERROR:", error);
    return res.status(500).json({ message: "Erreur serveur: " + error.message });
  } finally {
    connection.release(); // ✅ نحرروا الـ connection
  }
};

module.exports = { login, register };