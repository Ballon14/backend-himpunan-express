require('dotenv').config();

module.exports = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '100.64.75.107',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_DATABASE || 'db_himpunan',
    user: process.env.DB_USERNAME || 'iqbal',
    password: process.env.DB_PASSWORD || 'iqbal',
  },
  pool: { min: 2, max: 10 },
};
