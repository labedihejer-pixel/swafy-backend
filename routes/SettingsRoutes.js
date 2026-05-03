// Dans server/routes/profileRoutes.js (ajoute si manquant)
router.put('/update', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { id_user } = req.user; // Depuis ton token
    const { nom_user, prenom_user, email_user, telephone_user, bio_user } = req.body;
    
    let photo_url = req.body.photo_user;
    if (req.file) {
      photo_url = `/uploads/${req.file.filename}`;
      // Ou Cloudinary : const result = await cloudinary.uploader.upload(req.file.path);
    }

    await db.query(
      `UPDATE users SET 
       nom_user=?, prenom_user=?, email_user=?, telephone_user=?, bio_user=?, photo_user=?
       WHERE id_user=?`,
      [nom_user, prenom_user, email_user, telephone_user, bio_user, photo_url, id_user]
    );

    res.json({ success: true, message: 'Profil mis à jour' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});