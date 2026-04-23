const bcrypt = require("bcryptjs");
const db = require("./config/db");

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash("adminadmin", 10);

    const [existing] = await db.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      ["admin@gmail.com"]
    );

    if (existing.length > 0) {
      console.log("⚠️ Admin existe déjà");
      process.exit();
    }

    const [result] = await db.query(
      `INSERT INTO utilisateurs
      (nom_user, email_user, date_naissance, mot_de_passe_user, tel_user, sexe, status_user, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Admin Swafy",
        "admin@gmail.com",
        "1995-01-01",
        hashedPassword,
        "00000000",
        "homme",
        "actif",
        "admin",
      ]
    );

    console.log("✅ Admin ajouté avec succès. ID:", result.insertId);
    process.exit();
  } catch (error) {
    console.error("❌ Erreur createAdmin:", error);
    process.exit();
  }
}

createAdmin();