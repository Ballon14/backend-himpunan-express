const jwt = require('jsonwebtoken');
const { errorResponse } = require('../helpers/response');

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return errorResponse(res, 'Token tidak ditemukan. Silakan login.', 401);
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return errorResponse(res, 'Token tidak valid atau sudah expired.', 401);
    }
}

module.exports = authMiddleware;
