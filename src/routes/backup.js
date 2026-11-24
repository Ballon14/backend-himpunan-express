const express = require('express');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const { successResponse, errorResponse } = require('../helpers/response');
const logger = require('../helpers/logger');
const db = require('../config/database');
const {
    createBackupSnapshot,
    listBackups,
    deleteBackup,
    getBackupFilePath,
} = require('../helpers/backupService');

const router = express.Router();

// ─── GET /api/backup — List backups & scheduler info ─────────────────────────
router.get('/', authMiddleware, async (req, res) => {
    try {
        const backups = listBackups();

        // Get last backup timestamp
        let lastAutoBackup = null;
        try {
            const hasSettings = await db.schema.hasTable('settings');
            if (hasSettings) {
                const row = await db('settings').where('key', 'last_auto_backup').first();
                if (row && row.value) lastAutoBackup = row.value;
            }
        } catch {}

        if (!lastAutoBackup) {
            const latestAuto = backups.find((b) => b.type === 'automated');
            if (latestAuto) lastAutoBackup = latestAuto.createdAt;
        }

        let nextScheduledBackup = null;
        if (lastAutoBackup) {
            const nextDate = new Date(new Date(lastAutoBackup).getTime() + 7 * 24 * 60 * 60 * 1000);
            nextScheduledBackup = nextDate.toISOString();
        }

        return successResponse(res, {
            backups,
            config: {
                autoBackupEnabled: true,
                intervalDays: 7,
                lastAutoBackup,
                nextScheduledBackup,
                totalFiles: backups.length,
            },
        }, 'Daftar backup berhasil diambil.');
    } catch (err) {
        console.error('List backups error:', err);
        return errorResponse(res, 'Gagal mengambil data backup.', 500);
    }
});

// ─── POST /api/backup — Trigger immediate backup ─────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
    try {
        const type = req.body.type === 'automated' ? 'automated' : 'manual';
        const result = await createBackupSnapshot(type);

        logger.audit('membuat', 'backup data', req, {
            filename: result.filename,
            size: result.sizeFormatted,
            type,
        });

        return successResponse(res, result, 'Backup data berhasil dibuat.');
    } catch (err) {
        console.error('Trigger backup error:', err);
        return errorResponse(res, 'Gagal membuat backup data.', 500);
    }
});

// ─── GET /api/backup/download/:filename — Download backup zip ─────────────────
router.get('/download/:filename', authMiddleware, (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = getBackupFilePath(filename);

        if (!filepath || !fs.existsSync(filepath)) {
            return errorResponse(res, 'File backup tidak ditemukan.', 404);
        }

        const safeFilename = path.basename(filepath);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

        const stream = fs.createReadStream(filepath);
        stream.pipe(res);
    } catch (err) {
        console.error('Download backup error:', err);
        if (!res.headersSent) {
            return errorResponse(res, 'Gagal mengunduh file backup.', 500);
        }
    }
});

// ─── DELETE /api/backup/:filename — Delete backup zip ────────────────────────
router.delete('/:filename', authMiddleware, (req, res) => {
    try {
        const { filename } = req.params;
        const success = deleteBackup(filename);

        if (!success) {
            return errorResponse(res, 'File backup tidak ditemukan.', 404);
        }

        logger.audit('menghapus', 'backup data', req, { filename });
        return successResponse(res, null, 'File backup berhasil dihapus.');
    } catch (err) {
        console.error('Delete backup error:', err);
        return errorResponse(res, 'Gagal menghapus file backup.', 500);
    }
});

module.exports = router;
