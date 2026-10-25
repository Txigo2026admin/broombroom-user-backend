require('dotenv').config();
const { Sequelize } = require('sequelize');

const rawDatabaseUrl = process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgress'}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'broomboom_user_db'}`;

// 1. Strip query parameters (like ?sslmode=require) so they don't override dialectOptions
const databaseUrl = rawDatabaseUrl.split('?')[0];

// 2. Enable SSL for any non-local connection, or when explicitly in production
const isRemoteOrProd = 
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.DATABASE_URL) ||
    (!rawDatabaseUrl.includes('127.0.0.1') && !rawDatabaseUrl.includes('localhost'));

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: isRemoteOrProd
        ? {
            ssl: {
                require: true,
                rejectUnauthorized: false // Bypasses self-signed certificate chain check
            }
        }
        : {},
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;

    try {
        await sequelize.authenticate();
        require('../models');
        isConnected = true;
        console.log('PostgreSQL connected successfully');
    } catch (error) {
        console.error('PostgreSQL connection error:', error.message);
        throw error;
    }
};

connectDB.sequelize = sequelize;
module.exports = connectDB;