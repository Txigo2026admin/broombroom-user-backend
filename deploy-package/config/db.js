
require('dotenv').config();

const { Sequelize } = require('sequelize');

const rawDatabaseUrl =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgress'}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'broomboom_user_db'}`;

const databaseUrl = rawDatabaseUrl.split('?')[0];

const isLocal =
    rawDatabaseUrl.includes('127.0.0.1') ||
    rawDatabaseUrl.includes('localhost');

const useSsl =
    process.env.DB_SSL === 'true' ||
    (
        process.env.DB_SSL !== 'false' &&
        !isLocal &&
        process.env.NODE_ENV === 'production'
    );

const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: useSsl
        ? {
            ssl: {
                require: true,
                rejectUnauthorized: false
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

let connectionPromise = null;

const connectDB = async () => {
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = sequelize.authenticate()
        .then(() => {
            console.log('PostgreSQL connected successfully');
            return true;
        })
        .catch((error) => {
            connectionPromise = null;
            console.error('PostgreSQL connection error:', error.message);
            throw error;
        });

    return connectionPromise;
};

connectDB.sequelize = sequelize;

module.exports = connectDB;
