const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { successResponse, errorResponse, parsePagination } = require('../helpers/response');

const router = express.Router();

// ─── Format resource ────────────────────────────────────────────────────────
function formatPesan(row) {
    return {
        id: row.id,
        nama: row.nama,
        email: row.email,
        isi_pesan: row.isi_pesan,
        is_read: Boolean(row.is_read),
        read_at: row.read_at ? new Date(row.read_at).toISOString() : null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

// POST /api/pesan — Public form submission
router.post(
    '/',
    [
        body('nama').notEmpty().withMessage('Nama wajib diisi.').isLength({ max: 100 }),
        body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email tidak valid.').isLength({ max: 100 }),
        body('isi_pesan').notEmpty().withMessage('Isi pesan wajib diisi.'),
    ],
    validate,
    async (req, res) => {
        try {
            const now = new Date();
            const [id] = await db('pesans').insert({
                nama: req.body.nama,
                email: req.body.email || null,
                isi_pesan: req.body.isi_pesan,
                is_read: false,
                read_at: null,
                created_at: now,
                updated_at: now,
            });

            const row = await db('pesans').where('id', id).first();
            return successResponse(res, formatPesan(row), 'Pesan berhasil dikirim.', 201);
        } catch (err) {
            console.error('Pesan store error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// GET /api/pesan — Auth required (admin: list all)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { search, is_read } = req.query;
        const { page, limit, offset } = parsePagination(req.query);

        let query = db('pesans').whereNull('deleted_at');

        if (search) {
            query = query.where(function () {
                this.where('nama', 'like', `%${search}%`)
                    .orWhere('email', 'like', `%${search}%`)
                    .orWhere('isi_pesan', 'like', `%${search}%`);
            });
        }

        if (is_read !== undefined) {
            query = query.where('is_read', is_read === 'true' || is_read === '1' ? 1 : 0);
        }

        const totalQuery = query.clone().count('* as total').first();
        const unreadQuery = db('pesans').whereNull('deleted_at').where('is_read', false).count('* as count').first();
        const dataQuery = query.clone().orderBy('created_at', 'desc').limit(limit).offset(offset);

        const [totalResult, unreadResult, rows] = await Promise.all([totalQuery, unreadQuery, dataQuery]);
        const total = totalResult.total;

        return successResponse(res, {
            data: rows.map(formatPesan),
            unread_count: unreadResult.count,
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data pesan berhasil diambil.');
    } catch (err) {
        console.error('Pesan index error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// PATCH /api/pesan/:id/read — Auth required (mark as read)
router.patch('/:id/read', authMiddleware, async (req, res) => {
    try {
        const row = await db('pesans').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Pesan tidak ditemukan.', 404);

        if (!row.is_read) {
            await db('pesans').where('id', req.params.id).update({
                is_read: true,
                read_at: new Date(),
                updated_at: new Date(),
            });
        }

        const updated = await db('pesans').where('id', req.params.id).first();
        return successResponse(res, formatPesan(updated), 'Pesan ditandai sudah dibaca.');
    } catch (err) {
        console.error('Pesan markAsRead error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// DELETE /api/pesan/:id — Auth required (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const row = await db('pesans').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Pesan tidak ditemukan.', 404);

        await db('pesans').where('id', req.params.id).update({ deleted_at: new Date() });
        return successResponse(res, null, 'Pesan berhasil dihapus.');
    } catch (err) {
        console.error('Pesan destroy error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
