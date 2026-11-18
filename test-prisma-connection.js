const prisma = require("./config/prisma");

async function test() {
  try {
    const result = await prisma.$queryRaw`
      SELECT current_database() AS database, NOW() AS server_time
    `;

    console.log("PRISMA CONNECTION SUCCESS:", result);
  } catch (error) {
    console.error("PRISMA CONNECTION FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

test();