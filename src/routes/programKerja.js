const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { createUploader, getStoragePath, getFileUrl, deleteFile } = require('../middleware/upload');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();
const upload = createUploader('program-kerja');

// ─── Format resource (mirrors ProgramKerjaResource) ─────────────────────────
function formatProgramKerja(row, req) {
    return {
        id: row.id,
        nama_program: row.nama_program,
        deskripsi: row.deskripsi,
        foto: row.foto ? getFileUrl(req, row.foto) : null,
        tanggal_mulai: row.tanggal_mulai ? new Date(row.tanggal_mulai).toISOString().split('T')[0] : null,
        tanggal_selesai: row.tanggal_selesai ? new Date(row.tanggal_selesai).toISOString().split('T')[0] : null,
        status: row.status,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

// GET /api/program-kerja — Public, paginated
router.get('/', async (req, res) => {
    try {
        const { search, status, per_page = 15, page = 1 } = req.query;
        const limit = parseInt(per_page);
        const offset = (parseInt(page) - 1) * limit;

        let query = db('program_kerjas').whereNull('deleted_at');

        if (search) {
            query = query.where(function () {
                this.where('nama_program', 'like', `%${search}%`)
                    .orWhere('deskripsi', 'like', `%${search}%`);
            });
        }

        if (status) {
            query = query.where('status', status);
        }

        const totalQuery = query.clone().count('* as total').first();
        const dataQuery = query.clone().orderBy('created_at', 'desc').limit(limit).offset(offset);

        const [totalResult, rows] = await Promise.all([totalQuery, dataQuery]);
        const total = totalResult.total;

        return successResponse(res, {
            data: rows.map((r) => formatProgramKerja(r, req)),
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data program kerja berhasil diambil.');
    } catch (err) {
        console.error('ProgramKerja index error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// GET /api/program-kerja/:id — Public
router.get('/:id', async (req, res) => {
    try {
        const row = await db('program_kerjas').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Program kerja tidak ditemukan.', 404);
        return successResponse(res, formatProgramKerja(row, req), 'Detail program kerja berhasil diambil.');
    } catch (err) {
        console.error('ProgramKerja show error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// POST /api/program-kerja — Auth required
router.post(
    '/',
    authMiddleware,
    upload.single('foto'),
    [
        body('nama_program').notEmpty().withMessage('Nama program wajib diisi.').isLength({ max: 255 }),
        body('deskripsi').notEmpty().withMessage('Deskripsi wajib diisi.'),
        body('tanggal_mulai').notEmpty().withMessage('Tanggal mulai wajib diisi.').isISO8601(),
        body('tanggal_selesai').notEmpty().withMessage('Tanggal selesai wajib diisi.').isISO8601(),
        body('status').optional().isIn(['perencanaan', 'berjalan', 'selesai', 'dibatalkan']),
    ],
    validate,
    async (req, res) => {
        try {
            const id = uuidv4();
            const now = new Date();

            const data = {
                id,
                nama_program: req.body.nama_program,
                deskripsi: req.body.deskripsi,
                foto: req.file ? getStoragePath('program-kerja', req.file.filename) : null,
                tanggal_mulai: req.body.tanggal_mulai,
                tanggal_selesai: req.body.tanggal_selesai,
                status: req.body.status || 'perencanaan',
                created_at: now,
                updated_at: now,
            };

            await db('program_kerjas').insert(data);
            const row = await db('program_kerjas').where('id', id).first();

            return successResponse(res, formatProgramKerja(row, req), 'Program kerja berhasil ditambahkan.', 201);
        } catch (err) {
            console.error('ProgramKerja store error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// PUT /api/program-kerja/:id — Auth required
router.put(
    '/:id',
    authMiddleware,
    upload.single('foto'),
    [
        body('nama_program').optional().isLength({ max: 255 }),
        body('deskripsi').optional(),
        body('tanggal_mulai').optional().isISO8601(),
        body('tanggal_selesai').optional().isISO8601(),
        body('status').optional().isIn(['perencanaan', 'berjalan', 'selesai', 'dibatalkan']),
    ],
    validate,
    async (req, res) => {
        try {
            const row = await db('program_kerjas').where('id', req.params.id).whereNull('deleted_at').first();
            if (!row) return errorResponse(res, 'Program kerja tidak ditemukan.', 404);

            const updates = { updated_at: new Date() };
            if (req.body.nama_program !== undefined) updates.nama_program = req.body.nama_program;
            if (req.body.deskripsi !== undefined) updates.deskripsi = req.body.deskripsi;
            if (req.body.tanggal_mulai !== undefined) updates.tanggal_mulai = req.body.tanggal_mulai;
            if (req.body.tanggal_selesai !== undefined) updates.tanggal_selesai = req.body.tanggal_selesai;
            if (req.body.status !== undefined) updates.status = req.body.status;

            if (req.file) {
                if (row.foto) deleteFile(row.foto);
                updates.foto = getStoragePath('program-kerja', req.file.filename);
            }

            await db('program_kerjas').where('id', req.params.id).update(updates);
            const updated = await db('program_kerjas').where('id', req.params.id).first();

            return successResponse(res, formatProgramKerja(updated, req), 'Program kerja berhasil diperbarui.');
        } catch (err) {
            console.error('ProgramKerja update error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// DELETE /api/program-kerja/:id — Auth required (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const row = await db('program_kerjas').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Program kerja tidak ditemukan.', 404);

        await db('program_kerjas').where('id', req.params.id).update({ deleted_at: new Date() });
        return successResponse(res, null, 'Program kerja berhasil dihapus.');
    } catch (err) {
        console.error('ProgramKerja destroy error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
