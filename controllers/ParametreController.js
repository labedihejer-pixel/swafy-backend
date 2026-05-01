// ✅ Paramètres par défaut (تنجم تربطهم بالـ DB بعد)
let settings = {
  liveEnabled: true,
  enqueteEnabled: true,
  participantsPublic: true,
  language: "fr",
  notifications: true,
  autoArchiveLive: true,
};

// ✅ GET /settings
exports.getSettings = async (req, res) => {
  try {
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la récupération des paramètres",
    });
  }
};

// ✅ PUT /settings
exports.updateSettings = async (req, res) => {
  try {
    settings = {
      ...settings,
      ...req.body,
    };

    res.status(200).json({
      message: "Paramètres mis à jour avec succès",
      settings,
    });
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour des paramètres",
    });
  }
};
