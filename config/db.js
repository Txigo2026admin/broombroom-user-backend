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
        if (models.CareerLead) {
            await models.CareerLead.sync({ alter: true }).catch((err) => console.error('CareerLead sync error:', err));
        }
        if (models.Admin) {
            await models.Admin.sync({ alter: true }).catch((err) => console.error('Admin sync error:', err));
            try {
                const adminCount = await models.Admin.count();
                if (adminCount === 0) {
                    const defaultUsername = (process.env.DEFAULT_ADMIN_USERNAME || 'admin').trim().toLowerCase();
                    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@BroomBoom2026!';
                    const defaultName = process.env.DEFAULT_ADMIN_NAME || 'BroomBoom Controller';
                    const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@broomboom.com';

                    await models.Admin.create({
                        username: defaultUsername,
                        password: defaultPassword,
                        name: defaultName,
                        email: defaultEmail,
                        role: 'superadmin',
                        mustChangePassword: true
                    });
                    console.log(`[Security] Initial admin account "${defaultUsername}" created from environment variables with salted bcrypt hash.`);
                }
            } catch (seedErr) {
                console.error('[Security] Error checking/seeding initial admin:', seedErr.message);
            }
        }
        try {
            await sequelize.query(`
                DO $$
                DECLARE
                    r RECORD;
                BEGIN
                    FOR r IN (
                        SELECT conname
                        FROM pg_constraint
                        WHERE conrelid = 'users'::regclass AND contype = 'u'
                    ) LOOP
                        EXECUTE 'ALTER TABLE users DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
                    END LOOP;
                END $$;

                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS "source" VARCHAR(100) DEFAULT 'BroomBoom App',
                ADD COLUMN IF NOT EXISTS "loginHistory" JSONB DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS "city" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "state" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "vehicleType" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "carNo" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "licenseNo" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "notes" TEXT,
                ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP WITH TIME ZONE;
                UPDATE users SET "source" = 'BroomBoom App' WHERE "source" IS NULL OR "source" = '';
                UPDATE users SET "loginHistory" = '[]'::jsonb WHERE "loginHistory" IS NULL;

                ALTER TABLE state_pricings 
                ADD COLUMN IF NOT EXISTS "rate0to50" FLOAT,
                ADD COLUMN IF NOT EXISTS "rate51to100" FLOAT,
                ADD COLUMN IF NOT EXISTS "rate101to150" FLOAT,
                ADD COLUMN IF NOT EXISTS "rate151to200" FLOAT,
                ADD COLUMN IF NOT EXISTS "rate201to4000" FLOAT,
                ADD COLUMN IF NOT EXISTS "slabRates" JSONB,
                ADD COLUMN IF NOT EXISTS "hourly0to50" FLOAT,
                ADD COLUMN IF NOT EXISTS "hourly51to100" FLOAT,
                ADD COLUMN IF NOT EXISTS "hourly101to150" FLOAT,
                ADD COLUMN IF NOT EXISTS "hourly151to200" FLOAT,
                ADD COLUMN IF NOT EXISTS "hourly201to4000" FLOAT,
                ADD COLUMN IF NOT EXISTS "hourlySlabs" JSONB,
                ADD COLUMN IF NOT EXISTS "advanceType" VARCHAR(50) DEFAULT 'Percentage',
                ADD COLUMN IF NOT EXISTS "advanceValue" FLOAT DEFAULT 20;

                ALTER TABLE bookings
                ALTER COLUMN "dropAddress" DROP NOT NULL;

                ALTER TABLE bookings
                ADD COLUMN IF NOT EXISTS "fromCity" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "toCity" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "duration" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "petFriendly" BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS "petCount" INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "addons" JSONB DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS "source" VARCHAR(100) DEFAULT 'BroomBoom Web',
                ADD COLUMN IF NOT EXISTS "searchDetails" JSONB DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS "airportTerminal" VARCHAR(255),
                ADD COLUMN IF NOT EXISTS "companyShare" FLOAT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "driverShare" FLOAT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "addonAmount" FLOAT DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "isAdvancedPayment" VARCHAR(20) DEFAULT 'No',
                ADD COLUMN IF NOT EXISTS "zeroCommission" VARCHAR(20) DEFAULT 'Yes',
                ADD COLUMN IF NOT EXISTS "otpStatus" VARCHAR(50) DEFAULT 'Pending',
                ADD COLUMN IF NOT EXISTS "otpVerificationTime" VARCHAR(100),
                ADD COLUMN IF NOT EXISTS "rideStartTime" VARCHAR(100),
                ADD COLUMN IF NOT EXISTS "rideEndTime" VARCHAR(100),
                ADD COLUMN IF NOT EXISTS "rideStatus" VARCHAR(100),
                ADD COLUMN IF NOT EXISTS "paymentCollectionTime" VARCHAR(100),
                ADD COLUMN IF NOT EXISTS "driverId" VARCHAR(100);

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