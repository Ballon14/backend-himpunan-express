/**
 * Seed admin user into the database.
 * Usage: node src/seed.js
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/database');

const { fakerID_ID: faker } = require('@faker-js/faker');

async function seed() {
    try {
        console.log('🌱 Starting database seeding...');

        // 1. Admin User
        const email = 'iqbal140605@gmail.com';
        const existing = await db('users').where('email', email).first();
        if (!existing) {
            const hashedPassword = await bcrypt.hash('iqbal', 12);
            await db('users').insert({
                id: uuidv4(),
                name: 'Iqbal',
                email,
                password: hashedPassword,
                created_at: new Date(),
                updated_at: new Date(),
            });
            console.log('✅ Admin user created successfully!');
        } else {
            console.log('✅ Admin user already exists. Skipping user creation.');
        }

        // Prompt clear existing data
        console.log('🗑️  Clearing existing dummy data (except users)...');
        await db('pesans').del();
        await db('galeris').del();
        await db('program_kerjas').del();
        await db('beritas').del();
        await db('anggotas').del();

        // 2. Anggotas
        const jabatanOptions = ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara', 'Koordinator Divisi', 'Anggota', null];
        const jurusanOptions = ['Teknik Informatika', 'Sistem Informasi', 'Teknik Elektro', 'Teknik Mesin', 'Teknik Sipil', 'Manajemen', 'Akuntansi'];

        const anggotasToInsert = Array.from({ length: 20 }).map(() => ({
            id: uuidv4(),
            nama: faker.person.fullName(),
            nim: faker.string.numeric(10),
            jurusan: faker.helpers.arrayElement(jurusanOptions),
            angkatan: faker.number.int({ min: 2020, max: 2025 }).toString(),
            jabatan: faker.helpers.arrayElement(jabatanOptions),
            status_aktif: faker.datatype.boolean(0.85),
            foto: null,
            created_at: new Date(),
            updated_at: new Date()
        }));
        if (anggotasToInsert.length > 0) await db('anggotas').insert(anggotasToInsert);
        console.log(`✅ Seeded ${anggotasToInsert.length} anggotas.`);


        // 3. Berita
        const beritasToInsert = Array.from({ length: 10 }).map(() => {
            const judul = faker.lorem.sentence(6);
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
                created_at: faker.date.recent({ days: 180 }),
                updated_at: new Date()
            };
        });
        if (beritasToInsert.length > 0) await db('beritas').insert(beritasToInsert);
        console.log(`✅ Seeded ${beritasToInsert.length} beritas.`);


        // 4. Program Kerja
        const prokerOptions = ['Webinar Teknologi', 'Workshop UI/UX Design', 'Bakti Sosial', 'Musyawarah Besar', 'Pelatihan Leadership', 'Seminar Nasional', 'Lomba Coding', 'Study Tour', 'Pengabdian Masyarakat'];
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
        const kategoriOptions = ['Kegiatan', 'Seminar', 'Workshop', 'Lomba', 'Sosial', 'Gathering'];
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
                isi_pesan: faker.lorem.paragraph(3),
                is_read: isRead,
                read_at: isRead ? faker.date.recent({ days: 30 }) : null,
                created_at: faker.date.recent({ days: 90 }),
                updated_at: new Date()
            };
        });
        if (pesanToInsert.length > 0) await db('pesans').insert(pesanToInsert);
        console.log(`✅ Seeded ${pesanToInsert.length} pesans.`);


        console.log('🎉 Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed error:', err);
        process.exit(1);
    }
}

seed();
