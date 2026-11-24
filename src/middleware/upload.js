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

let sharp = null;
try {
    sharp = require('sharp');
} catch (e) {
    console.warn('Sharp module not loaded, image optimization will be skipped.');
}

/**
 * Optimizes an uploaded image file (auto-rotate, resize max dimension, re-encode with high quality).
 * @param {object} file - Express multer file object
 * @param {object} options - { maxWidth: 1920, quality: 82 }
 */
async function optimizeUploadedFile(file, options = { maxWidth: 1920, quality: 82 }) {
    if (!sharp || !file || !file.path) return file;
    try {
        const ext = path.extname(file.path).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            const tempFile = `${file.path}.opt`;
            let pipeline = sharp(file.path).rotate();
            const meta = await pipeline.metadata();

            if (meta.width && meta.width > options.maxWidth) {
                pipeline = pipeline.resize({ width: options.maxWidth, withoutEnlargement: true });
            }

            if (ext === '.jpg' || ext === '.jpeg') {
                pipeline = pipeline.jpeg({ quality: options.quality, mozjpeg: true });
            } else if (ext === '.png') {
                pipeline = pipeline.png({ compressionLevel: 8 });
            } else if (ext === '.webp') {
                pipeline = pipeline.webp({ quality: options.quality });
            }

            await pipeline.toFile(tempFile);
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(file.path);
                fs.renameSync(tempFile, file.path);
            }
        }
    } catch (err) {
        console.warn('Image optimization skipped for', file.path, ':', err.message);
    }
    return file;
}

/**
 * Express middleware to optimize uploaded single or multiple files after multer.
 */
const optimizeImage = (options = { maxWidth: 1920, quality: 82 }) => async (req, res, next) => {
    try {
        if (req.file) {
            await optimizeUploadedFile(req.file, options);
        }
        if (req.files) {
            const list = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
            for (const f of list) {
                await optimizeUploadedFile(f, options);
            }
        }
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createUploader,
    getStoragePath,
    getFileUrl,
    deleteFile,
    optimizeUploadedFile,
    optimizeImage,
};
