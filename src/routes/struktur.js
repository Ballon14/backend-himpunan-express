const express = require('express');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { createUploader, getFileUrl } = require('../middleware/upload');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();
const upload = createUploader('struktur');

const uploadDir = path.join(__dirname, '../../uploads/struktur');
const defaultImagePath = path.join(__dirname, '../../uploads/struktur/bagan-organisasi.png');

// Helper to get image path and URL info
function getStrukturImageInfo(req) {
    const fileExists = fs.existsSync(defaultImagePath);
    if (!fileExists) {
        return {
            url: null,
            updated_at: null
        };
    }
    const stats = fs.statSync(defaultImagePath);
    const relativePath = 'struktur/bagan-organisasi.png';
    const fullUrl = getFileUrl(req, relativePath);
    return {
        url: `${fullUrl}?t=${stats.mtimeMs}`,
        updated_at: stats.mtime
    };
}

// GET /api/struktur — Get current organogram image URL
router.get('/', (req, res) => {
    try {
        const info = getStrukturImageInfo(req);
        return successResponse(res, info, 'Bagan organisasi berhasil diambil.');
    } catch (err) {
        console.error('Get struktur image error:', err);
        return errorResponse(res, 'Gagal mengambil gambar struktur.', 500);
    }
});

// POST /api/struktur — Upload new organogram image (Auth required)
router.post('/', authMiddleware, upload.single('bagan'), (req, res) => {
    try {
        if (!req.file) {
            return errorResponse(res, 'File gambar wajib diunggah.', 400);
        }

        const tempPath = req.file.path;
        
        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Overwrite the default image path
        if (fs.existsSync(defaultImagePath)) {
            fs.unlinkSync(defaultImagePath);
        }
        
        fs.renameSync(tempPath, defaultImagePath);

        const info = getStrukturImageInfo(req);
        return successResponse(res, info, 'Bagan organisasi berhasil diperbarui.', 200);
    } catch (err) {
        console.error('Upload struktur image error:', err);
        return errorResponse(res, 'Gagal memperbarui gambar struktur.', 500);
    }
});

module.exports = router;
