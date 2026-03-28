const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { createUploader, getStoragePath, getFileUrl, deleteFile } = require('../middleware/upload');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();
const upload = createUploader('anggota');

function formatAnggota(row, req) {
    return {
        id: row.id,
        nama: row.nama,
        nim: row.nim,
        angkatan: row.angkatan,
        jabatan: row.jabatan,
        email: row.email,
        instagram: row.instagram,
        linkedin: row.linkedin,
        motto: row.motto,
        foto: row.foto ? getFileUrl(req, row.foto) : null,
        status_aktif: Boolean(row.status_aktif),
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

// GET /api/anggota — Public, paginated
router.get('/', async (req, res) => {
    try {
        const { search, status_aktif, angkatan, per_page = 15, page = 1 } = req.query;
        const limit = parseInt(per_page);
        const offset = (parseInt(page) - 1) * limit;

        let query = db('anggotas').whereNull('deleted_at');

        if (search) {
            query = query.where(function () {
                this.where('nama', 'like', `%${search}%`)
                    .orWhere('nim', 'like', `%${search}%`);
            });
        }

        if (status_aktif !== undefined) {
            query = query.where('status_aktif', status_aktif === 'true' || status_aktif === '1' ? 1 : 0);
        }

        if (angkatan) {
            query = query.where('angkatan', angkatan);
        }

        const totalQuery = query.clone().count('* as total').first();
        const dataQuery = query.clone().orderBy('created_at', 'desc').limit(limit).offset(offset);

        const [totalResult, rows] = await Promise.all([totalQuery, dataQuery]);
        const total = Number(totalResult.total);

        return successResponse(res, {
            data: rows.map((r) => formatAnggota(r, req)),
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data anggota berhasil diambil.');
    } catch (err) {
        console.error('Anggota index error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// GET /api/anggota/:id — Public
router.get('/:id', async (req, res) => {
    try {
        const row = await db('anggotas').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Anggota tidak ditemukan.', 404);
        return successResponse(res, formatAnggota(row, req), 'Detail anggota berhasil diambil.');
    } catch (err) {
        console.error('Anggota show error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// POST /api/anggota — Auth required
router.post(
    '/',
    authMiddleware,
    upload.single('foto'),
    [
        body('nama').notEmpty().withMessage('Nama wajib diisi.').isLength({ max: 255 }),
        body('nim').notEmpty().withMessage('NIM wajib diisi.').isLength({ max: 50 }),
        body('angkatan').notEmpty().withMessage('Angkatan wajib diisi.').isLength({ max: 10 }),
        body('jabatan').optional({ values: 'falsy' }).isLength({ max: 255 }),
        body('email').optional({ values: 'falsy' }).isEmail().withMessage('Format email salah.').isLength({ max: 255 }),
        body('instagram').optional({ values: 'falsy' }).isLength({ max: 255 }),
        body('linkedin').optional({ values: 'falsy' }).isLength({ max: 255 }),
        body('motto').optional({ values: 'falsy' }).isLength({ max: 500 }),
        body('status_aktif').optional().isBoolean(),
    ],
    validate,
    async (req, res) => {
        try {
            // Check unique NIM
            const existing = await db('anggotas').where('nim', req.body.nim).whereNull('deleted_at').first();
            if (existing) return errorResponse(res, 'Validasi gagal.', 422, { nim: 'NIM sudah digunakan.' });

            const id = uuidv4();
            const now = new Date();

            const data = {
                id,
                nama: req.body.nama,
                nim: req.body.nim,
                angkatan: req.body.angkatan,
                jabatan: req.body.jabatan || null,
                email: req.body.email || null,
                instagram: req.body.instagram || null,
                linkedin: req.body.linkedin || null,
                motto: req.body.motto || null,
                foto: req.file ? getStoragePath('anggota', req.file.filename) : null,
                status_aktif: req.body.status_aktif !== undefined ? (req.body.status_aktif === 'true' || req.body.status_aktif === true) : true,
                created_at: now,
                updated_at: now,
            };

            await db('anggotas').insert(data);
            const row = await db('anggotas').where('id', id).first();

            return successResponse(res, formatAnggota(row, req), 'Anggota berhasil ditambahkan.', 201);
        } catch (err) {
            console.error('Anggota store error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// PUT /api/anggota/:id — Auth required
router.put(
    '/:id',
    authMiddleware,
    upload.single('foto'),
    [
        body('nama').optional().isLength({ max: 255 }),
        body('nim').optional().isLength({ max: 50 }),
        body('angkatan').optional().isLength({ max: 10 }),
        body('jabatan').optional({ values: 'falsy' }).isLength({ max: 255 }),
        body('email').optional({ values: 'falsy' }).isEmail().withMessage('Format email salah.').isLength({ max: 255 }),
        body('instagram').optional({ values: 'falsy' }).isLength({ max: 255 }),
        body('linkedin').optional({ values: 'falsy' }).isLength({ max: 255 }),
        body('motto').optional({ values: 'falsy' }).isLength({ max: 500 }),
        body('status_aktif').optional().isBoolean(),
    ],
    validate,
    async (req, res) => {
        try {
            const row = await db('anggotas').where('id', req.params.id).whereNull('deleted_at').first();
            if (!row) return errorResponse(res, 'Anggota tidak ditemukan.', 404);

            // Check unique NIM if changed
            if (req.body.nim && req.body.nim !== row.nim) {
                const existing = await db('anggotas')
                    .where('nim', req.body.nim)
                    .whereNull('deleted_at')
                    .whereNot('id', req.params.id)
                    .first();
                if (existing) return errorResponse(res, 'Validasi gagal.', 422, { nim: 'NIM sudah digunakan.' });
            }

            const updates = { updated_at: new Date() };
            if (req.body.nama !== undefined) updates.nama = req.body.nama;
            if (req.body.nim !== undefined) updates.nim = req.body.nim;
            if (req.body.angkatan !== undefined) updates.angkatan = req.body.angkatan;
            if (req.body.jabatan !== undefined) updates.jabatan = req.body.jabatan || null;
            if (req.body.email !== undefined) updates.email = req.body.email || null;
            if (req.body.instagram !== undefined) updates.instagram = req.body.instagram || null;
            if (req.body.linkedin !== undefined) updates.linkedin = req.body.linkedin || null;
            if (req.body.motto !== undefined) updates.motto = req.body.motto || null;
            if (req.body.status_aktif !== undefined) updates.status_aktif = req.body.status_aktif === 'true' || req.body.status_aktif === true;

            if (req.file) {
                if (row.foto) deleteFile(row.foto);
                updates.foto = getStoragePath('anggota', req.file.filename);
            }

            await db('anggotas').where('id', req.params.id).update(updates);
            const updated = await db('anggotas').where('id', req.params.id).first();

            return successResponse(res, formatAnggota(updated, req), 'Anggota berhasil diperbarui.');
        } catch (err) {
            console.error('Anggota update error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// DELETE /api/anggota/:id — Auth required (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const row = await db('anggotas').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Anggota tidak ditemukan.', 404);

        await db('anggotas').where('id', req.params.id).update({ deleted_at: new Date() });

        return successResponse(res, null, 'Anggota berhasil dihapus.');
    } catch (err) {
        console.error('Anggota destroy error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
