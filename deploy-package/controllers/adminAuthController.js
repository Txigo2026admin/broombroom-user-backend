const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { Admin } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'broomboom_jwt_secret_key_2026';
const MAX_FAILED_ATTEMPTS = parseInt(process.env.ADMIN_LOCKOUT_MAX_ATTEMPTS || '5', 10);
const LOCKOUT_MINUTES = parseInt(process.env.ADMIN_LOCKOUT_MINUTES || '15', 10);

/**
 * Generate 6 random 8-character backup recovery codes
 */
const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 6; i++) {
        codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
};

/**
 * Admin Login with Password Hashing, Brute-Force Lockout, and 2FA/TOTP Verification
 */
const adminLogin = async (req, res) => {
    try {
        const { username, password, totpCode } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const cleanUsername = String(username).trim().toLowerCase();
        const cleanPassword = String(password).trim();

        // Query database for admin record
        const admin = await Admin.findOne({
            where: { username: cleanUsername }
        });

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Username or Password'
            });
        }

        // Check if account is temporarily locked out
        if (admin.isLocked()) {
            const remainingMs = admin.getRemainingLockoutMs();
            const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
            return res.status(423).json({
                success: false,
                message: `Account is temporarily locked due to multiple failed login attempts. Please try again after ${remainingMinutes} minute(s).`,
                isLocked: true,
                lockoutRemainingSeconds: Math.ceil(remainingMs / 1000)
            });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Admin account has been deactivated. Contact system administrator.'
            });
        }

        // Verify password using bcrypt salted compare
        const isPasswordMatch = await admin.validatePassword(cleanPassword);

        if (!isPasswordMatch) {
            // Increment failed attempts
            const attempts = (admin.failedLoginAttempts || 0) + 1;
            admin.failedLoginAttempts = attempts;
            admin.lastFailedAt = new Date();

            if (attempts >= MAX_FAILED_ATTEMPTS) {
                admin.lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
                await admin.save();

                return res.status(423).json({
                    success: false,
                    message: `Account has been temporarily locked for ${LOCKOUT_MINUTES} minutes due to ${MAX_FAILED_ATTEMPTS} consecutive failed attempts.`,
                    isLocked: true,
                    lockoutRemainingSeconds: LOCKOUT_MINUTES * 60
                });
            }

            await admin.save();
            const remaining = MAX_FAILED_ATTEMPTS - attempts;

            return res.status(401).json({
                success: false,
                message: `Invalid Username or Password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout)`,
                attemptsRemaining: remaining
            });
        }

        // Password is valid! Check Multi-Factor Authentication (2FA / TOTP)
        if (admin.twoFactorEnabled) {
            if (!totpCode || String(totpCode).trim() === '') {
                // Request 2FA TOTP code from user
                const tempToken = jwt.sign(
                    { id: admin.id, username: admin.username, stage: '2fa_required' },
                    JWT_SECRET,
                    { expiresIn: '5m' }
                );

                return res.status(200).json({
                    success: true,
                    mfaRequired: true,
                    tempToken,
                    message: 'Two-Factor Authentication required. Enter the 6-digit code from Google Authenticator.'
                });
            }

            // Verify TOTP code against stored base32 secret
            const cleanTotp = String(totpCode).trim().replace(/\s+/g, '');
            const isTotpValid = speakeasy.totp.verify({
                secret: admin.twoFactorSecret,
                encoding: 'base32',
                token: cleanTotp,
                window: 1 // +/- 30 seconds tolerance
            });

            // Also check if matches any one-time backup codes
            let usedBackupCode = false;
            let updatedBackupCodes = Array.isArray(admin.twoFactorBackupCodes)
                ? [...admin.twoFactorBackupCodes]
                : [];

            if (!isTotpValid && updatedBackupCodes.length > 0) {
                const codeIndex = updatedBackupCodes.findIndex(
                    (c) => String(c).toUpperCase() === cleanTotp.toUpperCase()
                );
                if (codeIndex !== -1) {
                    usedBackupCode = true;
                    updatedBackupCodes.splice(codeIndex, 1);
                    admin.twoFactorBackupCodes = updatedBackupCodes;
                }
            }

            if (!isTotpValid && !usedBackupCode) {
                return res.status(401).json({
                    success: false,
                    mfaRequired: true,
                    message: 'Invalid 6-digit Authenticator code or backup code. Please try again.'
                });
            }
        }

        // Successful authentication: Reset brute-force counters
        admin.failedLoginAttempts = 0;
        admin.lockUntil = null;
        admin.lastLoginAt = new Date();
        admin.lastLoginIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await admin.save();

        // Sign JWT token
        const token = jwt.sign(
            {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                isAdmin: true
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                twoFactorEnabled: Boolean(admin.twoFactorEnabled),
                mustChangePassword: Boolean(admin.mustChangePassword),
                lastLoginAt: admin.lastLoginAt
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication'
        });
    }
};

/**
 * Generate 2FA Secret and QR Code for Google Authenticator Setup
 */
const setup2FA = async (req, res) => {
    try {
        const admin = req.admin;

        // Generate base32 secret
        const secret = speakeasy.generateSecret({
            name: `BroomBoom Admin (${admin.username})`,
            issuer: 'BroomBoom Cabs',
            length: 20
        });

        // Generate QR code data URL
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        // Generate 6 backup codes
        const backupCodes = generateBackupCodes();

        return res.status(200).json({
            success: true,
            secret: secret.base32,
            qrCodeUrl,
            otpauthUrl: secret.otpauth_url,
            backupCodes
        });
    } catch (error) {
        console.error('Setup 2FA error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate 2FA credentials'
        });
    }
};

/**
 * Verify and Enable 2FA with initial 6-digit code from Google Authenticator
 */
const verifyAndEnable2FA = async (req, res) => {
    try {
        const admin = req.admin;
        const { secret, token, backupCodes } = req.body;

        if (!secret || !token) {
            return res.status(400).json({
                success: false,
                message: 'Secret and verification token are required'
            });
        }

        const cleanToken = String(token).trim().replace(/\s+/g, '');

        const verified = speakeasy.totp.verify({
            secret: secret.trim(),
            encoding: 'base32',
            token: cleanToken,
            window: 1
        });

        if (!verified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid 6-digit code from Google Authenticator. Please verify time synchronization and try again.'
            });
        }

        admin.twoFactorEnabled = true;
        admin.twoFactorSecret = secret.trim();
        admin.twoFactorBackupCodes = Array.isArray(backupCodes) ? backupCodes : [];
        await admin.save();

        return res.status(200).json({
            success: true,
            message: 'Two-Factor Authentication (Google Authenticator) enabled successfully!'
        });
    } catch (error) {
        console.error('Verify 2FA error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify and activate 2FA'
        });
    }
};

/**
 * Disable 2FA (Requires current password and current 2FA code for safety)
 */
const disable2FA = async (req, res) => {
    try {
        const admin = req.admin;
        const { password, totpCode } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Current password is required to disable 2FA'
            });
        }

        const isPasswordMatch = await admin.validatePassword(String(password).trim());
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Incorrect password'
            });
        }

        if (admin.twoFactorSecret && totpCode) {
            const cleanTotp = String(totpCode).trim().replace(/\s+/g, '');
            const verified = speakeasy.totp.verify({
                secret: admin.twoFactorSecret,
                encoding: 'base32',
                token: cleanTotp,
                window: 1
            });
            if (!verified) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Authenticator code'
                });
            }
        }

        admin.twoFactorEnabled = false;
        admin.twoFactorSecret = null;
        admin.twoFactorBackupCodes = [];
        await admin.save();

        return res.status(200).json({
            success: true,
            message: 'Two-Factor Authentication disabled successfully.'
        });
    } catch (error) {
        console.error('Disable 2FA error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to disable 2FA'
        });
    }
};

/**
 * Change Admin Password with validation and bcrypt hashing
 */
const changePassword = async (req, res) => {
    try {
        const admin = req.admin;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Both current password and new password are required'
            });
        }

        const cleanCurrent = String(currentPassword).trim();
        const cleanNew = String(newPassword).trim();

        if (cleanNew.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long'
            });
        }

        const isCurrentMatch = await admin.validatePassword(cleanCurrent);
        if (!isCurrentMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password does not match'
            });
        }

        // Update password (Admin beforeSave hook will salt & hash with bcrypt 12 rounds)
        admin.password = cleanNew;
        admin.mustChangePassword = false;
        admin.passwordChangedAt = new Date();
        await admin.save();

        return res.status(200).json({
            success: true,
            message: 'Password changed successfully. Your account is now secured with the new password.'
        });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update password'
        });
    }
};

/**
 * Get Current Admin Security Profile
 */
const getAdminProfile = async (req, res) => {
    try {
        const admin = req.admin;

        return res.status(200).json({
            success: true,
            admin: {
                id: admin.id,
                username: admin.username,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                twoFactorEnabled: Boolean(admin.twoFactorEnabled),
                mustChangePassword: Boolean(admin.mustChangePassword),
                lastLoginAt: admin.lastLoginAt,
                passwordChangedAt: admin.passwordChangedAt
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve admin profile'
        });
    }
};

module.exports = {
    adminLogin,
    setup2FA,
    verifyAndEnable2FA,
    disable2FA,
    changePassword,
    getAdminProfile
};
