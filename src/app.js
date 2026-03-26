require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const anggotaRoutes = require('./routes/anggota');
const beritaRoutes = require('./routes/berita');
const programKerjaRoutes = require('./routes/programKerja');
const galeriRoutes = require('./routes/galeri');
const pesanRoutes = require('./routes/pesan');
const exportRoutes = require('./routes/export');
const kegiatanRoutes = require('./routes/kegiatan');
const merchandiseRoutes = require('./routes/merchandise');
const { errorResponse } = require('./helpers/response');

const app = express();
const PORT = process.env.PORT || 8000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files (uploads) ─────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Rate Limiting (for public form endpoints) ──────────────────────────────
const formLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: { success: false, message: 'Terlalu banyak request. Silakan coba lagi nanti.', data: null },
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api/anggota', anggotaRoutes);
app.use('/api/berita', beritaRoutes);
app.use('/api/program-kerja', programKerjaRoutes);
app.use('/api/galeri', galeriRoutes);
app.use('/api/kegiatan', kegiatanRoutes);
app.use('/api/merchandise', merchandiseRoutes);
app.use('/api/pesan', (req, res, next) => {
    // Apply rate limiter only to POST (public form submission)
    if (req.method === 'POST') {
        return formLimiter(req, res, next);
    }
    next();
}, pesanRoutes);

// ─── Export Data (Auth required) ────────────────────────────────────────────
const authMiddleware = require('./middleware/auth');
app.use('/api/export', authMiddleware, exportRoutes);

// ─── Dashboard Statistics (Auth required) ───────────────────────────────────
const db = require('./config/database');
const { successResponse } = require('./helpers/response');

app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
    try {
        const [anggota, berita, programKerja, galeri, pesanUnread, pesanTotal] = await Promise.all([
            db('anggotas').whereNull('deleted_at').count('* as count').first(),
            db('beritas').whereNull('deleted_at').count('* as count').first(),
            db('program_kerjas').whereNull('deleted_at').count('* as count').first(),
            db('galeris').whereNull('deleted_at').count('* as count').first(),
            db('pesans').whereNull('deleted_at').where('is_read', false).count('* as count').first(),
            db('pesans').whereNull('deleted_at').count('* as count').first(),
        ]);

        return successResponse(res, {
            anggota: anggota.count,
            berita: berita.count,
            program_kerja: programKerja.count,
            galeri: galeri.count,
            pesan_unread: pesanUnread.count,
            pesan_total: pesanTotal.count,
        }, 'Dashboard stats berhasil diambil.');
    } catch (err) {
        console.error('Dashboard stats error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// ─── Dashboard Charts Data (Auth required) ──────────────────────────────────
app.get('/api/dashboard/charts', authMiddleware, async (req, res) => {
    try {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const currentYear = new Date().getFullYear();

        // 1. Monthly content creation trend (berita + galeri per month)
        const beritaMonthly = await db('beritas')
            .whereNull('deleted_at')
            .whereRaw('YEAR(created_at) = ?', [currentYear])
            .select(db.raw('MONTH(created_at) as month'), db.raw('COUNT(*) as count'))
            .groupByRaw('MONTH(created_at)');

        const galeriMonthly = await db('galeris')
            .whereNull('deleted_at')
            .whereRaw('YEAR(created_at) = ?', [currentYear])
            .select(db.raw('MONTH(created_at) as month'), db.raw('COUNT(*) as count'))
            .groupByRaw('MONTH(created_at)');

        const contentTrend = months.map((name, i) => {
            const m = i + 1;
            const b = beritaMonthly.find((r) => r.month === m);
            const g = galeriMonthly.find((r) => r.month === m);
            return { bulan: name, berita: b ? b.count : 0, galeri: g ? g.count : 0 };
        });

        // 2. Program Kerja status distribution
        const prokerStatus = await db('program_kerjas')
            .whereNull('deleted_at')
            .select('status', db.raw('COUNT(*) as count'))
            .groupBy('status');

        const statusLabels = { perencanaan: 'Perencanaan', berjalan: 'Berjalan', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };
        const statusColors = { perencanaan: '#3b82f6', berjalan: '#f59e0b', selesai: '#10b981', dibatalkan: '#ef4444' };
        const prokerPie = prokerStatus.map((r) => ({
            name: statusLabels[r.status] || r.status,
            value: r.count,
            color: statusColors[r.status] || '#6366f1',
        }));

        // 3. Anggota distribution by jurusan
        const anggotaJurusan = await db('anggotas')
            .whereNull('deleted_at')
            .select('jurusan', db.raw('COUNT(*) as count'))
            .groupBy('jurusan')
            .orderBy('count', 'desc')
            .limit(8);

        const jurusanColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316'];
        const anggotaBar = anggotaJurusan.map((r, i) => ({
            jurusan: r.jurusan.length > 15 ? r.jurusan.substring(0, 15) + '...' : r.jurusan,
            jumlah: r.count,
            color: jurusanColors[i % jurusanColors.length],
        }));

        // 4. Pesan monthly trend
        const pesanMonthly = await db('pesans')
            .whereNull('deleted_at')
            .whereRaw('YEAR(created_at) = ?', [currentYear])
            .select(db.raw('MONTH(created_at) as month'), db.raw('COUNT(*) as count'))
            .groupByRaw('MONTH(created_at)');

        const pesanTrend = months.map((name, i) => {
            const m = i + 1;
            const p = pesanMonthly.find((r) => r.month === m);
            return { bulan: name, pesan: p ? p.count : 0 };
        });

        return successResponse(res, {
            content_trend: contentTrend,
            proker_status: prokerPie,
            anggota_jurusan: anggotaBar,
            pesan_trend: pesanTrend,
        }, 'Dashboard charts berhasil diambil.');
    } catch (err) {
        console.error('Dashboard charts error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
    return errorResponse(res, 'Endpoint tidak ditemukan.', 404);
});

// ─── Error Handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 'Ukuran file terlalu besar (maks 5MB).', 422);
    }
    if (err.message && err.message.includes('Hanya file gambar')) {
        return errorResponse(res, err.message, 422);
    }

    return errorResponse(res, 'Terjadi kesalahan server.', 500);
});

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Express server running on http://localhost:${PORT}`);
});

module.exports = app;
