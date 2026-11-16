const express = require('express');
const router = express.Router();

const {
    sendOtp,
    verifyOtp,
    getProfile
} = require('../controllers/authController');

const {
    internationalLogin
} = require('../controllers/internationalAuthController');

const {
    getDeliveryReport
} = require('../services/smsDeliveryService');

const { protect } = require('../middleware/authMiddleware');

// Send OTP
router.post('/send-otp', sendOtp);

// Verify OTP and login
router.post('/verify-otp', verifyOtp);

// International login (Email or Google without SMS OTP)
router.post('/international-login', internationalLogin);

// Check PRP SMS delivery status
router.get('/sms-status/:messageId/:mobile', async (req, res) => {
    try {
        const result = await getDeliveryReport(
            req.params.messageId,
            req.params.mobile
        );

        return res.status(200).json({
            success: true,
            result
        });

    } catch (error) {
        console.error('Delivery report error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get logged-in user
router.get('/profile', protect, getProfile);

module.exports = router;