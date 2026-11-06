const { sequelize } = require('../config/db');
sequelize.query('SELECT id, name, phone, email, status, "registeredAt", "updatedAt", "loginCount", "leadType" FROM users ORDER BY "updatedAt" DESC LIMIT 5;')
  .then(([results]) => {
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
