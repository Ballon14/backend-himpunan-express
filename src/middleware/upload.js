const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');

// Ensure base upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Creates a multer upload middleware for a specific sub-directory.
 * @param {string} subDir - Sub-directory under uploads/ (e.g. 'berita/thumbnails')
 */
function createUploader(subDir) {
    const dest = path.join(uploadDir, subDir);
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, dest);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `${uuidv4()}${ext}`);
        },
    });

    const fileFilter = (req, file, cb) => {
        const allowedExts = ['.jpeg', '.jpg', '.png', '.webp'];
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        const mime = file.mimetype;

        if (allowedExts.includes(ext) && allowedMimes.includes(mime)) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar (jpeg, jpg, png, webp) yang diperbolehkan.'), false);
        }
    };

    return multer({
        storage,
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    });
}

/**
 * Returns the relative path for a stored file (for DB storage).
 * @param {string} subDir
 * @param {string} filename
 */
function getStoragePath(subDir, filename) {
    return `${subDir}/${filename}`;
}

/**
 * Returns the full URL for a stored file.
 * @param {object} req
 * @param {string} storagePath - relative path like 'berita/thumbnails/xxx.jpg'
 */
function getFileUrl(req, storagePath) {
    if (!storagePath) return null;
    return `${req.protocol}://${req.get('host')}/uploads/${storagePath}`;
}

/**
 * Deletes a file from the uploads directory.
 * @param {string} storagePath - relative path like 'berita/thumbnails/xxx.jpg'
 */
function deleteFile(storagePath) {
    if (!storagePath) return;
    const filePath = path.join(uploadDir, storagePath);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

module.exports = { createUploader, getStoragePath, getFileUrl, deleteFile };
