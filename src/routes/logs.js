const express = require('express');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const logger = require('../helpers/logger');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();

// GET /api/logs — Get structured audit trail (primary endpoint)
router.get('/', authMiddleware, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 200;
        const logs = logger.readAuditLogs(limit);
        return successResponse(res, logs, 'Audit trail berhasil diambil.');
    } catch (err) {
        console.error('Fetch audit logs error:', err);
        return errorResponse(res, 'Gagal mengambil audit trail.', 500);
    }
});

// GET /api/logs/system — Get raw system log lines (for terminal view)
router.get('/system', authMiddleware, (req, res) => {
    try {
        const filePath = logger.getLogFile();
        if (!fs.existsSync(filePath)) {
            return successResponse(res, [], 'Belum ada log sistem.');
        }

        const limit = parseInt(req.query.limit) || 100;
        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.trim().split('\n').filter(line => line.trim() !== '');
        const recentLines = lines.slice(-limit).reverse();
        return successResponse(res, recentLines, 'Log sistem berhasil diambil.');
    } catch (err) {
        console.error('Fetch system logs error:', err);
        return errorResponse(res, 'Gagal mengambil log sistem.', 500);
    }
});

// DELETE /api/logs — Clear both audit trail and system log
router.delete('/', authMiddleware, (req, res) => {
    try {
        const logPath = logger.getLogFile();
        const auditPath = logger.getAuditFile();

        if (fs.existsSync(logPath)) fs.writeFileSync(logPath, '');
        if (fs.existsSync(auditPath)) fs.writeFileSync(auditPath, '');

        logger.info('Semua file log sistem telah dikosongkan oleh administrator.');
        return successResponse(res, null, 'Semua log berhasil dikosongkan.');
    } catch (err) {
        console.error('Clear logs error:', err);
        return errorResponse(res, 'Gagal mengosongkan log.', 500);
    }
});

// GET /api/logs/download — Download full system log file
router.get('/download', authMiddleware, (req, res) => {
    try {
        const filePath = logger.getLogFile();
        if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8').trim() === '') {
            logger.info('File log diunduh.');
        }
        return res.download(filePath, 'hmtkbg-system.log');
    } catch (err) {
        console.error('Download logs error:', err);
        return res.status(500).json({ success: false, message: 'Gagal mengunduh file log.' });
    }
});

module.exports = router;
