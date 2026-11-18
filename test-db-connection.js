require("dotenv").config();
const db = require("./config/db");
db().then(async () => {
  console.log("DATABASE CONNECTION SUCCESS");
  await db.sequelize.close();
}).catch((error) => {
  console.error("DATABASE CONNECTION FAILED:", error.message);
  process.exit(1);
});
