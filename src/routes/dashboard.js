const express = require('express');
const db = require('../config/database');
const { successResponse, errorResponse } = require('../helpers/response');

const router = express.Router();

// ─── Dashboard Statistics ────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
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
            anggota: Number(anggota.count),
            berita: Number(berita.count),
            program_kerja: Number(programKerja.count),
            galeri: Number(galeri.count),
            pesan_unread: Number(pesanUnread.count),
            pesan_total: Number(pesanTotal.count),
        }, 'Dashboard stats berhasil diambil.');
    } catch (err) {
        console.error('Dashboard stats error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

// ─── Dashboard Charts Data ──────────────────────────────────────────────────
router.get('/charts', async (req, res) => {
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

        // 3. Anggota distribution by angkatan
        const anggotaAngkatan = await db('anggotas')
            .whereNull('deleted_at')
            .select('angkatan', db.raw('COUNT(*) as count'))
            .groupBy('angkatan')
            .orderBy('angkatan', 'desc')
            .limit(8);

        const angkatanColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316'];
        const anggotaBar = anggotaAngkatan.map((r, i) => ({
            angkatan: r.angkatan,
            jumlah: r.count,
            color: angkatanColors[i % angkatanColors.length],
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
            anggota_angkatan: anggotaBar,
            pesan_trend: pesanTrend,
        }, 'Dashboard charts berhasil diambil.');
    } catch (err) {
        console.error('Dashboard charts error:', err);
        return errorResponse(res, 'Terjadi kesalahan server.', 500);
    }
});

module.exports = router;
