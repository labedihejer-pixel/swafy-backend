const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  req.user = {
    id_user: 1,
    role: "jeune"
  };
  next();
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