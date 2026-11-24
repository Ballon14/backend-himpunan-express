const express = require('express');
const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { successResponse, errorResponse } = require('../helpers/response');
const logger = require('../helpers/logger');

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
                logger.audit('login gagal', 'auth', req, { actor: email, changes: { email, reason: 'Email tidak ditemukan' } });
                return errorResponse(res, 'Email atau password salah.', 401);
            }

            const isMatch = await bcrypt.compare(password, user.password.replace(/^\$2y\$/, '$2a$'));
            if (!isMatch) {
                logger.audit('login gagal', 'auth', req, { actor: email, changes: { email, reason: 'Password salah' } });
                return errorResponse(res, 'Email atau password salah.', 401);
            }

            const token = jwt.sign(
                { id: user.id, name: user.name, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            logger.audit('login berhasil', 'auth', req, { actor: user.name, changes: { email: user.email } });
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
    logger.audit('logout', 'auth', req);
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

// PUT /api/profile
router.put(
    '/profile',
    authMiddleware,
    [
        body('name').notEmpty().withMessage('Nama wajib diisi.').isLength({ max: 255 }),
        body('email').isEmail().withMessage('Email tidak valid.').isLength({ max: 255 }),
    ],
    validate,
    async (req, res) => {
        try {
            const { name, email } = req.body;
            const existing = await db('users')
                .where('email', email)
                .whereNot('id', req.user.id)
                .first();

            if (existing) {
                return errorResponse(res, 'Email sudah digunakan oleh akun lain.', 422);
            }

            await db('users').where('id', req.user.id).update({
                name,
                email,
                updated_at: new Date(),
            });

            const updatedUser = await db('users').where('id', req.user.id).first();

            const token = jwt.sign(
                { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            logger.audit('memperbarui profil', 'auth', req, { actor: updatedUser.name, changes: { name, email } });

            return successResponse(res, {
                user: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                },
                token,
            }, 'Profil berhasil diperbarui.');
        } catch (err) {
            console.error('Update profile error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// PUT /api/change-password
router.put(
    '/change-password',
    authMiddleware,
    [
        body('current_password').notEmpty().withMessage('Password saat ini wajib diisi.'),
        body('new_password').isLength({ min: 6 }).withMessage('Password baru minimal 6 karakter.'),
        body('confirm_password').custom((value, { req }) => {
            if (value !== req.body.new_password) {
                throw new Error('Konfirmasi password tidak cocok.');
            }
            return true;
        }),
    ],
    validate,
    async (req, res) => {
        try {
            const { current_password, new_password } = req.body;

            const user = await db('users').where('id', req.user.id).first();
            if (!user) {
                return errorResponse(res, 'User tidak ditemukan.', 404);
            }

            const isMatch = await bcrypt.compare(current_password, user.password.replace(/^\$2y\$/, '$2a$'));
            if (!isMatch) {
                return errorResponse(res, 'Password saat ini salah.', 422);
            }

            const hashedPassword = await bcrypt.hash(new_password, 12);
            await db('users').where('id', req.user.id).update({
                password: hashedPassword,
                updated_at: new Date(),
            });

            logger.audit('mengubah password', 'auth', req, { actor: user.name });

            return successResponse(res, null, 'Password berhasil diperbarui.');
        } catch (err) {
            console.error('Change password error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

module.exports = router;
