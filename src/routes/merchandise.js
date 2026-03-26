const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { createUploader, getStoragePath, getFileUrl, deleteFile } = require('../middleware/upload');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();
const upload = createUploader('merchandise');

const KATEGORI_LIST = ['kaos', 'jaket', 'topi', 'aksesori', 'lainnya'];

function formatMerchandise(row, req) {
    return {
        id: row.id,
        nama: row.nama,
        deskripsi: row.deskripsi,
        harga: row.harga,
        foto: row.foto ? getFileUrl(req, row.foto) : null,
        kategori: row.kategori,
        is_available: Boolean(row.is_available),
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

// GET /api/merchandise — Public
router.get('/', async (req, res) => {
    try {
        const { kategori, search, per_page = 20, page = 1 } = req.query;
        const limit = parseInt(per_page);
        const offset = (parseInt(page) - 1) * limit;

        let query = db('merchandise').whereNull('deleted_at');
        let countQuery = db('merchandise').whereNull('deleted_at');

        if (kategori && KATEGORI_LIST.includes(kategori)) {
            query = query.where('kategori', kategori);
            countQuery = countQuery.where('kategori', kategori);
        }

        if (search) {
            query = query.where(function () {
                this.where('nama', 'like', `%${search}%`).orWhere('deskripsi', 'like', `%${search}%`);
            });
            countQuery = countQuery.where(function () {
                this.where('nama', 'like', `%${search}%`).orWhere('deskripsi', 'like', `%${search}%`);
            });
        }

        const [{ count: total }] = await countQuery.count('* as count');
        const rows = await query.orderBy('created_at', 'desc').limit(limit).offset(offset).select('*');

        return successResponse(res, {
            data: rows.map((r) => formatMerchandise(r, req)),
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data merchandise berhasil diambil.');
    } catch (err) {
        console.error('Merchandise index error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// GET /api/merchandise/:id — Public
router.get('/:id', async (req, res) => {
    try {
        const row = await db('merchandise').where({ id: req.params.id }).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Merchandise tidak ditemukan.', 404);
        return successResponse(res, formatMerchandise(row, req), 'Detail merchandise berhasil diambil.');
    } catch (err) {
        console.error('Merchandise show error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// POST /api/merchandise — Auth
router.post(
    '/',
    authMiddleware,
    upload.single('foto'),
    [
        body('nama').notEmpty().withMessage('Nama wajib diisi.').isLength({ max: 255 }),
        body('deskripsi').optional({ values: 'falsy' }),
        body('harga').notEmpty().withMessage('Harga wajib diisi.').isInt({ min: 0 }),
        body('kategori').optional().isIn(KATEGORI_LIST),
        body('is_available').optional().isBoolean(),
    ],
    validate,
    async (req, res) => {
        try {
            const id = uuidv4();
            const now = new Date();
            const data = {
                id,
                nama: req.body.nama,
                deskripsi: req.body.deskripsi || null,
                harga: parseInt(req.body.harga),
                foto: req.file ? getStoragePath('merchandise', req.file.filename) : null,
                kategori: req.body.kategori || 'lainnya',
                is_available: req.body.is_available !== undefined ? (req.body.is_available === 'true' || req.body.is_available === true) : true,
                created_at: now,
                updated_at: now,
            };
            await db('merchandise').insert(data);
            const row = await db('merchandise').where({ id }).first();
            return successResponse(res, formatMerchandise(row, req), 'Merchandise berhasil ditambahkan.', 201);
        } catch (err) {
            console.error('Merchandise store error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// PUT /api/merchandise/:id — Auth
router.put(
    '/:id',
    authMiddleware,
    upload.single('foto'),
    [
        body('nama').optional().isLength({ max: 255 }),
        body('deskripsi').optional({ values: 'falsy' }),
        body('harga').optional().isInt({ min: 0 }),
        body('kategori').optional().isIn(KATEGORI_LIST),
        body('is_available').optional().isBoolean(),
    ],
    validate,
    async (req, res) => {
        try {
            const row = await db('merchandise').where({ id: req.params.id }).whereNull('deleted_at').first();
            if (!row) return errorResponse(res, 'Merchandise tidak ditemukan.', 404);

            const updates = { updated_at: new Date() };
            if (req.body.nama !== undefined) updates.nama = req.body.nama;
            if (req.body.deskripsi !== undefined) updates.deskripsi = req.body.deskripsi || null;
            if (req.body.harga !== undefined) updates.harga = parseInt(req.body.harga);
            if (req.body.kategori !== undefined) updates.kategori = req.body.kategori;
            if (req.body.is_available !== undefined) updates.is_available = req.body.is_available === 'true' || req.body.is_available === true;

            if (req.file) {
                if (row.foto) deleteFile(row.foto);
                updates.foto = getStoragePath('merchandise', req.file.filename);
            }

            await db('merchandise').where({ id: req.params.id }).update(updates);
            const updated = await db('merchandise').where({ id: req.params.id }).first();
            return successResponse(res, formatMerchandise(updated, req), 'Merchandise berhasil diperbarui.');
        } catch (err) {
            console.error('Merchandise update error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// DELETE /api/merchandise/:id — Auth (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const row = await db('merchandise').where({ id: req.params.id }).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Merchandise tidak ditemukan.', 404);
        await db('merchandise').where({ id: req.params.id }).update({ deleted_at: new Date() });
        return successResponse(res, null, 'Merchandise berhasil dihapus.');
    } catch (err) {
        console.error('Merchandise destroy error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
