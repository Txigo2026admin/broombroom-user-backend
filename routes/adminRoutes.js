const express = require('express');
const router = express.Router();
const {
    adminLogin,
    setup2FA,
    verifyAndEnable2FA,
    disable2FA,
    changePassword,
    getAdminProfile
} = require('../controllers/adminAuthController');

const { protectAdmin } = require('../middleware/adminAuthMiddleware');
const { adminLoginRateLimiter } = require('../middleware/rateLimiter');

// Public route with rate limiting & brute-force lockout
router.post('/login', adminLoginRateLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 15 }), adminLogin);

// Protected routes (requires valid admin JWT)
router.get('/me', protectAdmin, getAdminProfile);
router.post('/change-password', protectAdmin, changePassword);
router.post('/2fa/setup', protectAdmin, setup2FA);
router.post('/2fa/verify', protectAdmin, verifyAndEnable2FA);
router.post('/2fa/disable', protectAdmin, disable2FA);

module.exports = router;
