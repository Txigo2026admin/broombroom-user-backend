const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');



const { sendOtpSms } = require('../services/smsService');
// =====================================================
// NORMALIZE INDIAN PHONE NUMBER
// =====================================================
const normalizePhone = (phone) => {
    if (!phone) {
        return null;
    }

    // Remove spaces, +, -, brackets, etc.
    let cleanPhone = String(phone).replace(/\D/g, '');

    // Convert 91XXXXXXXXXX -> XXXXXXXXXX
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        cleanPhone = cleanPhone.substring(2);
    }

    // Must be a valid Indian 10-digit mobile number
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        return null;
    }

    return cleanPhone;
};


// =====================================================
// SEND OTP
// POST /api/auth/send-otp
// =====================================================
exports.sendOtp = async (req, res) => {
    const { phone } = req.body;

    try {
        // -------------------------------------------------
        // Validate phone
        // -------------------------------------------------
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        const cleanPhone = normalizePhone(phone);

        if (!cleanPhone) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid 10-digit Indian mobile number'
            });
        }

        // -------------------------------------------------
        // Generate 4-digit OTP
        // -------------------------------------------------
        const otp = crypto
            .randomInt(1000, 10000)
            .toString();

        // -------------------------------------------------
        // Hash OTP before storing
        // -------------------------------------------------
        const otpHash = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');

        // -------------------------------------------------
        // OTP expires after 5 minutes
        // -------------------------------------------------
        const expiresAt = new Date(
            Date.now() + 5 * 60 * 1000
        );

        // -------------------------------------------------
        // Remove old OTPs for this phone
        // -------------------------------------------------
        await prisma.otp_verifications.deleteMany({
            where: {
                phone: cleanPhone
            }
        });

        // -------------------------------------------------
        // Store OTP in PostgreSQL
        // -------------------------------------------------
        await prisma.otp_verifications.create({
            data: {
                id: crypto.randomUUID(),
                phone: cleanPhone,
                otpHash: otpHash,
                expiresAt: expiresAt,
                attempts: 0,
                verified: false
            }
        });

        // -------------------------------------------------
        // Send OTP through PRP SMS
        // -------------------------------------------------
        try {
            const smsResponse = await sendOtpSms(
                cleanPhone,
                otp
            );

            console.log(
                'PRP SMS Response:',
                smsResponse
            );

        } catch (smsError) {
            // If SMS failed, remove the OTP
            // so the user cannot try to verify an OTP
            // that was never delivered.
            await prisma.otp_verifications.deleteMany({
                where: {
                    phone: cleanPhone
                }
            });

            console.error(
                'PRP SMS Error:',
                smsError
            );

            return res.status(502).json({
                success: false,
                message: 'Unable to send OTP SMS'
            });
        }



        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully'
        });

    } catch (error) {
        console.error(
            'Send OTP error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Unable to send OTP'
        });
    }
};


// =====================================================
// VERIFY OTP
// POST /api/auth/verify-otp
// =====================================================
exports.verifyOtp = async (req, res) => {
    const { phone, otp } = req.body;

    try {
        // -------------------------------------------------
        // Validate input
        // -------------------------------------------------
        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP are required'
            });
        }

        const cleanPhone = normalizePhone(phone);

        if (!cleanPhone) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid 10-digit Indian mobile number'
            });
        }

        const cleanOtp = String(otp).trim();

        if (!/^\d{4}$/.test(cleanOtp)) {
            return res.status(400).json({
                success: false,
                message: 'OTP must be 4 digits'
            });
        }

        // -------------------------------------------------
        // Find latest unverified OTP
        // -------------------------------------------------
        const otpRecord =
            await prisma.otp_verifications.findFirst({
                where: {
                    phone: cleanPhone,
                    verified: false
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message:
                    'OTP not found. Please request a new OTP.'
            });
        }

        // -------------------------------------------------
        // Check OTP expiry
        // -------------------------------------------------
        if (new Date() > otpRecord.expiresAt) {
            await prisma.otp_verifications.delete({
                where: {
                    id: otpRecord.id
                }
            });

            return res.status(400).json({
                success: false,
                message:
                    'OTP has expired. Please request a new OTP.'
            });
        }

        // -------------------------------------------------
        // Check maximum attempts
        // -------------------------------------------------
        if (otpRecord.attempts >= 5) {
            await prisma.otp_verifications.delete({
                where: {
                    id: otpRecord.id
                }
            });

            return res.status(429).json({
                success: false,
                message:
                    'Too many incorrect attempts. Please request a new OTP.'
            });
        }

        // -------------------------------------------------
        // Hash entered OTP
        // -------------------------------------------------
        const enteredOtpHash = crypto
            .createHash('sha256')
            .update(cleanOtp)
            .digest('hex');

        // -------------------------------------------------
        // Compare OTP with database hash (strict verification)
        // -------------------------------------------------
        if (enteredOtpHash !== otpRecord.otpHash) {
            await prisma.otp_verifications.update({
                where: {
                    id: otpRecord.id
                },
                data: {
                    attempts: {
                        increment: 1
                    }
                }
            });

            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please check the code sent to your mobile phone.'
            });
        }

        // -------------------------------------------------
        // OTP is correct
        // Mark as verified
        // -------------------------------------------------
        await prisma.otp_verifications.update({
            where: {
                id: otpRecord.id
            },
            data: {
                verified: true
            }
        });

        // -------------------------------------------------
        // Find existing user
        // -------------------------------------------------
        let user = await prisma.users.findUnique({
            where: {
                phone: cleanPhone
            }
        });

        // -------------------------------------------------
        // Create user if not exists
        // -------------------------------------------------
        if (!user) {
            user = await prisma.users.create({
                data: {
                    id: crypto.randomUUID(),
                    phone: cleanPhone,
                    name: 'New User',
                    status: 'Active',
                    loginCount: 1,
                    leadType: 'New',
                    registeredAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });
        } else {
            // Returning user logging in 2nd time or more
            // Check if user has paid bookings in the app (Loyal)
            let hasPaidBooking = false;
            try {
                const paidBooking = await prisma.bookings.findFirst({
                    where: {
                        customerMobile: cleanPhone,
                        OR: [
                            { paidAmount: { gt: 0 } },
                            { advance: { gt: 0 } },
                            { paymentStatus: 'PAID' }
                        ]
                    }
                });
                hasPaidBooking = !!paidBooking;
            } catch (err) {
                // Ignore if bookings table has different format
            }

            const newLoginCount = (user.loginCount || 1) + 1;
            const updatedLeadType = hasPaidBooking ? 'Loyal' : 'Existing';

            user = await prisma.users.update({
                where: { id: user.id },
                data: {
                    loginCount: newLoginCount,
                    leadType: updatedLeadType,
                    updatedAt: new Date()
                }
            });
        }

        // -------------------------------------------------
        // Generate JWT
        // -------------------------------------------------
        const token = jwt.sign(
            {
                id: user.id
            },
            process.env.JWT_SECRET || 'secret123',
            {
                expiresIn: '30d'
            }
        );

        // -------------------------------------------------
        // Successful login
        // -------------------------------------------------
        return res.status(200).json({
            success: true,
            message: 'Login successful',

            token,

            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                status: user.status
            }
        });

    } catch (error) {
        console.error(
            'Verify OTP error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Unable to verify OTP'
        });
    }
};


// =====================================================
// GET CURRENT USER PROFILE
// GET /api/auth/profile
// =====================================================
exports.getProfile = async (req, res) => {
    try {
        const user = await prisma.users.findUnique({
            where: {
                id: req.user.id
            }
        });

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        return res.status(200).json(user);

    } catch (error) {
        console.error(
            'Profile error:',
            error
        );

        return res.status(500).json({
            message: 'Unable to fetch profile'
        });
    }
};