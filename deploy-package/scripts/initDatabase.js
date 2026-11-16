
require('dotenv').config();

const connectDB = require('../config/db');
const models = require('../models');

const initializeDatabase = async () => {
    const sequelize = connectDB.sequelize;

    try {
        console.log('Connecting to PostgreSQL...');
        await connectDB();

        console.log('Registering 13 Sequelize models...');
        console.log('Creating missing Sequelize tables...');

        // Creates missing tables only. Does not alter or drop existing tables.
        await sequelize.sync();

        console.log('Creating Prisma OTP verification table...');

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS otp_verifications (
                id UUID PRIMARY KEY,
                phone VARCHAR(255) NOT NULL,
                "otpHash" VARCHAR(255) NOT NULL,
                "expiresAt" TIMESTAMPTZ(6) NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                verified BOOLEAN NOT NULL DEFAULT FALSE,
                "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS otp_verifications_phone_idx
            ON otp_verifications (phone);
        `);

        console.log('Ensuring user unique indexes...');

        await sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
            ON users (phone);
        `);

        await sequelize.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
            ON users (email);
        `);

        console.log('Database initialization completed successfully.');
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exitCode = 1;
    } finally {
        await connectDB.sequelize.close();
    }
};

initializeDatabase();
