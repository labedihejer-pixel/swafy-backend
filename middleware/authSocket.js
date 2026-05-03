const jwt = require('jsonwebtoken');

module.exports = (socket, next) => {
    // Njibou el token mel handshake mte3 el socket
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }

    try {
        // Verifi el token (asta3mel nafs el secret li fil auth mte3ek)
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'votre_secret_ici');
        socket.user = decoded; // N-zidou el user l-data mte3 el socket
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
};