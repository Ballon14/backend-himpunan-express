const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { successResponse, errorResponse } = require('../helpers/response');
const logger = require('../helpers/logger');

const router = express.Router();

// ─── Default Configurations ──────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    site_name: 'HMTKBG Politeknik PU',
    site_tagline: 'Himpunan Mahasiswa Teknologi Konstruksi Bangunan Gedung',
    site_description: 'Wadah aspirasi, kreasi, dan sinergi mahasiswa Teknologi Konstruksi Bangunan Gedung Politeknik Pekerjaan Umum.',
    whatsapp_number: '6281515630448',
    email: 'hima.kbg@gmail.com',
    alamat: 'Gedung Pusat Kegiatan Mahasiswa Lt. 2, Teknologi Konstruksi Bangunan Gedung, Semarang, Jawa Tengah',
    jam_operasional: 'Senin - Jumat: 08:00 - 16:00 WIB',
    instagram_url: 'https://www.instagram.com/hmtkbg?igsh=M2owdXpkMXprcjA4',
    instagram_username: '@hmtkbg',
    tiktok_url: 'https://www.tiktok.com/@hmtkbg?_r=1&_t=ZS-9AM3oNXfHBm',
    tiktok_username: '@hmtkbg',
    youtube_url: 'https://www.youtube.com/@hmtkbgpoliteknikpu6903',
    youtube_channel: 'HMTKBG Politeknik PU',
};

let tableInitialized = false;

// ─── Ensure Table & Defaults ─────────────────────────────────────────────────
async function ensureSettingsTable() {
    if (tableInitialized) return;
    try {
        const hasTable = await db.schema.hasTable('settings');
        if (!hasTable) {
            await db.schema.createTable('settings', (table) => {
                table.increments('id').primary();
                table.string('key', 100).unique().notNullable();
                table.text('value').nullable();
                table.timestamps(true, true);
            });
            const insertData = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
                key,
                value,
                created_at: new Date(),
                updated_at: new Date(),
            }));
            await db('settings').insert(insertData);
        } else {
            // Seed missing keys if any
            const existingRows = await db('settings').select('key');
            const existingKeys = new Set(existingRows.map((r) => r.key));
            const missing = [];
            for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
                if (!existingKeys.has(key)) {
                    missing.push({
                        key,
                        value,
                        created_at: new Date(),
                        updated_at: new Date(),
                    });
                }
            }
            if (missing.length > 0) {
                await db('settings').insert(missing);
            }
        }
        tableInitialized = true;
    } catch (err) {
        console.error('ensureSettingsTable error:', err);
    }
}

// ─── Helper: Get all settings as key-value map ───────────────────────────────
async function getAllSettings() {
    await ensureSettingsTable();
    const rows = await db('settings').select('key', 'value');
    const settings = { ...DEFAULT_SETTINGS };
    rows.forEach((r) => {
        settings[r.key] = r.value !== null && r.value !== undefined ? r.value : '';
    });
    return settings;
}

// ─── GET /api/settings (Public) ──────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const settings = await getAllSettings();
        return successResponse(res, settings, 'Pengaturan website berhasil diambil.');
    } catch (err) {
        console.error('Get settings error:', err);
        return errorResponse(res, 'Gagal mengambil pengaturan website.', 500);
    }
});

// ─── PUT /api/settings (Admin Only) ──────────────────────────────────────────
router.put('/', authMiddleware, async (req, res) => {
    try {
        await ensureSettingsTable();

        const updates = req.body;
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
            return errorResponse(res, 'Format data tidak valid.', 400);
        }

        // Clean & validate WhatsApp number if provided
        if (updates.whatsapp_number !== undefined) {
            let wa = String(updates.whatsapp_number).replace(/[^0-9]/g, '');
            if (wa.startsWith('0')) {
                wa = '62' + wa.slice(1);
            }
            updates.whatsapp_number = wa;
        }

        for (const [key, rawVal] of Object.entries(updates)) {
            if (typeof key !== 'string' || key.length > 100) continue;
            const val = rawVal !== null && rawVal !== undefined ? String(rawVal).trim() : '';

            const exists = await db('settings').where('key', key).first();
            if (exists) {
                await db('settings').where('key', key).update({
                    value: val,
                    updated_at: new Date(),
                });
            } else {
                await db('settings').insert({
                    key,
                    value: val,
                    created_at: new Date(),
                    updated_at: new Date(),
                });
            }
        }

        logger.audit('memperbarui', 'pengaturan website', req, { changes: updates });

        const updatedSettings = await getAllSettings();
        return successResponse(res, updatedSettings, 'Pengaturan website berhasil disimpan.');
    } catch (err) {
        console.error('Update settings error:', err);
        return errorResponse(res, 'Gagal memperbarui pengaturan website.', 500);
    }
});

module.exports = router;
