const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "Token manquant" });
  }

  const token = header.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token invalide" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token invalide ou expiré" });
    }

    // ✅ نركّب user structure واضحة
    const userId = decoded.id_user || decoded.id || decoded.userId;

    if (!userId) {
      console.error("❌ verifyToken: id_user absent dans token", decoded);
      return res.status(401).json({ message: "Token invalide (user id manquant)" });
    }

    req.user = {
      ...decoded,
      id_user: userId
    };

    console.log("✅ verifyToken OK, userId =", req.user.id_user);

    next();
  });
};

const verifyRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "Accès refusé" });
    }
    next();
  };
};

module.exports = {
  verifyToken,
  verifyRole,
};