# Himpunan Mahasiswa TKBG (Teknologi Konstruksi Bangunan Gedung) Semarang - Backend API

This is the Express.js backend API repository that powers the Himpunan Mahasiswa TKBG Semarang website and Admin Panel. It handles data management for Members, News, Work Programs, Gallery, and incoming Contact Messages.

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL / MySQL (via Knex.js SQL Query Builder)
- **Object Relational Mapper:** Bookshelf.js (or direct Knex queries)
- **Authentication:** JWT (JSON Web Tokens) & bcryptjs
- **File Uploads:** Multer
- **Validation:** Joi / express-validator

## Core Entities
- **Users (Admins):** For dashboard authentication.
- **Anggotas (Members):** Managing organization members.
- **Beritas (News):** News and article management with rich text support.
- **Program Kerjas (Programs):** Managing upcoming and past work programs.
- **Galeris:** Image gallery management.
- **Pesans (Messages):** Handling contact form submissions from the frontend.

## Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Database Server (MySQL/PostgreSQL depending on configuration)

## Installation & Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Ballon14/backend-himpunan-express.git
   cd backend-express
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the environment variables. Create a `.env` file in the root directory:
   ```env
   # Example configuration
   PORT=8000
   NODE_ENV=development
   
   # Database Configuration
   DB_CLIENT=mysql2
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=himpunan_db
   
   # JWT Secret
   JWT_SECRET=your_super_secret_jwt_key
   
   # Origin URL for CORS (Frontend URL)
   CORS_ORIGIN=https://himpunan.iqbaldev.site
   ```

## Database Migration & Seeding
This project uses Knex migrations to schema management.
1. Run migrations to create tables:
   ```bash
   npx knex migrate:latest
   ```
2. Seed the database with initial Admin accounts and dummy data:
   ```bash
   npm run seed
   # or
   node src/seed.js
   ```

### Default Admin Credentials (after seeding)
- **Email:** `admin@hmtkbg.com`
- **Password:** `admin123`
- *(Additional admin: `iqbal140605@gmail.com` / `iqbal`)*

## Running the Server
**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```
By default, the API will be accessible at `http://localhost:8000`.

## API Endpoints (Brief Overview)
- `POST /api/login` - Admin authentication
- `GET /api/me` - Get current authenticated user
- `GET/POST/PUT/DELETE /api/anggota` - Manage members
- `GET/POST/PUT/DELETE /api/berita` - Manage news
- `GET/POST/PUT/DELETE /api/program-kerja` - Manage programs
- `GET/POST/PUT/DELETE /api/galeri` - Manage gallery 
- `GET/POST/PATCH/DELETE /api/pesan` - Manage contact messages (Public can only POST)
- `GET /api/dashboard/stats` - Get statistics for admin dashboard
