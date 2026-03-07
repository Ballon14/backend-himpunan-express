const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { createUploader, getStoragePath, getFileUrl, deleteFile } = require('../middleware/upload');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();
const upload = createUploader('galeri/fotos');

// ─── Format resource (mirrors GaleriResource) ───────────────────────────────
function formatGaleri(row, req) {
    return {
        id: row.id,
        judul: row.judul,
        foto: row.foto ? getFileUrl(req, row.foto) : null,
        kategori: row.kategori,
        tanggal: row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

// GET /api/galeri — Public, paginated
router.get('/', async (req, res) => {
    try {
        const { search, kategori, per_page = 15, page = 1 } = req.query;
        const limit = parseInt(per_page);
        const offset = (parseInt(page) - 1) * limit;

        let query = db('galeris').whereNull('deleted_at');

        if (search) {
            query = query.where(function () {
                this.where('judul', 'like', `%${search}%`)
                    .orWhere('kategori', 'like', `%${search}%`);
            });
        }

        if (kategori) {
            query = query.where('kategori', kategori);
        }

        const totalQuery = query.clone().count('* as total').first();
        const dataQuery = query.clone().orderBy('tanggal', 'desc').limit(limit).offset(offset);

        const [totalResult, rows] = await Promise.all([totalQuery, dataQuery]);
        const total = totalResult.total;

        return successResponse(res, {
            data: rows.map((r) => formatGaleri(r, req)),
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data galeri berhasil diambil.');
    } catch (err) {
        console.error('Galeri index error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// GET /api/galeri/:id — Public
router.get('/:id', async (req, res) => {
    try {
        const row = await db('galeris').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Galeri tidak ditemukan.', 404);
        return successResponse(res, formatGaleri(row, req), 'Detail galeri berhasil diambil.');
    } catch (err) {
        console.error('Galeri show error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// POST /api/galeri — Auth required
router.post(
    '/',
    authMiddleware,
    upload.single('foto'),
    [
        body('judul').notEmpty().withMessage('Judul wajib diisi.').isLength({ max: 255 }),
        body('kategori').notEmpty().withMessage('Kategori wajib diisi.').isLength({ max: 255 }),
        body('tanggal').notEmpty().withMessage('Tanggal wajib diisi.').isISO8601(),
    ],
    validate,
    async (req, res) => {
        try {
            if (!req.file) {
                return errorResponse(res, 'Validasi gagal.', 422, { foto: 'Foto wajib diupload.' });
            }

            const id = uuidv4();
            const now = new Date();

            const data = {
                id,
                judul: req.body.judul,
                foto: getStoragePath('galeri/fotos', req.file.filename),
                kategori: req.body.kategori,
                tanggal: req.body.tanggal,
                created_at: now,
                updated_at: now,
            };

            await db('galeris').insert(data);
            const row = await db('galeris').where('id', id).first();

            return successResponse(res, formatGaleri(row, req), 'Galeri berhasil ditambahkan.', 201);
        } catch (err) {
            console.error('Galeri store error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// PUT /api/galeri/:id — Auth required
router.put(
    '/:id',
    authMiddleware,
    upload.single('foto'),
    [
        body('judul').optional().isLength({ max: 255 }),
        body('kategori').optional().isLength({ max: 255 }),
        body('tanggal').optional().isISO8601(),
    ],
    validate,
    async (req, res) => {
        try {
            const row = await db('galeris').where('id', req.params.id).whereNull('deleted_at').first();
            if (!row) return errorResponse(res, 'Galeri tidak ditemukan.', 404);

            const updates = { updated_at: new Date() };
            if (req.body.judul !== undefined) updates.judul = req.body.judul;
            if (req.body.kategori !== undefined) updates.kategori = req.body.kategori;
            if (req.body.tanggal !== undefined) updates.tanggal = req.body.tanggal;

            if (req.file) {
                if (row.foto) deleteFile(row.foto);
                updates.foto = getStoragePath('galeri/fotos', req.file.filename);
            }

            await db('galeris').where('id', req.params.id).update(updates);
            const updated = await db('galeris').where('id', req.params.id).first();

            return successResponse(res, formatGaleri(updated, req), 'Galeri berhasil diperbarui.');
        } catch (err) {
            console.error('Galeri update error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// DELETE /api/galeri/:id — Auth required (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const row = await db('galeris').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Galeri tidak ditemukan.', 404);

        await db('galeris').where('id', req.params.id).update({ deleted_at: new Date() });
        return successResponse(res, null, 'Galeri berhasil dihapus.');
    } catch (err) {
        console.error('Galeri destroy error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
