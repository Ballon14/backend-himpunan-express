const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();

const KATEGORI_LIST = ['rapat', 'seminar', 'sosial', 'lainnya'];

function formatKegiatan(row) {
    return {
        id: row.id,
        judul: row.judul,
        deskripsi: row.deskripsi,
        tanggal_mulai: row.tanggal_mulai ? new Date(row.tanggal_mulai).toISOString() : null,
        tanggal_selesai: row.tanggal_selesai ? new Date(row.tanggal_selesai).toISOString() : null,
        lokasi: row.lokasi,
        kategori: row.kategori,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

// GET /api/kegiatan — Public, with optional month/year filter
router.get('/', async (req, res) => {
    try {
        const { search, bulan, tahun, kategori, per_page = 50, page = 1 } = req.query;
        const limit = parseInt(per_page);
        const offset = (parseInt(page) - 1) * limit;

        let query = db('kegiatan').whereNull('deleted_at');
        let countQuery = db('kegiatan').whereNull('deleted_at');

        if (search) {
            query = query.where(function () {
                this.where('judul', 'like', `%${search}%`)
                    .orWhere('deskripsi', 'like', `%${search}%`)
                    .orWhere('lokasi', 'like', `%${search}%`);
            });
            countQuery = countQuery.where(function () {
                this.where('judul', 'like', `%${search}%`)
                    .orWhere('deskripsi', 'like', `%${search}%`)
                    .orWhere('lokasi', 'like', `%${search}%`);
            });
        }

        if (bulan && tahun) {
            query = query.whereRaw('MONTH(tanggal_mulai) = ? AND YEAR(tanggal_mulai) = ?', [bulan, tahun]);
            countQuery = countQuery.whereRaw('MONTH(tanggal_mulai) = ? AND YEAR(tanggal_mulai) = ?', [bulan, tahun]);
        } else if (tahun) {
            query = query.whereRaw('YEAR(tanggal_mulai) = ?', [tahun]);
            countQuery = countQuery.whereRaw('YEAR(tanggal_mulai) = ?', [tahun]);
        }

        if (kategori && KATEGORI_LIST.includes(kategori)) {
            query = query.where('kategori', kategori);
            countQuery = countQuery.where('kategori', kategori);
        }

        const [{ count: total }] = await countQuery.count('* as count');
        const rows = await query.orderBy('tanggal_mulai', 'asc').limit(limit).offset(offset).select('*');

        return successResponse(res, {
            data: rows.map(formatKegiatan),
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data kegiatan berhasil diambil.');
    } catch (err) {
        console.error('Kegiatan index error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// GET /api/kegiatan/:id — Public
router.get('/:id', async (req, res) => {
    try {
        const row = await db('kegiatan').where({ id: req.params.id }).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Kegiatan tidak ditemukan.', 404);
        return successResponse(res, formatKegiatan(row), 'Detail kegiatan berhasil diambil.');
    } catch (err) {
        console.error('Kegiatan show error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// POST /api/kegiatan — Auth
router.post(
    '/',
    authMiddleware,
    [
        body('judul').notEmpty().withMessage('Judul wajib diisi.').isLength({ max: 255 }),
        body('deskripsi').optional({ values: 'falsy' }),
        body('tanggal_mulai').notEmpty().withMessage('Tanggal mulai wajib diisi.').isISO8601(),
        body('tanggal_selesai').optional({ values: 'falsy' }).isISO8601(),
        body('lokasi').optional({ values: 'falsy' }).isLength({ max: 255 }),
        body('kategori').optional().isIn(KATEGORI_LIST),
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
                tanggal_mulai: new Date(req.body.tanggal_mulai),
                tanggal_selesai: req.body.tanggal_selesai ? new Date(req.body.tanggal_selesai) : null,
                lokasi: req.body.lokasi || null,
                kategori: req.body.kategori || 'lainnya',
                created_at: now,
                updated_at: now,
            };
            await db('kegiatan').insert(data);
            const row = await db('kegiatan').where({ id }).first();
            return successResponse(res, formatKegiatan(row), 'Kegiatan berhasil ditambahkan.', 201);
        } catch (err) {
            console.error('Kegiatan store error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// PUT /api/kegiatan/:id — Auth
router.put(
    '/:id',
    authMiddleware,
    [
        body('judul').optional().isLength({ max: 255 }),
        body('deskripsi').optional({ values: 'falsy' }),
        body('tanggal_mulai').optional().isISO8601(),
        body('tanggal_selesai').optional({ values: 'falsy' }).isISO8601(),
        body('lokasi').optional({ values: 'falsy' }).isLength({ max: 255 }),
        body('kategori').optional().isIn(KATEGORI_LIST),
    ],
    validate,
    async (req, res) => {
        try {
            const row = await db('kegiatan').where({ id: req.params.id }).whereNull('deleted_at').first();
            if (!row) return errorResponse(res, 'Kegiatan tidak ditemukan.', 404);

            const updates = { updated_at: new Date() };
            if (req.body.judul !== undefined) updates.judul = req.body.judul;
            if (req.body.deskripsi !== undefined) updates.deskripsi = req.body.deskripsi || null;
            if (req.body.tanggal_mulai !== undefined) updates.tanggal_mulai = new Date(req.body.tanggal_mulai);
            if (req.body.tanggal_selesai !== undefined) updates.tanggal_selesai = req.body.tanggal_selesai ? new Date(req.body.tanggal_selesai) : null;
            if (req.body.lokasi !== undefined) updates.lokasi = req.body.lokasi || null;
            if (req.body.kategori !== undefined) updates.kategori = req.body.kategori;

            await db('kegiatan').where({ id: req.params.id }).update(updates);
            const updated = await db('kegiatan').where({ id: req.params.id }).first();
            return successResponse(res, formatKegiatan(updated), 'Kegiatan berhasil diperbarui.');
        } catch (err) {
            console.error('Kegiatan update error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// DELETE /api/kegiatan/:id — Auth (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const row = await db('kegiatan').where({ id: req.params.id }).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Kegiatan tidak ditemukan.', 404);
        await db('kegiatan').where({ id: req.params.id }).update({ deleted_at: new Date() });
        return successResponse(res, null, 'Kegiatan berhasil dihapus.');
    } catch (err) {
        console.error('Kegiatan destroy error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
