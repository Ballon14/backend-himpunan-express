const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const ExcelJS = require('exceljs');
const db = require('../config/database');
const logger = require('./logger');

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ─── Table Configurations for Backup ─────────────────────────────────────────
const BACKUP_TABLES = {
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
    },
    galeris: {
        label: 'Galeri',
        columns: [
            { header: 'Judul', key: 'judul', width: 30 },
            { header: 'Kategori', key: 'kategori', width: 18 },
            { header: 'Tanggal', key: 'tanggal', width: 18 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
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
    },
    prestasis: {
        label: 'Prestasi',
        columns: [
            { header: 'Judul', key: 'judul', width: 30 },
            { header: 'Deskripsi', key: 'deskripsi', width: 40 },
            { header: 'Kategori', key: 'kategori', width: 18 },
            { header: 'Penerima', key: 'penerima', width: 25 },
            { header: 'Tanggal', key: 'tanggal', width: 18 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
        ],
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
    },
    settings: {
        label: 'Pengaturan Website',
        columns: [
            { header: 'Key', key: 'key', width: 30 },
            { header: 'Value', key: 'value', width: 50 },
            { header: 'Dibuat', key: 'created_at', width: 20 },
            { header: 'Diperbarui', key: 'updated_at', width: 20 },
        ],
    },
};

// Format bytes helper
function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ─── Build Excel Workbook Helper ─────────────────────────────────────────────
async function buildTableWorkbook(tableName, config) {
    let query = db(tableName);
    // Check if column deleted_at exists
    const hasDeletedAt = await db.schema.hasColumn(tableName, 'deleted_at');
    if (hasDeletedAt) {
        query = query.whereNull('deleted_at');
    }
    const rows = await query.select('*');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HMTKBG System Backup';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(config.label);
    sheet.columns = config.columns;

    // Header styling
    sheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' },
    };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 26;

    rows.forEach((row) => {
        const cleanRow = {};
        config.columns.forEach((col) => {
            let val = row[col.key];
            if (col.key === 'status_aktif' || col.key === 'is_read' || col.key === 'is_available') {
                val = val ? 'Ya' : 'Tidak';
            }
            if (val instanceof Date) {
                val = val.toISOString().replace('T', ' ').substring(0, 19);
            }
            cleanRow[col.key] = val !== undefined && val !== null ? val : '-';
        });
        sheet.addRow(cleanRow);
    });

    if (rows.length > 0) {
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: rows.length + 1, column: config.columns.length },
        };
    }

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.alignment = { vertical: 'middle', wrapText: true };
            if (rowNumber % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9FAFB' },
                };
            }
        }
    });

    return { workbook, rowCount: rows.length };
}

// ─── Get JSON Rows Helper ────────────────────────────────────────────────────
async function getTableJson(tableName) {
    let query = db(tableName);
    const hasDeletedAt = await db.schema.hasColumn(tableName, 'deleted_at');
    if (hasDeletedAt) {
        query = query.whereNull('deleted_at');
    }
    const rows = await query.select('*');
    return rows.map((r) => {
        const copy = { ...r };
        // Delete sensitive fields if any
        if (tableName === 'users') delete copy.password;
        return copy;
    });
}

// ─── Create Backup Snapshot ──────────────────────────────────────────────────
async function createBackupSnapshot(type = 'manual') {
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup_${type}_${timestampStr}.zip`;
    const filepath = path.join(BACKUP_DIR, filename);

    const output = fs.createWriteStream(filepath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const archivePromise = new Promise((resolve, reject) => {
        output.on('close', () => resolve());
        archive.on('error', (err) => reject(err));
    });

    archive.pipe(output);

    const allDataDump = {};
    let totalRecords = 0;
    const includedTables = [];

    for (const [tableName, config] of Object.entries(BACKUP_TABLES)) {
        try {
            const tableExists = await db.schema.hasTable(tableName);
            if (!tableExists) continue;

            includedTables.push(tableName);

            // 1. Excel format for each table
            const { workbook, rowCount } = await buildTableWorkbook(tableName, config);
            totalRecords += rowCount;
            const excelBuffer = await workbook.xlsx.writeBuffer();
            archive.append(excelBuffer, { name: `excel/${config.label}.xlsx` });

            // 2. JSON format for each table
            const jsonData = await getTableJson(tableName);
            allDataDump[tableName] = jsonData;
            archive.append(JSON.stringify(jsonData, null, 2), { name: `json/${config.label}.json` });
        } catch (tableErr) {
            console.error(`Error backing up table ${tableName}:`, tableErr);
        }
    }

    // Complete Database JSON Dump
    archive.append(JSON.stringify(allDataDump, null, 2), { name: 'database_full_dump.json' });

    // Backup Manifest
    const manifest = {
        app: 'HMTKBG Express CMS',
        backupType: type,
        createdAt: now.toISOString(),
        filename,
        totalTables: includedTables.length,
        totalRecords,
        tables: includedTables,
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    await archive.finalize();
    await archivePromise;

    const stats = fs.statSync(filepath);

    // Prune old automated backups (keep last 10)
    pruneOldAutomatedBackups(10);

    // Save timestamp of last auto backup
    if (type === 'automated') {
        try {
            const hasSettings = await db.schema.hasTable('settings');
            if (hasSettings) {
                const exists = await db('settings').where('key', 'last_auto_backup').first();
                if (exists) {
                    await db('settings').where('key', 'last_auto_backup').update({
                        value: now.toISOString(),
                        updated_at: now,
                    });
                } else {
                    await db('settings').insert({
                        key: 'last_auto_backup',
                        value: now.toISOString(),
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
        } catch (settingsErr) {
            console.error('Save last_auto_backup timestamp error:', settingsErr);
        }
    }

    return {
        filename,
        filepath,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        createdAt: now.toISOString(),
        type,
        totalRecords,
    };
}

// ─── Prune Old Automated Backups ─────────────────────────────────────────────
function pruneOldAutomatedBackups(keepCount = 10) {
    try {
        const files = fs.readdirSync(BACKUP_DIR)
            .filter((f) => f.startsWith('backup_automated_') && f.endsWith('.zip'))
            .map((f) => {
                const fullPath = path.join(BACKUP_DIR, f);
                const stats = fs.statSync(fullPath);
                return { name: f, fullPath, mtime: stats.mtimeMs };
            })
            .sort((a, b) => b.mtime - a.mtime); // newest first

        if (files.length > keepCount) {
            const toDelete = files.slice(keepCount);
            toDelete.forEach((file) => {
                try {
                    fs.unlinkSync(file.fullPath);
                    logger.info(`Pruned old automated backup: ${file.name}`);
                } catch (delErr) {
                    console.error('Failed to prune backup file:', delErr);
                }
            });
        }
    } catch (err) {
        console.error('pruneOldAutomatedBackups error:', err);
    }
}

// ─── List All Backups ────────────────────────────────────────────────────────
function listBackups() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return [];
        const files = fs.readdirSync(BACKUP_DIR)
            .filter((f) => f.endsWith('.zip'))
            .map((f) => {
                const fullPath = path.join(BACKUP_DIR, f);
                const stats = fs.statSync(fullPath);
                const isAuto = f.startsWith('backup_automated_');
                return {
                    filename: f,
                    type: isAuto ? 'automated' : 'manual',
                    typeLabel: isAuto ? 'Otomatis (Mingguan)' : 'Manual',
                    size: stats.size,
                    sizeFormatted: formatBytes(stats.size),
                    createdAt: stats.birthtime ? stats.birthtime.toISOString() : stats.mtime.toISOString(),
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return files;
    } catch (err) {
        console.error('listBackups error:', err);
        return [];
    }
}

// ─── Delete Single Backup ────────────────────────────────────────────────────
function deleteBackup(filename) {
    const safeName = path.basename(filename);
    const fullPath = path.join(BACKUP_DIR, safeName);
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        return true;
    }
    return false;
}

// ─── Get Backup File Path ────────────────────────────────────────────────────
function getBackupFilePath(filename) {
    const safeName = path.basename(filename);
    const fullPath = path.join(BACKUP_DIR, safeName);
    if (fs.existsSync(fullPath)) {
        return fullPath;
    }
    return null;
}

// ─── Automated Scheduler (Weekly = 7 Days) ───────────────────────────────────
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
let schedulerIntervalId = null;

async function checkAndRunWeeklyBackup() {
    try {
        let lastBackupTime = 0;

        // Check from settings table
        try {
            const hasSettings = await db.schema.hasTable('settings');
            if (hasSettings) {
                const setting = await db('settings').where('key', 'last_auto_backup').first();
                if (setting && setting.value) {
                    lastBackupTime = new Date(setting.value).getTime();
                }
            }
        } catch {}

        // Fallback: check newest automated backup file on disk
        if (!lastBackupTime) {
            const backups = listBackups().filter((b) => b.type === 'automated');
            if (backups.length > 0) {
                lastBackupTime = new Date(backups[0].createdAt).getTime();
            }
        }

        const now = Date.now();
        const timeSinceLast = now - lastBackupTime;

        // If never backed up, or more than 7 days have elapsed:
        if (timeSinceLast >= ONE_WEEK_MS) {
            logger.info('Menjalankan pencadangan data otomatis mingguan...');
            const result = await createBackupSnapshot('automated');
            logger.info(`Pencadangan data otomatis mingguan berhasil dibuat: ${result.filename} (${result.sizeFormatted})`);
            logger.audit('membuat', 'backup otomatis', null, {
                filename: result.filename,
                size: result.sizeFormatted,
                records: result.totalRecords,
            });
        }
    } catch (err) {
        console.error('checkAndRunWeeklyBackup error:', err);
        logger.error('Gagal menjalankan pencadangan data otomatis mingguan', { error: err.message });
    }
}

function initBackupScheduler() {
    // Initial check 15 seconds after app startup
    setTimeout(() => {
        checkAndRunWeeklyBackup();
    }, 15000);

    // Check every 1 hour (3600000 ms)
    if (!schedulerIntervalId) {
        schedulerIntervalId = setInterval(() => {
            checkAndRunWeeklyBackup();
        }, 60 * 60 * 1000);
    }

    logger.info('Backup Scheduler: Pencadangan otomatis mingguan (setiap 7 hari) telah aktif.');
}

module.exports = {
    createBackupSnapshot,
    listBackups,
    deleteBackup,
    getBackupFilePath,
    initBackupScheduler,
    checkAndRunWeeklyBackup,
    BACKUP_TABLES,
};
