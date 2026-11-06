const { sequelize } = require('../config/db');

async function run() {
  try {
    const history = JSON.stringify([
      {
        id: 'log-web-' + Date.now(),
        source: 'BroomBoom Web',
        loginTime: new Date(Date.now() - 300000).toISOString(), // ~5 mins ago
        leadType: 'Existing'
      },
      {
        id: 'log-app-' + Date.now(),
        source: 'BroomBoom App',
        loginTime: '2026-11-05T10:36:52.565Z', // App login time
        leadType: 'Existing'
      }
    ]);

    await sequelize.query(`
      UPDATE users 
      SET "loginHistory" = :history::jsonb
      WHERE phone LIKE '%8583992978%';
    `, {
      replacements: { history }
    });

    console.log('Successfully updated loginHistory for 8583992978');
    const [rows] = await sequelize.query(`
      SELECT id, name, phone, "source", "loginHistory" FROM users WHERE phone LIKE '%8583992978%';
    `);
    console.log('Updated records:', rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();

