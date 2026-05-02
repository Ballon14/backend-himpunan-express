require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ─── Route Imports ──────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const anggotaRoutes = require('./routes/anggota');
const beritaRoutes = require('./routes/berita');
const programKerjaRoutes = require('./routes/programKerja');
const galeriRoutes = require('./routes/galeri');
const pesanRoutes = require('./routes/pesan');
const exportRoutes = require('./routes/export');
const kegiatanRoutes = require('./routes/kegiatan');
const merchandiseRoutes = require('./routes/merchandise');
const dashboardRoutes = require('./routes/dashboard');
const authMiddleware = require('./middleware/auth');
const { errorResponse } = require('./helpers/response');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 8000;

// ─── Middleware ──────────────────────────────────────────────────────────────

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow uploads to be served cross-origin
}));

// CORS — restrict to configured origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files (uploads) ─────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const formLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: { success: false, message: 'Terlalu banyak request. Silakan coba lagi nanti.', data: null },
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // max 10 login attempts per 15 min per IP
    message: { success: false, message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.', data: null },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    return res.json({
        success: true,
        message: 'Server is healthy',
        data: {
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
        },
    });
});

// ─── API Routes ─────────────────────────────────────────────────────────────

// Auth routes — login has its own rate limiter
app.use('/api/login', loginLimiter);
app.use('/api', authRoutes);

// Public & admin CRUD routes
app.use('/api/anggota', anggotaRoutes);
app.use('/api/berita', beritaRoutes);
app.use('/api/program-kerja', programKerjaRoutes);
app.use('/api/galeri', galeriRoutes);
app.use('/api/kegiatan', kegiatanRoutes);
app.use('/api/merchandise', merchandiseRoutes);

// Pesan — POST (public) has rate limiter, GET/DELETE (admin) does not
app.use('/api/pesan', (req, res, next) => {
    if (req.method === 'POST') {
        return formLimiter(req, res, next);
    }
    next();
}, pesanRoutes);

// Admin-only routes (auth required)
app.use('/api/export', authMiddleware, exportRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);

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
const server = app.listen(PORT, () => {
    console.log(`🚀 Express server running on http://localhost:${PORT}`);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
function shutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
        console.log('HTTP server closed.');
        db.destroy().then(() => {
            console.log('Database connections closed.');
            process.exit(0);
        });
    });
    // Force close after 10s
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
