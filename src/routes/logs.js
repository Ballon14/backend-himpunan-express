const express = require('express');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const logger = require('../helpers/logger');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();

// GET /api/logs — Get recent log lines (Auth required)
router.get('/', authMiddleware, (req, res) => {
    try {
        const filePath = logger.getLogFile();
        if (!fs.existsSync(filePath)) {
            return successResponse(res, [], 'Belum ada log yang dicatat.');
        }

        const limit = parseInt(req.query.limit) || 100;
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.trim().split('\n');
        
        // Filter out empty lines
        const cleanLines = lines.filter(line => line.trim() !== '');
        
        // Return the last N lines in reverse chronological order
        const recentLines = cleanLines.slice(-limit).reverse();
        return successResponse(res, recentLines, 'Log berhasil diambil.');
    } catch (err) {
        console.error('Fetch logs error:', err);
        return errorResponse(res, 'Gagal mengambil log.', 500);
    }
});

// DELETE /api/logs — Clear the log file (Auth required)
router.delete('/', authMiddleware, (req, res) => {
    try {
        const filePath = logger.getLogFile();
        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, ''); // Truncate log file
        }
        logger.info('File log sistem telah dikosongkan oleh administrator.');
        return successResponse(res, null, 'File log berhasil dikosongkan.');
    } catch (err) {
        console.error('Clear logs error:', err);
        return errorResponse(res, 'Gagal mengosongkan log.', 500);
    }
});

// GET /api/logs/download — Download full log file (Auth required)
router.get('/download', authMiddleware, (req, res) => {
    try {
        const filePath = logger.getLogFile();
        if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8').trim() === '') {
            // Write a small placeholder log if it is empty so download doesn't fail
            logger.info('File log diunduh.');
        }
        return res.download(filePath, 'app-system.log');
    } catch (err) {
        console.error('Download logs error:', err);
        return res.status(500).json({ success: false, message: 'Gagal mengunduh file log.' });
    }
});

module.exports = router;
