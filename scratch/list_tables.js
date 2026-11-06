const { sequelize } = require('../config/db');

async function check() {
  const [tables] = await sequelize.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
  console.log('Tables:', tables.map(t => t.tablename));
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });

