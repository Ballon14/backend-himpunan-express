const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { successResponse, errorResponse } = require('../helpers/response');
const logger = require('../helpers/logger');

// Multer — store in memory (import files are small)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowed = [
            'text/csv',
            'application/json',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', // some CSVs come as text/plain
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|json|xlsx?)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Format file tidak didukung. Gunakan CSV atau JSON.'));
        }
    },
});

// ─── Table Configurations (mirrors export.js) ────────────────────────────────
const IMPORTABLE_TABLES = {
    anggotas: {
        label: 'Anggota',
        requiredFields: ['nama', 'nim', 'angkatan'],
        allFields: ['nama', 'nim', 'angkatan', 'jabatan', 'email', 'instagram', 'linkedin', 'motto', 'status_aktif'],
        uniqueField: 'nim',
        hasUUID: true,
    },
    beritas: {
        label: 'Berita',
        requiredFields: ['judul', 'slug'],
        allFields: ['judul', 'slug', 'isi', 'status', 'published_at'],
        uniqueField: 'slug',
        hasUUID: true,
    },
    program_kerjas: {
        label: 'Program Kerja',
        requiredFields: ['nama_program', 'deskripsi', 'tanggal_mulai', 'tanggal_selesai'],
        allFields: ['nama_program', 'deskripsi', 'tanggal_mulai', 'tanggal_selesai', 'status'],
        uniqueField: null,
        hasUUID: true,
    },
    galeris: {
        label: 'Galeri',
        requiredFields: ['judul', 'kategori', 'tanggal'],
        allFields: ['judul', 'kategori', 'tanggal'],
        uniqueField: null,
        hasUUID: true,
    },
    pesans: {
        label: 'Pesan',
        requiredFields: ['nama', 'isi_pesan'],
        allFields: ['nama', 'email', 'isi_pesan', 'is_read'],
        uniqueField: null,
        hasUUID: false, // pesans uses auto-increment
    },
    kegiatan: {
        label: 'Kegiatan',
        requiredFields: ['judul', 'tanggal_mulai'],
        allFields: ['judul', 'deskripsi', 'tanggal_mulai', 'tanggal_selesai', 'lokasi', 'kategori'],
        uniqueField: null,
        hasUUID: true,
    },
    merchandise: {
        label: 'Merchandise',
        requiredFields: ['nama'],
        allFields: ['nama', 'deskripsi', 'harga', 'kategori', 'is_available'],
        uniqueField: null,
        hasUUID: true,
    },
    prestasis: {
        label: 'Prestasi',
        requiredFields: ['judul', 'kategori', 'tanggal'],
        allFields: ['judul', 'deskripsi', 'kategori', 'penerima', 'tanggal'],
        uniqueField: null,
        hasUUID: true,
    },
};

// ─── Helper: Parse CSV buffer ────────────────────────────────────────────────
async function parseCSV(buffer) {
    const firstLine = buffer.toString('utf-8').split('\n')[0] || '';
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const workbook = new ExcelJS.Workbook();
    await workbook.csv.read(stream, {
        parserOptions: {
            delimiter: delimiter,
        }
    });
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) return [];

    // First row is header
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '')
            .trim()
            .toLowerCase()
            .replace(/\*/g, '')      // Hapus tanda bintang
            .replace(/\s+/g, '_')    // Ganti spasi dengan underscore
            .replace(/_+/g, '_')     // Hapus underscore ganda
            .replace(/^_|_$/g, '');  // Hapus underscore di awal/akhir
    });

    const rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const obj = {};
        let hasValue = false;
        row.eachCell((cell, colNumber) => {
            const key = headers[colNumber];
            if (key) {
                obj[key] = cell.value;
                if (cell.value !== null && cell.value !== '') hasValue = true;
            }
        });
        if (hasValue) rows.push(obj);
    }
    return rows;
}

// ─── Helper: Parse XLSX buffer ───────────────────────────────────────────────
async function parseXLSX(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) return [];

    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || '')
            .trim()
            .toLowerCase()
            .replace(/\*/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    });

    const rows = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const obj = {};
        let hasValue = false;
        row.eachCell((cell, colNumber) => {
            const key = headers[colNumber];
            if (key) {
                obj[key] = cell.value;
                if (cell.value !== null && cell.value !== '') hasValue = true;
            }
        });
        if (hasValue) rows.push(obj);
    }
    return rows;
}

// ─── Helper: Parse JSON buffer ───────────────────────────────────────────────
function parseJSON(buffer) {
    const text = buffer.toString('utf-8');
    const parsed = JSON.parse(text);
    // Support both { data: [...] } format (from our export) and plain array
    if (Array.isArray(parsed)) return parsed;
    if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
    throw new Error('Format JSON tidak valid. Harus berupa array atau objek dengan field "data".');
}

// ─── Helper: Clean & validate row ────────────────────────────────────────────
function cleanRow(rawRow, config) {
    const row = {};
    for (const field of config.allFields) {
        let value = rawRow[field];

        if (value === undefined) {
            // Try to find by case-insensitive match, ignoring asterisks and extra spaces
            const altKey = Object.keys(rawRow).find(
                k => k.toLowerCase()
                      .replace(/\*/g, '')
                      .replace(/\s+/g, '_')
                      .replace(/_+/g, '_')
                      .replace(/^_|_$/g, '') === field
            );
            if (altKey) value = rawRow[altKey];
        }

        if (value === undefined || value === null || value === '' || value === '-') {
            // Berikan nilai default untuk field yang tidak boleh null di database
            if (field === 'status') {
                row[field] = config.label === 'Berita' ? 'draft' : 'perencanaan';
            } else if (field === 'kategori' && (config.label === 'Kegiatan' || config.label === 'Merchandise')) {
                row[field] = 'lainnya';
            } else if (field === 'status_aktif') {
                row[field] = true;
            } else if (field === 'is_read') {
                row[field] = false;
            } else if (field === 'is_available') {
                row[field] = true;
            } else if (field === 'harga') {
                row[field] = 0;
            } else {
                row[field] = null;
            }
        } else if (field === 'status_aktif' || field === 'is_read' || field === 'is_available') {
            // Boolean fields
            if (typeof value === 'boolean') row[field] = value;
            else if (typeof value === 'string') {
                row[field] = ['ya', 'true', '1', 'yes'].includes(value.toLowerCase());
            } else {
                row[field] = Boolean(value);
            }
        } else if (field === 'status') {
            const s = String(value).trim().toLowerCase();
            if (config.label === 'Berita') {
                row[field] = ['draft', 'published'].includes(s) ? s : 'draft';
            } else if (config.label === 'Program Kerja') {
                row[field] = ['perencanaan', 'berjalan', 'selesai', 'dibatalkan'].includes(s) ? s : 'perencanaan';
            } else {
                row[field] = s;
            }
        } else if (value instanceof Date) {
            // Format dates properly for MySQL DATE or DATETIME
            row[field] = value.toISOString().slice(0, 19).replace('T', ' ');
        } else if (field === 'harga') {
            row[field] = parseInt(value) || 0;
        } else {
            row[field] = String(value).trim();
        }
    }
    return row;
}

// ─── Import endpoint ─────────────────────────────────────────────────────────
router.post('/:table', upload.single('file'), async (req, res) => {
    try {
        const { table } = req.params;
        const config = IMPORTABLE_TABLES[table];

        if (!config) {
            return errorResponse(res, `Tabel "${table}" tidak tersedia untuk import.`, 400);
        }

        if (!req.file) {
            return errorResponse(res, 'File tidak ditemukan. Upload file CSV atau JSON.', 400);
        }

        // Parse file based on type
        let rawRows;
        const filename = req.file.originalname.toLowerCase();
        const { Readable } = require('stream');

        if (filename.endsWith('.json')) {
            rawRows = parseJSON(req.file.buffer);
        } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
            rawRows = await parseXLSX(req.file.buffer);
        } else {
            // CSV
            rawRows = await parseCSV(req.file.buffer);
        }

        if (!rawRows || rawRows.length === 0) {
            return errorResponse(res, 'File tidak berisi data yang dapat di-import.', 400);
        }

        // Validate & clean rows
        const now = new Date();
        const cleanedRows = [];
        const errors = [];

        for (let i = 0; i < rawRows.length; i++) {
            const row = cleanRow(rawRows[i], config);

            // Check required fields
            const missingFields = config.requiredFields.filter(f => !row[f]);
            if (missingFields.length > 0) {
                errors.push(`Baris ${i + 1}: Field wajib kosong (${missingFields.join(', ')})`);
                continue;
            }

            // Add system fields
            if (config.hasUUID) {
                row.id = uuidv4();
            }
            row.created_at = now;
            row.updated_at = now;

            cleanedRows.push(row);
        }

        if (cleanedRows.length === 0) {
            return errorResponse(res, 'Tidak ada data valid untuk di-import.', 400, { errors });
        }

        // Check duplicates for unique fields
        let skipped = 0;
        let rowsToInsert = cleanedRows;

        if (config.uniqueField) {
            const uniqueValues = cleanedRows
                .map(r => r[config.uniqueField])
                .filter(Boolean);

            if (uniqueValues.length > 0) {
                const existing = await db(table)
                    .whereIn(config.uniqueField, uniqueValues)
                    .whereNull('deleted_at')
                    .select(config.uniqueField);

                const existingSet = new Set(existing.map(r => r[config.uniqueField]));
                rowsToInsert = cleanedRows.filter(r => {
                    if (existingSet.has(r[config.uniqueField])) {
                        skipped++;
                        return false;
                    }
                    return true;
                });
            }
        }

        if (rowsToInsert.length === 0) {
            return successResponse(res, {
                imported: 0,
                skipped,
                errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
            }, 'Semua data sudah ada di database (duplikat).');
        }

        // Insert in batches of 100
        const BATCH_SIZE = 100;
        let imported = 0;
        for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
            const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
            await db(table).insert(batch);
            imported += batch.length;
        }

        logger.info(`Import ${config.label}: ${imported} rows imported, ${skipped} skipped`, {
            table,
            imported,
            skipped,
            errors: errors.length,
        });

        return successResponse(res, {
            imported,
            skipped,
            total: rawRows.length,
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        }, `Berhasil import ${imported} data ${config.label}.`);

    } catch (err) {
        console.error('Import error:', err);
        logger.error('Import error', { message: err.message, stack: err.stack });

        if (err.code === 'ER_DUP_ENTRY') {
            return errorResponse(res, 'Gagal import: Terdapat data duplikat.', 422);
        }

        return errorResponse(res, `Gagal melakukan import data: ${err.message}`, 500);
    }
});

// ─── Get template (sample) for a table ───────────────────────────────────────
router.get('/:table/template', async (req, res) => {
    try {
        const { table } = req.params;
        const config = IMPORTABLE_TABLES[table];

        if (!config) {
            return errorResponse(res, `Tabel "${table}" tidak tersedia.`, 400);
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'HMTKBG Admin';
        const sheet = workbook.addWorksheet(config.label);

        // Set columns
        sheet.columns = config.allFields.map(f => ({
            header: f,
            key: f,
            width: 20,
        }));

        // Style header
        sheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF6366F1' },
        };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Mark required fields
        config.requiredFields.forEach(f => {
            const colIndex = config.allFields.indexOf(f) + 1;
            const cell = sheet.getRow(1).getCell(colIndex);
            cell.value = `${f} *`;
        });

        const timestamp = new Date().toISOString().slice(0, 10);
        const format = (req.query.format || 'csv').toLowerCase();

        if (format === 'xlsx' || format === 'excel') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Template_${config.label}_${timestamp}.xlsx"`);
            await workbook.xlsx.write(res);
            return res.end();
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="Template_${config.label}_${timestamp}.csv"`);
        await workbook.csv.write(res);
        res.end();
    } catch (err) {
        console.error('Template error:', err);
        return errorResponse(res, 'Gagal membuat template.', 500);
    }
});

module.exports = router;
