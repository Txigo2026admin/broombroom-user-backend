const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

const protectAdmin = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied: Admin authentication token required'
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'broomboom_jwt_secret_key_2026'
        );

        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin token'
            });
        }

        const admin = await Admin.findByPk(decoded.id);

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Admin account not found'
            });
        }

        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Admin account has been deactivated. Please contact system owner.'
            });
        }

        if (admin.isLocked()) {
            const remainingMinutes = Math.ceil(admin.getRemainingLockoutMs() / (60 * 1000));
            return res.status(423).json({
                success: false,
                message: `Account is temporarily locked due to consecutive failed attempts. Try again in ${remainingMinutes} minute(s).`,
                isLocked: true,
                lockoutRemainingSeconds: Math.ceil(admin.getRemainingLockoutMs() / 1000)
            });
        }

        req.admin = admin;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Session expired or invalid token. Please log in again.'
        });
    }
};

module.exports = {
    protectAdmin
};
