const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const slugify = require('slugify');
const db = require('../config/database');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { createUploader, getStoragePath, getFileUrl, deleteFile } = require('../middleware/upload');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();
const upload = createUploader('berita/thumbnails');

function randomStr(len = 5) {
    return Math.random().toString(36).substring(2, 2 + len);
}

// ─── Format resource (mirrors BeritaResource) ───────────────────────────────
function formatBerita(row, req) {
    return {
        id: row.id,
        judul: row.judul,
        slug: row.slug,
        isi: row.isi,
        thumbnail: row.thumbnail ? getFileUrl(req, row.thumbnail) : null,
        published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
        status: row.status,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    };
}

// GET /api/berita — Public (published only)
router.get('/', async (req, res) => {
    try {
        const { search, status, per_page = 15, page = 1 } = req.query;
        const limit = parseInt(per_page);
        const offset = (parseInt(page) - 1) * limit;

        let query = db('beritas').whereNull('deleted_at').where('status', 'published');

        if (search) {
            query = query.where(function () {
                this.where('judul', 'like', `%${search}%`)
                    .orWhere('isi', 'like', `%${search}%`);
            });
        }

        const totalQuery = query.clone().count('* as total').first();
        const dataQuery = query.clone().orderBy('created_at', 'desc').limit(limit).offset(offset);

        const [totalResult, rows] = await Promise.all([totalQuery, dataQuery]);
        const total = totalResult.total;

        return successResponse(res, {
            data: rows.map((r) => formatBerita(r, req)),
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data berita berhasil diambil.');
    } catch (err) {
        console.error('Berita index error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// GET /api/berita/all — Auth required (all statuses for admin)
router.get('/all', authMiddleware, async (req, res) => {
    try {
        const { search, status, per_page = 15, page = 1 } = req.query;
        const limit = parseInt(per_page);
        const offset = (parseInt(page) - 1) * limit;

        let query = db('beritas').whereNull('deleted_at');

        if (search) {
            query = query.where(function () {
                this.where('judul', 'like', `%${search}%`)
                    .orWhere('isi', 'like', `%${search}%`);
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
            data: rows.map((r) => formatBerita(r, req)),
            meta: {
                current_page: parseInt(page),
                per_page: limit,
                total,
                last_page: Math.ceil(total / limit),
            },
        }, 'Data berita berhasil diambil.');
    } catch (err) {
        console.error('Berita all error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// GET /api/berita/:slug — Public (published only, by slug)
router.get('/:slug', async (req, res) => {
    try {
        const row = await db('beritas')
            .where('slug', req.params.slug)
            .where('status', 'published')
            .whereNull('deleted_at')
            .first();

        if (!row) return errorResponse(res, 'Berita tidak ditemukan.', 404);
        return successResponse(res, formatBerita(row, req), 'Detail berita berhasil diambil.');
    } catch (err) {
        console.error('Berita show error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// POST /api/berita — Auth required
router.post(
    '/',
    authMiddleware,
    upload.single('thumbnail'),
    [
        body('judul').notEmpty().withMessage('Judul wajib diisi.').isLength({ max: 255 }),
        body('isi').notEmpty().withMessage('Isi wajib diisi.'),
        body('published_at').optional({ values: 'falsy' }).isISO8601(),
        body('status').optional().isIn(['draft', 'published']),
    ],
    validate,
    async (req, res) => {
        try {
            const id = uuidv4();
            const now = new Date();
            const slug = slugify(req.body.judul, { lower: true, strict: true }) + '-' + randomStr();

            const data = {
                id,
                judul: req.body.judul,
                slug,
                isi: req.body.isi,
                thumbnail: req.file ? getStoragePath('berita/thumbnails', req.file.filename) : null,
                published_at: req.body.published_at || null,
                status: req.body.status || 'draft',
                created_at: now,
                updated_at: now,
            };

            await db('beritas').insert(data);
            const row = await db('beritas').where('id', id).first();

            return successResponse(res, formatBerita(row, req), 'Berita berhasil ditambahkan.', 201);
        } catch (err) {
            console.error('Berita store error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// PUT /api/berita/:id — Auth required
router.put(
    '/:id',
    authMiddleware,
    upload.single('thumbnail'),
    [
        body('judul').optional().isLength({ max: 255 }),
        body('isi').optional(),
        body('published_at').optional({ values: 'falsy' }).isISO8601(),
        body('status').optional().isIn(['draft', 'published']),
    ],
    validate,
    async (req, res) => {
        try {
            const row = await db('beritas').where('id', req.params.id).whereNull('deleted_at').first();
            if (!row) return errorResponse(res, 'Berita tidak ditemukan.', 404);

            const updates = { updated_at: new Date() };
            if (req.body.judul !== undefined) {
                updates.judul = req.body.judul;
                if (req.body.judul !== row.judul) {
                    updates.slug = slugify(req.body.judul, { lower: true, strict: true }) + '-' + randomStr();
                }
            }
            if (req.body.isi !== undefined) updates.isi = req.body.isi;
            if (req.body.published_at !== undefined) updates.published_at = req.body.published_at || null;
            if (req.body.status !== undefined) updates.status = req.body.status;

            if (req.file) {
                if (row.thumbnail) deleteFile(row.thumbnail);
                updates.thumbnail = getStoragePath('berita/thumbnails', req.file.filename);
            }

            await db('beritas').where('id', req.params.id).update(updates);
            const updated = await db('beritas').where('id', req.params.id).first();

            return successResponse(res, formatBerita(updated, req), 'Berita berhasil diperbarui.');
        } catch (err) {
            console.error('Berita update error:', err);
            return errorResponse(res, 'Terjadi kesalahan server.', 500);
        }
    }
);

// DELETE /api/berita/:id — Auth required (soft delete)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const row = await db('beritas').where('id', req.params.id).whereNull('deleted_at').first();
        if (!row) return errorResponse(res, 'Berita tidak ditemukan.', 404);

        await db('beritas').where('id', req.params.id).update({ deleted_at: new Date() });
        return successResponse(res, null, 'Berita berhasil dihapus.');
    } catch (err) {
        console.error('Berita destroy error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
