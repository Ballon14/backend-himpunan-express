/**
 * CLI Script to add admin user to the database
 * Usage: node src/add-admin.js
 *
 * This script allows you to interactively add a new admin user
 * without modifying the seed.js file
 */

//gentagagtg@gmail.com
//pw: hmtkbgmengangkasa

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');
const db = require('./config/database');
const logger = require('./helpers/logger');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to prompt user
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Main function
async function addAdmin() {
    try {
        console.log('\n╔═══════════════════════════════════════╗');
        console.log('║   🔐 Add New Admin User               ║');
        console.log('╚═══════════════════════════════════════╝\n');

        // Get input from user
        let email = '';
        while (!email) {
            email = await prompt('📧 Email: ');
            if (!isValidEmail(email)) {
                console.log('❌ Email format tidak valid. Silahkan coba lagi.');
                email = '';
            }
        }

        // Check if email already exists
        const existingUser = await db('users').where('email', email).first();
        if (existingUser) {
            console.log(`\n❌ Email ${email} sudah terdaftar sebagai admin.`);
            rl.close();
            process.exit(1);
        }

        let name = '';
        while (!name) {
            name = await prompt('👤 Nama Lengkap: ');
        }

        let password = '';
        while (!password || password.length < 6) {
            password = await prompt('🔑 Password (minimal 6 karakter): ');
            if (password.length < 6) {
                console.log('⚠️  Password harus minimal 6 karakter.');
                password = '';
            }
        }

        // Confirm before creating
        console.log('\n📋 Konfirmasi data:');
        console.log(`   Email: ${email}`);
        console.log(`   Nama:  ${name}`);
        console.log(`   Pass:  ${'*'.repeat(password.length)}`);

        const confirm = await prompt('\n✅ Lanjutkan menambahkan admin? (yes/no): ');
        if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
            console.log('\n❌ Pembatalan.');
            rl.close();
            process.exit(0);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Insert to database
        await db('users').insert({
            id: uuidv4(),
            name,
            email,
            password: hashedPassword,
            created_at: new Date(),
            updated_at: new Date(),
        });

        console.log(`\n✅ Admin berhasil ditambahkan!`);
        console.log(`   📧 Email: ${email}`);
        console.log(`   👤 Nama:  ${name}\n`);

        // Log audit
        try {
            logger.audit('admin ditambahkan', 'admin', null, { actor: 'CLI', changes: { email, name } });
        } catch (e) {
            // Silent fail for logging
        }

        rl.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Run the script
addAdmin();
