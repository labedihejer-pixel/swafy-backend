const db = require("../config/db");

exports.search = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ users: [], publications: [] });

    const limit = Math.min(Number(req.query.limit || 5), 20);

    // starts with q OR word starts with q
    const q1 = `${q}%`;
    const q2 = `% ${q}%`;

    const [users] = await db.query(
      `SELECT id_user, nom_user, email_user, photo_user, sexe
       FROM utilisateurs
       WHERE (nom_user LIKE ? OR nom_user LIKE ? OR email_user LIKE ?)
       AND status_user = 'actif'
       LIMIT ?`,
      [q1, q2, q1, limit]
    );

    const [publications] = await db.query(
      `SELECT id_publication, type_publication, titre_publication, contenu, question_debat, date_publication
       FROM publications
       WHERE status_publication = 'publie'
       AND (
         titre_publication LIKE ? OR titre_publication LIKE ?
         OR contenu LIKE ? OR contenu LIKE ?
         OR question_debat LIKE ? OR question_debat LIKE ?
       )
       ORDER BY date_publication DESC
       LIMIT ?`,
      [q1, q2, q1, q2, q1, q2, limit]
    );

    res.json({ users, publications });
  } catch (err) {
    console.error("search:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};