const { sequelize } = require('../config/db');

async function run() {
  try {
    await sequelize.query(`
      UPDATE users 
      SET "source" = 'BroomBoom App' 
      WHERE "source" IS NULL OR "source" = '';
    `);
    console.log('Successfully updated NULL sources to BroomBoom App');

    const [rows] = await sequelize.query('SELECT id, name, phone, "source", "loginCount", "updatedAt" FROM users ORDER BY "updatedAt" DESC LIMIT 5;');
    console.log('Recent users:', rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
