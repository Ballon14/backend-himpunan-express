// File: /backend-express/src/seed.js

/**
 * Seed admin user into the database.
 * Usage: node src/seed.js
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/database');
const { faker } = require('@faker-js/faker');

async function seed() {
    try {
        console.log(`🌱 Starting database seeding...`);

        // 1. Admin Users
        const admins = [
            { email: 'iqbal140605@gmail.com', password: 'iqbal', name: 'Iqbal' },
            { email: 'admin@hmtkbg.com', password: 'admin123', name: 'Admin HMTKBG' }
        ];

        for (const admin of admins) {
            const existing = await db('users').where('email', admin.email).first();
            if (!existing) {
                const hashedPassword = await bcrypt.hash(admin.password, 12);
                await db('users').insert({
                    id: uuidv4(),
                    name: admin.name,
                    email: admin.email,
                    password: hashedPassword,
                    created_at: new Date(),
                    updated_at: new Date(),
                });
                console.log(`✅ Admin user ${admin.email} created successfully!`);
            } else {
                console.log(`✅ Admin user ${admin.email} already exists. Skipping.`);
            }
        }

        // Prompt clear existing data
        console.log('🗑️  Clearing existing dummy data (except users)...');
        await db('pesans').del();
        await db('galeris').del();
        await db('program_kerjas').del();
        await db('beritas').del();
        await db('anggotas').del();

        // 2. Anggotas
        const anggotaOptions = ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Koordinator Divisi', 'Anggota', null];

        const anggotasToInsert = Array.from({ length: 20 }).map(() => ({
            id: uuidv4(),
            nama: faker.person.fullName(),
            nim: faker.string.numeric(10),
            angkatan: faker.number.int({ min: 2020, max: 2025 }).toString(),
            jabatan: faker.helpers.arrayElement(anggotaOptions),
            motto: faker.helpers.arrayElement(['Kokoh Tak Tertandingi', 'Membangun Negeri', 'Struktur Kuat, Desain Akurat', 'Inovasi Tiada Henti', 'Pantang Pulang Sebelum Cor Kering', null]),
            status_aktif: faker.datatype.boolean(0.85),
            foto: null,
            created_at: new Date(),
            updated_at: new Date()
        }));
        if (anggotasToInsert.length > 0) await db('anggotas').insert(anggotasToInsert);
        console.log(`✅ Seeded ${anggotasToInsert.length} anggotas.`);

        // 3. Berita
        const judulBeritaOptions = [
            'Tim HMTKBG Juara Nasional Lomba Rancang Bangun Gedung Tahan Gempa',
            'Seminar Nasional Inovasi Beton Ramah Lingkungan untuk Konstruksi Modern',
            'Kunjungan Proyek: Mahasiswa TKBG Tinjau Pembangunan Gedung Pencakar Langit',
            'Pelatihan AutoCAD dan Revit Tingkat Lanjut Sukses Digelar',
            'Mahasiswa TKBG Ciptakan Desain Jembatan Inovatif pada Kompetisi Konstruksi',
            'Workshop Pengukuran Tanah dan Topografi bersama Praktisi',
            'Sosialisasi K3 Keselamatan Kerja Konstruksi di Lingkungan Kampus',
            'Pengenalan Aplikasi SAP2000 untuk Analisis Struktur Bangunan',
            'Webinar Masa Depan Teknologi Baja Ringan di Indonesia',
            'Bakti Sosial HMTKBG: Bangun Fasilitas MCK untuk Desa Binaan'
        ];
        const beritasToInsert = Array.from({ length: 10 }).map(() => {
            const judul = faker.helpers.arrayElement(judulBeritaOptions);
            const status = faker.helpers.arrayElement(['draft', 'published']);
            const slug = judul.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + faker.string.alphanumeric(5).toLowerCase();
            return {
                id: uuidv4(),
                judul,
                slug,
                isi: '<p>' + faker.lorem.paragraphs(5, '</p><p>') + '</p>',
                thumbnail: null,
                status,
                published_at: status === 'published' ? faker.date.recent({ days: 180 }) : null,
                created_at: faker.date.recent({ days: 90 }),
                updated_at: new Date()
            };
        });
        if (beritasToInsert.length > 0) await db('beritas').insert(beritasToInsert);
        console.log(`✅ Seeded ${beritasToInsert.length} beritas.`);

        // 4. Program Kerja
        const prokerOptions = [
            'Pelatihan Software AutoCAD & Revit',
            'Lomba Desain Rancang Bangun Gedung',
            'Sertifikasi K3 Konstruksi Tingkat Dasar',
            'Kunjungan Industri Proyek Konstruksi Nasional',
            'Seminar Manajemen Konstruksi & Estimasi Biaya',
            'Workshop Pengujian Material Kuat Tekan Beton',
            'Pengabdian Masyarakat: Renovasi Bangunan Desa'
        ];
        const prokerToInsert = Array.from({ length: 8 }).map(() => {
            const startDate = faker.date.soon({ days: 90 });
            const endDate = new Date(startDate.getTime() + faker.number.int({ min: 1, max: 30 }) * 24 * 60 * 60 * 1000);
            return {
                id: uuidv4(),
                nama_program: faker.helpers.arrayElement(prokerOptions),
                deskripsi: faker.lorem.paragraphs(3, '\n\n'),
                tanggal_mulai: startDate,
                tanggal_selesai: endDate,
                status: faker.helpers.arrayElement(['perencanaan', 'berjalan', 'selesai', 'dibatalkan']),
                foto: null,
                created_at: new Date(),
                updated_at: new Date()
            };
        });
        if (prokerToInsert.length > 0) await db('program_kerjas').insert(prokerToInsert);
        console.log(`✅ Seeded ${prokerToInsert.length} program_kerjas.`);

        // 5. Galeri
        const kategoriOptions = ['Proyek Lapangan', 'Seminar Konstruksi', 'Lomba Desain', 'Uji Material', 'Sosial', 'Gathering'];
        const galeriToInsert = Array.from({ length: 15 }).map(() => ({
            id: uuidv4(),
            judul: faker.lorem.sentence(4),
            foto: 'galeri/fotos/placeholder.jpg',
            kategori: faker.helpers.arrayElement(kategoriOptions),
            tanggal: faker.date.recent({ days: 365 }),
            created_at: new Date(),
            updated_at: new Date()
        }));
        if (galeriToInsert.length > 0) await db('galeris').insert(galeriToInsert);
        console.log(`✅ Seeded ${galeriToInsert.length} galeris.`);

        // 6. Pesan (Auto increment ID, so no UUID)
        const pesanToInsert = Array.from({ length: 10 }).map(() => {
            const isRead = faker.datatype.boolean(0.4);
            return {
                nama: faker.person.fullName(),
                email: faker.datatype.boolean(0.8) ? faker.internet.email() : null,
                isi_pesan: faker.lorem.paragraphs(3),
                is_read: isRead,
                read_at: isRead ? faker.date.recent({ days: 30 }) : null,
                created_at: faker.date.recent({ days: 90 }),
                updated_at: new Date()
            };
        });
        if (pesanToInsert.length > 0) await db('pesans').insert(pesanToInsert);
        console.log(`✅ Seeded ${pesanToInsert.length} pesan.`);

        console.log('🎉 Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed error:', err);
        process.exit(1);
    }
}

seed();
