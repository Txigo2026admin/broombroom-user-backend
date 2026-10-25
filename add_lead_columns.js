const { sequelize } = require('./config/db');

async function migrate() {
    try {
        await sequelize.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS "loginCount" INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS "leadType" VARCHAR(50) DEFAULT 'New';
        `);
        console.log('Migration completed: loginCount and leadType columns added');
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    }
}

migrate();

