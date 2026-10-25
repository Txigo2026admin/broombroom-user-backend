require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

const corsOptions = {
    origin: true, // Allow any origin that sends a request (including localhost ports and web preview)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Ensure DB is connected before handling any request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({ message: 'Database connection failed' });
    }
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/car-categories', require('./routes/carCategoryRoutes'));
app.use('/api/pricing-rules', require('./routes/pricingRuleRoutes'));
app.use('/api/global-settings', require('./routes/globalSettingRoutes'));
app.use('/api/cities', require('./routes/cityRoutes'));
app.use('/api/airports', require('./routes/airportRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.get('/', (req, res) => {
    res.send('Broom Boom Cabs User Backend API is running...');
});

// Only listen locally — Vercel imports `app` directly and handles requests itself
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5004;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;