
require('dotenv').config();

const app = require('./index');
const connectDB = require('./config/db');

const PORT = Number(process.env.PORT || 5004);
const HOST = '127.0.0.1';

async function startServer() {
    try {
        await connectDB();

        const server = app.listen(PORT, HOST, () => {
            console.log(`BroomBoom User API running on ${HOST}:${PORT}`);
        });

        server.on('error', (error) => {
            console.error('Server startup error:', error);
            process.exit(1);
        });
    } catch (error) {
        console.error('Backend startup failed:', error);
        process.exit(1);
    }
}

startServer();
