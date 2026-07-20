require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/car-categories', require('./routes/carCategoryRoutes'));
app.use('/api/pricing-rules', require('./routes/pricingRuleRoutes'));
app.use('/api/global-settings', require('./routes/globalSettingRoutes'));
app.use('/api/cities', require('./routes/cityRoutes'));

// Root Route
app.get('/', (req, res) => {
    res.send('Broom Boom Cabs User Backend API is running...');
});

const PORT = process.env.PORT || 5004;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
