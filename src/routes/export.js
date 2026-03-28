const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const archiver = require('archiver');
const db = require('../config/database');
const { errorResponse } = require('../helpers/response');

// ─── Table Configurations ────────────────────────────────────────────────────
const EXPORTABLE_TABLES = {
    anggotas: {
        label: 'Anggota',
        columns: [
            { header: 'Nama', key: 'nama', width: 25 },
            { header: 'NIM', key: 'nim', width: 15 },

            { header: 'Angkatan', key: 'angkatan', width: 12 },
            { header: 'Jabatan', key: 'jabatan', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Instagram', key: 'instagram', width: 20 },
            { header: 'LinkedIn', key: 'linkedin', width: 20 },
            { header: 'Motto', key: 'motto', width: 35 },
            { header: 'Status Aktif', key: 'status_aktif', width: 14 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
        excludeFields: ['id', 'foto', 'deleted_at', 'updated_at'],
    },
    beritas: {
        label: 'Berita',
        columns: [
            { header: 'Judul', key: 'judul', width: 35 },
            { header: 'Slug', key: 'slug', width: 35 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Tanggal Publish', key: 'published_at', width: 20 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
        excludeFields: ['id', 'isi', 'thumbnail', 'deleted_at', 'updated_at'],
    },
    program_kerjas: {
        label: 'Program Kerja',
        columns: [
            { header: 'Nama Program', key: 'nama_program', width: 30 },
            { header: 'Deskripsi', key: 'deskripsi', width: 40 },
            { header: 'Tanggal Mulai', key: 'tanggal_mulai', width: 18 },
            { header: 'Tanggal Selesai', key: 'tanggal_selesai', width: 18 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
        excludeFields: ['id', 'foto', 'deleted_at', 'updated_at'],
    },
    galeris: {
        label: 'Galeri',
        columns: [
            { header: 'Judul', key: 'judul', width: 30 },
            { header: 'Kategori', key: 'kategori', width: 18 },
            { header: 'Tanggal', key: 'tanggal', width: 18 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
        excludeFields: ['id', 'foto', 'deleted_at', 'updated_at'],
    },
    pesans: {
        label: 'Pesan',
        columns: [
            { header: 'Nama', key: 'nama', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Isi Pesan', key: 'isi_pesan', width: 50 },
            { header: 'Sudah Dibaca', key: 'is_read', width: 14 },
            { header: 'Dibaca Pada', key: 'read_at', width: 20 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
        excludeFields: ['id', 'deleted_at', 'updated_at'],
    },
    kegiatan: {
        label: 'Kegiatan',
        columns: [
            { header: 'Judul', key: 'judul', width: 30 },
            { header: 'Deskripsi', key: 'deskripsi', width: 40 },
            { header: 'Tanggal Mulai', key: 'tanggal_mulai', width: 20 },
            { header: 'Tanggal Selesai', key: 'tanggal_selesai', width: 20 },
            { header: 'Lokasi', key: 'lokasi', width: 25 },
            { header: 'Kategori', key: 'kategori', width: 14 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
        excludeFields: ['id', 'deleted_at', 'updated_at'],
    },
    merchandise: {
        label: 'Merchandise',
        columns: [
            { header: 'Nama', key: 'nama', width: 25 },
            { header: 'Deskripsi', key: 'deskripsi', width: 40 },
            { header: 'Harga', key: 'harga', width: 14 },
            { header: 'Kategori', key: 'kategori', width: 14 },
            { header: 'Tersedia', key: 'is_available', width: 12 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
        excludeFields: ['id', 'foto', 'deleted_at', 'updated_at'],
    },
};

// ─── Helper: Build Excel Workbook for single table ───────────────────────────
async function buildWorkbook(tableName, config) {
    const rows = await db(tableName).whereNull('deleted_at').select('*');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HMTKBG Admin';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(config.label);
    sheet.columns = config.columns;

    // Style header row
    sheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6366F1' },
    };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 28;

    // Add data rows
    rows.forEach((row) => {
        const cleanRow = {};
        config.columns.forEach((col) => {
            let value = row[col.key];
            // Format booleans
            if (col.key === 'status_aktif' || col.key === 'is_read') {
                value = value ? 'Ya' : 'Tidak';
            }
            // Format dates
            if (value instanceof Date) {
                value = value.toISOString().replace('T', ' ').substring(0, 19);
            }
            cleanRow[col.key] = value ?? '-';
        });
        sheet.addRow(cleanRow);
    });

    // Auto-filter
    if (rows.length > 0) {
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: rows.length + 1, column: config.columns.length },
        };
    }

    // Style data rows with alternating colors
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.alignment = { vertical: 'middle', wrapText: true };
            if (rowNumber % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF3F4F6' },
                };
            }
        }
        // Add borders
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            };
        });
    });

    return { workbook, rowCount: rows.length };
}

// ─── Helper: Get JSON data for single table ──────────────────────────────────
async function getJsonData(tableName, config) {
    const rows = await db(tableName).whereNull('deleted_at').select('*');
    return rows.map((row) => {
        const clean = {};
        config.columns.forEach((col) => {
            let value = row[col.key];
            if (col.key === 'status_aktif' || col.key === 'is_read') {
                value = value ? true : false;
            }
            if (value instanceof Date) {
                value = value.toISOString();
            }
            clean[col.key] = value ?? null;
        });
        return clean;
    });
}

// ─── Export single table ─────────────────────────────────────────────────────
router.get('/:table', async (req, res) => {
    try {
        const { table } = req.params;
        const format = (req.query.format || 'csv').toLowerCase();

        const config = EXPORTABLE_TABLES[table];
        if (!config) {
            return errorResponse(res, `Tabel "${table}" tidak tersedia untuk export.`, 400);
        }

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `${config.label}_${timestamp}`;

        if (format === 'json') {
            const data = await getJsonData(table, config);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
            return res.json({ table: config.label, exported_at: new Date().toISOString(), total: data.length, data });
        }

        // Format CSV
        if (format === 'csv') {
            const { workbook } = await buildWorkbook(table, config);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
            await workbook.csv.write(res);
            return res.end();
        }

        return errorResponse(res, 'Format tidak didukung', 400);
    } catch (err) {
        console.error('Export error:', err);
        return errorResponse(res, 'Gagal melakukan export data.', 500);
    }
});

// ─── Export ALL tables as ZIP ────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const format = (req.query.format || 'csv').toLowerCase();
        const timestamp = new Date().toISOString().slice(0, 10);
        const zipFilename = `Backup_HMTKBG_${timestamp}.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        for (const [tableName, config] of Object.entries(EXPORTABLE_TABLES)) {
            const filename = `${config.label}_${timestamp}`;

            if (format === 'json') {
                const data = await getJsonData(tableName, config);
                const jsonContent = JSON.stringify(
                    { table: config.label, exported_at: new Date().toISOString(), total: data.length, data },
                    null,
                    2
                );
                archive.append(jsonContent, { name: `${filename}.json` });
            } else if (format === 'csv') {
                const { workbook } = await buildWorkbook(tableName, config);
                const buffer = await workbook.csv.writeBuffer();
                archive.append(buffer, { name: `${filename}.csv` });
            }
        }

        await archive.finalize();
    } catch (err) {
        console.error('Export all error:', err);
        if (!res.headersSent) {
            return errorResponse(res, 'Gagal melakukan export semua data.', 500);
        }
    }
});

module.exports = router;
