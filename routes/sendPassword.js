exports.sendPassword = async (req, res) => {
  try {
    const { email_user } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM utilisateurs WHERE email_user = ?",
      [email_user]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Email introuvable" });
    }

    const user = rows[0];

    // ✅ générer password unique
    const newPassword = generateTempPassword(user.nom_user, user.prenom_user);
    const hashed = await bcrypt.hash(newPassword, 10);

    // ✅ update password
    await db.query(
      "UPDATE utilisateurs SET mot_de_passe_user = ? WHERE id_user = ?",
      [hashed, user.id_user]
    );

    // ✅ envoyer email
    await sendMail({
      to: user.email_user,
      subject: "Votre mot de passe",
      html: `<h2>Bonjour ${user.prenom_user}</h2>
             <p>Votre mot de passe: <b>${newPassword}</b></p>`
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("❌ sendPassword:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
