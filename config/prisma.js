require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const rawConnectionString = process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgress'}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'broomboom_user_db'}`;

// 1. Strip query string (e.g., ?sslmode=require) so pg doesn't override rejectUnauthorized
const connectionString = rawConnectionString.split('?')[0];

// 2. Enable SSL if connecting to any remote host or if DATABASE_URL / NODE_ENV is set
const isRemote =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.DATABASE_URL) ||
    (!rawConnectionString.includes('127.0.0.1') && !rawConnectionString.includes('localhost'));

const pool = new Pool({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    max: 5,
    connectionTimeoutMillis: 10000
});

const adapter = new PrismaPg(pool);

// 3. Prevent duplicate PrismaClient instances across cloud function invocations
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

module.exports = prisma;