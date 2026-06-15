const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { createUploader, getStoragePath, getFileUrl, deleteFile } = require('../middleware/upload');
const { successResponse, errorResponse, parsePagination } = require('../helpers/response');
const logger = require('../helpers/logger');

const router = express.Router();
const upload = createUploader('prestasi/fotos');

// ─── Format resource ────────────────────────────────────────────────────────
function formatPrestasi(row, req) {
    return {
        id: row.id,
        judul: row.judul,
        deskripsi: row.deskripsi || null,
        foto: row.foto ? getFileUrl(req, row.foto) : null,
        kategori: row.kategori,
        penerima: row.penerima || null,
        tanggal: row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : null,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

// GET /api/prestasi — Public, paginated
router.get('/', async (req, res) => {
    try {
        const { search, kategori } = req.query;
        const { page, limit, offset } = parsePagination(req.query);

        let query = db('prestasis').whereNull('deleted_at');

        if (search) {
            query = query.where(function () {
                this.where('judul', 'like', `%${search}%`)
                    .orWhere('kategori', 'like', `%${search}%`)
                    .orWhere('penerima', 'like', `%${search}%`);
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
            data: rows.map((r) => formatPrestasi(r, req)),
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data prestasi berhasil diambil.');
    } catch (err) {
        console.error('Prestasi index error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// GET /api/prestasi/:id — Public
router.get('/:id', async (req, res) => {
    try {
        const row = await db('prestasis').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Prestasi tidak ditemukan.', 404);
        return successResponse(res, formatPrestasi(row, req), 'Detail prestasi berhasil diambil.');
    } catch (err) {
        console.error('Prestasi show error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// POST /api/prestasi — Auth required
router.post(
    '/',
    authMiddleware,
    upload.single('foto'),
    [
        body('judul').notEmpty().withMessage('Judul wajib diisi.').isLength({ max: 255 }),
        body('kategori').notEmpty().withMessage('Kategori wajib diisi.').isLength({ max: 255 }),
        body('tanggal').notEmpty().withMessage('Tanggal wajib diisi.').isISO8601(),
        body('penerima').optional().isLength({ max: 255 }),
        body('deskripsi').optional(),
    ],
    validate,
    async (req, res) => {
        try {
            const id = uuidv4();
            const now = new Date();

            const data = {
                id,
                judul: req.body.judul,
                deskripsi: req.body.deskripsi || null,
                kategori: req.body.kategori,
                penerima: req.body.penerima || null,
                tanggal: req.body.tanggal,
                created_at: now,
                updated_at: now,
            };

            if (req.file) {
                data.foto = getStoragePath('prestasi/fotos', req.file.filename);
            }

            await db('prestasis').insert(data);
            const row = await db('prestasis').where('id', id).first();

            logger.audit('membuat', 'prestasi', req, { resourceId: id, changes: req.body });
            return successResponse(res, formatPrestasi(row, req), 'Prestasi berhasil ditambahkan.', 201);
        } catch (err) {
            console.error('Prestasi store error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// PUT /api/prestasi/:id — Auth required
router.put(
    '/:id',
    authMiddleware,
    upload.single('foto'),
    [
        body('judul').optional().isLength({ max: 255 }),
        body('kategori').optional().isLength({ max: 255 }),
        body('tanggal').optional().isISO8601(),
        body('penerima').optional().isLength({ max: 255 }),
        body('deskripsi').optional(),
    ],
    validate,
    async (req, res) => {
        try {
            const row = await db('prestasis').where('id', req.params.id).whereNull('deleted_at').first();
            if (!row) return errorResponse(res, 'Prestasi tidak ditemukan.', 404);

            const updates = { updated_at: new Date() };
            if (req.body.judul !== undefined) updates.judul = req.body.judul;
            if (req.body.deskripsi !== undefined) updates.deskripsi = req.body.deskripsi;
            if (req.body.kategori !== undefined) updates.kategori = req.body.kategori;
            if (req.body.penerima !== undefined) updates.penerima = req.body.penerima;
            if (req.body.tanggal !== undefined) updates.tanggal = req.body.tanggal;

            if (req.file) {
                if (row.foto) deleteFile(row.foto);
                updates.foto = getStoragePath('prestasi/fotos', req.file.filename);
            }

            await db('prestasis').where('id', req.params.id).update(updates);
            const updated = await db('prestasis').where('id', req.params.id).first();

            logger.audit('memperbarui', 'prestasi', req, { resourceId: req.params.id });
            return successResponse(res, formatPrestasi(updated, req), 'Prestasi berhasil diperbarui.');
        } catch (err) {
            console.error('Prestasi update error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// DELETE /api/prestasi/:id — Auth required (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const row = await db('prestasis').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Prestasi tidak ditemukan.', 404);

        await db('prestasis').where('id', req.params.id).update({ deleted_at: new Date() });

        logger.audit('menghapus', 'prestasi', req, { resourceId: req.params.id });
        return successResponse(res, null, 'Prestasi berhasil dihapus.');
    } catch (err) {
        console.error('Prestasi destroy error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
