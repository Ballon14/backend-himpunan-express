const express = require('express');
const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();

// POST /api/login
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Email tidak valid.'),
        body('password').notEmpty().withMessage('Password wajib diisi.'),
    ],
    validate,
    async (req, res) => {
        try {
            const { email, password } = req.body;

            const user = await db('users').where('email', email).first();
            if (!user) {
                return errorResponse(res, 'Email atau password salah.', 401);
            }

            const isMatch = await bcrypt.compare(password, user.password.replace(/^\$2y\$/, '$2a$'));
            if (!isMatch) {
                return errorResponse(res, 'Email atau password salah.', 401);
            }

            const token = jwt.sign(
                { id: user.id, name: user.name, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return successResponse(res, {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
                token,
            }, 'Login berhasil.');
        } catch (err) {
            console.error('Login error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// POST /api/logout (JWT is stateless, just acknowledge)
router.post('/logout', authMiddleware, (req, res) => {
    return successResponse(res, null, 'Logout berhasil.');
});

// GET /api/me
router.get('/me', authMiddleware, (req, res) => {
    return successResponse(res, {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
    });
});

module.exports = router;
