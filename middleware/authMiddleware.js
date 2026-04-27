const jwt = require("jsonwebtoken");

// ✅ Vérifier le token JWT
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
   req.user = decoded;

// ✅ نطبع userId باش backend يفهمو
req.user.id_user = decoded.id_user || decoded.id || decoded.userId;

next();


  });
};

// ✅ Vérifier le rôle
const verifyRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "Accès refusé" });
    }
    next();
  };
};

// ✅ Exports compatibles avec tous les usages
module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.verifyRole = verifyRole;