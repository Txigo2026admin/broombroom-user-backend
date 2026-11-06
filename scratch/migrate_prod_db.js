const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env.prod') });

const { Sequelize } = require('sequelize');
const dbUrl = process.env.DATABASE_URL;

console.log('Connecting to production DB...');
const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to production database!');

    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS "source" VARCHAR(100) DEFAULT 'BroomBoom App';
    `);
    console.log('Successfully added source column to production users table');

    await sequelize.query(`
      UPDATE users 
      SET "source" = 'BroomBoom App' 
      WHERE "source" IS NULL OR "source" = '';
    `);
    console.log('Successfully updated existing rows');

    const [rows] = await sequelize.query('SELECT id, name, phone, "source", "updatedAt" FROM users ORDER BY "updatedAt" DESC LIMIT 5;');
    console.log('Top production users:', rows);
    process.exit(0);
  } catch (err) {
    console.error('Error on production migration:', err);
    process.exit(1);
  }
}

run();

