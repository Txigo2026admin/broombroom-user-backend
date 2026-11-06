require('dotenv').config();
const { Sequelize } = require('sequelize');

const rawDatabaseUrl = process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgress'}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'broomboom_user_db'}`;

// 1. Strip query parameters (like ?sslmode=require) so they don't override dialectOptions
const databaseUrl = rawDatabaseUrl.split('?')[0];

// 2. Enable SSL for remote/hosted databases (Neon, Supabase, Render, RDS), disable for local development
const isExplicitSslDisabled = process.env.DB_SSL === 'false';
const isExplicitSslEnabled = process.env.DB_SSL === 'true';
const isLocal = rawDatabaseUrl.includes('127.0.0.1') || rawDatabaseUrl.includes('localhost');

const useSsl = isExplicitSslEnabled || (!isExplicitSslDisabled && !isLocal && (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.DATABASE_URL)
));

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: useSsl
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
        const models = require('../models');
        if (models.AirportPricing) {
            await models.AirportPricing.sync({ alter: true }).catch(() => {});
        }
        if (models.StatePricing) {
            await models.StatePricing.sync({ alter: true }).catch(() => {});
        }
        if (models.RoutePricing) {
            await models.RoutePricing.sync({ alter: true }).catch(() => {});
        }
        if (models.RentalPackage) {
            await models.RentalPackage.sync({ alter: true }).catch(() => {});
        }
        if (models.CarCategory) {
            await models.CarCategory.sync({ alter: true }).catch(() => {});
        }
        if (models.PricingRule) {
            await models.PricingRule.sync({ alter: true }).catch(() => {});
        }
        try {
            await sequelize.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS "source" VARCHAR(100) DEFAULT 'BroomBoom App',
                ADD COLUMN IF NOT EXISTS "loginHistory" JSONB DEFAULT '[]'::jsonb;
                UPDATE users SET "source" = 'BroomBoom App' WHERE "source" IS NULL OR "source" = '';
                UPDATE users SET "loginHistory" = '[]'::jsonb WHERE "loginHistory" IS NULL;

                ALTER TABLE state_pricings 
                ADD COLUMN IF NOT EXISTS "rate0to50" FLOAT,
                ADD COLUMN IF NOT EXISTS "rate51to100" FLOAT,
                ADD COLUMN IF NOT EXISTS "rate101to150" FLOAT,
                ADD COLUMN IF NOT EXISTS "rate151to200" FLOAT,
                ADD COLUMN IF NOT EXISTS "rate201to4000" FLOAT,
                ADD COLUMN IF NOT EXISTS "slabRates" JSONB,
                ADD COLUMN IF NOT EXISTS "advanceType" VARCHAR(50) DEFAULT 'Percentage',
                ADD COLUMN IF NOT EXISTS "advanceValue" FLOAT DEFAULT 20;

                DELETE FROM airport_pricings WHERE LOWER("carCategory") = 'hatchback';
                DELETE FROM state_pricings WHERE LOWER("carCategory") = 'hatchback';
                DELETE FROM car_categories WHERE LOWER("name") = 'hatchback';
            `);
        } catch (migErr) {
            console.error('Auto migration columns error:', migErr.message);
        }
        isConnected = true;
        console.log('PostgreSQL connected successfully');
    } catch (error) {
        console.error('PostgreSQL connection error:', error.message);
        throw error;
    }
};

connectDB.sequelize = sequelize;
module.exports = connectDB;