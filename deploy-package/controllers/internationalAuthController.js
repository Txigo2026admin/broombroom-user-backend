const prisma = require('../config/prisma');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes an optional international phone number to E.164-like `+<digits>`.
 * Returns `{ phone: string | null, error: string | null }`.
 */
const normalizeInternationalPhone = (rawPhone, dialCode) => {
    if (!rawPhone || !String(rawPhone).trim()) {
        return { phone: null, error: null };
    }

    const trimmed = String(rawPhone).trim();
    const digits = trimmed.replace(/\D/g, '');

    if (!digits) {
        return { phone: null, error: null };
    }

    if (digits.length < 6 || digits.length > 15) {
        return {
            phone: null,
            error: 'Please enter a valid international phone number (6 to 15 digits).'
        };
    }

    const dialDigits = String(dialCode || '').replace(/\D/g, '');
    if (trimmed.startsWith('+')) {
        return { phone: `+${digits}`, error: null };
    }

    if (dialDigits && !digits.startsWith(dialDigits)) {
        return { phone: `+${dialDigits}${digits}`, error: null };
    }

    return { phone: `+${digits}`, error: null };
};

/**
 * Verifies Google OAuth credentials (`idToken` or `accessToken`) with Google's endpoints.
 */
const verifyGoogleCredentials = async ({ idToken, accessToken, expectedEmail }) => {
    try {
        if (idToken) {
            const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
            const response = await fetch(url);
            if (!response.ok) {
                return { valid: false, message: 'Invalid or expired Google ID token.' };
            }

            const data = await response.json();
            const tokenEmail = String(data.email || '').trim().toLowerCase();
            const isVerified = data.email_verified === true || data.email_verified === 'true';

            if (!tokenEmail || !isVerified || (expectedEmail && tokenEmail !== expectedEmail)) {
                return { valid: false, message: 'Google account email verification failed.' };
            }

            if (
                process.env.GOOGLE_CLIENT_ID &&
                data.aud &&
                data.aud !== process.env.GOOGLE_CLIENT_ID &&
                data.azp !== process.env.GOOGLE_CLIENT_ID
            ) {
                return { valid: false, message: 'Google token audience mismatch.' };
            }

            return {
                valid: true,
                email: tokenEmail,
                name: data.name ? String(data.name).trim() : ''
            };
        }

        if (accessToken) {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                return { valid: false, message: 'Invalid or expired Google access token.' };
            }

            const data = await response.json();
            const tokenEmail = String(data.email || '').trim().toLowerCase();
            const isVerified = data.email_verified !== false && data.email_verified !== 'false';

            if (!tokenEmail || !isVerified || (expectedEmail && tokenEmail !== expectedEmail)) {
                return { valid: false, message: 'Google account email verification failed.' };
            }

            return {
                valid: true,
                email: tokenEmail,
                name: data.name ? String(data.name).trim() : ''
            };
        }

        return {
            valid: false,
            message: 'Google authentication token is required.'
        };
    } catch (err) {
        console.error('Google token verification error:', err);
        return {
            valid: false,
            message: 'Unable to verify Google credentials right now.'
        };
    }
};

// =====================================================
// INTERNATIONAL LOGIN (EMAIL OR GOOGLE - NO SMS OTP)
// POST /api/auth/international-login
// =====================================================
exports.internationalLogin = async (req, res) => {
    try {
        const {
            authProvider = 'email',
            email,
            name,
            phone,
            countryCode,
            dialCode,
            idToken,
            accessToken
        } = req.body || {};

        const cleanProvider = String(authProvider || 'email').trim().toLowerCase();
        if (cleanProvider !== 'email' && cleanProvider !== 'google') {
            return res.status(400).json({
                success: false,
                message: 'Unsupported authentication method. Use email or google.'
            });
        }

        const cleanCountryCode = String(countryCode || '').trim().toUpperCase();
        const cleanDialDigits = String(dialCode || '').replace(/\D/g, '');

        if (cleanCountryCode === 'IN' || cleanDialDigits === '91') {
            return res.status(400).json({
                success: false,
                message: 'Indian mobile numbers must verify through SMS OTP.'
            });
        }

        let cleanEmail = String(email || '').trim().toLowerCase();
        let cleanName = String(name || '').trim();

        if (cleanProvider === 'google') {
            const googleCheck = await verifyGoogleCredentials({
                idToken,
                accessToken,
                expectedEmail: cleanEmail || null
            });

            if (!googleCheck.valid) {
                return res.status(401).json({
                    success: false,
                    message: googleCheck.message
                });
            }

            cleanEmail = googleCheck.email;
            if (!cleanName && googleCheck.name) {
                cleanName = googleCheck.name;
            }
        }

        if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address.'
            });
        }

        const { phone: normalizedPhone, error: phoneError } = normalizeInternationalPhone(
            phone,
            cleanDialDigits
        );

        if (phoneError) {
            return res.status(400).json({
                success: false,
                message: phoneError
            });
        }

        if (normalizedPhone && normalizedPhone.startsWith('+91') && !cleanCountryCode) {
            return res.status(400).json({
                success: false,
                message: 'Indian mobile numbers must verify through SMS OTP.'
            });
        }

        // Lookup by email first, then optional international phone
        let user = await prisma.users.findFirst({
            where: {
                email: {
                    equals: cleanEmail,
                    mode: 'insensitive'
                }
            }
        });

        if (!user && normalizedPhone) {
            const phoneDigitsOnly = normalizedPhone.replace(/^\+/, '');
            user = await prisma.users.findFirst({
                where: {
                    phone: {
                        in: [normalizedPhone, phoneDigitsOnly]
                    }
                }
            });
        }

        if (!user) {
            const fallbackPhone = `intl_${crypto
                .createHash('sha256')
                .update(cleanEmail)
                .digest('hex')
                .slice(0, 16)}`;

            const phoneToStore = normalizedPhone || fallbackPhone;
            const displayName = cleanName || cleanEmail.split('@')[0] || 'New User';
            const now = new Date();

            const initialLog = [{
                id: crypto.randomUUID(),
                source: 'BroomBoom App',
                authProvider: cleanProvider,
                countryCode: cleanCountryCode || null,
                dialCode: cleanDialDigits ? `+${cleanDialDigits}` : null,
                loginTime: now.toISOString(),
                leadType: 'New'
            }];

            user = await prisma.users.create({
                data: {
                    id: crypto.randomUUID(),
                    phone: phoneToStore,
                    email: cleanEmail,
                    name: displayName,
                    status: 'Active',
                    loginCount: 1,
                    leadType: 'New',
                    source: 'BroomBoom App',
                    loginHistory: initialLog,
                    registeredAt: now,
                    createdAt: now,
                    updatedAt: now
                }
            });
        } else {
            let hasPaidBooking = false;
            try {
                if (user.phone && !user.phone.startsWith('intl_')) {
                    const paidBooking = await prisma.bookings.findFirst({
                        where: {
                            customerMobile: user.phone,
                            OR: [
                                { paidAmount: { gt: 0 } },
                                { advance: { gt: 0 } },
                                { paymentStatus: 'PAID' }
                            ]
                        }
                    });
                    hasPaidBooking = !!paidBooking;
                }
            } catch (err) {
                // Ignore if bookings table format differs
            }

            const newLoginCount = (user.loginCount || 1) + 1;
            const updatedLeadType = hasPaidBooking ? 'Loyal' : 'Existing';

            let currentHistory = [];
            try {
                if (Array.isArray(user.loginHistory)) {
                    currentHistory = user.loginHistory;
                } else if (typeof user.loginHistory === 'string') {
                    currentHistory = JSON.parse(user.loginHistory || '[]');
                }
            } catch (e) {
                currentHistory = [];
            }

            const appLoginEntry = {
                id: crypto.randomUUID(),
                source: 'BroomBoom App',
                authProvider: cleanProvider,
                countryCode: cleanCountryCode || null,
                dialCode: cleanDialDigits ? `+${cleanDialDigits}` : null,
                loginTime: new Date().toISOString(),
                leadType: updatedLeadType
            };

            const updatedHistory = [appLoginEntry, ...currentHistory].slice(0, 50);
            const updateData = {
                loginCount: newLoginCount,
                leadType: updatedLeadType,
                source: 'BroomBoom App',
                loginHistory: updatedHistory,
                updatedAt: new Date()
            };

            if (cleanName && (!user.name || user.name === 'New User')) {
                updateData.name = cleanName;
            }

            if (!user.email) {
                const emailOwner = await prisma.users.findFirst({
                    where: {
                        email: { equals: cleanEmail, mode: 'insensitive' }
                    }
                });
                if (!emailOwner || emailOwner.id === user.id) {
                    updateData.email = cleanEmail;
                }
            }

            if (normalizedPhone && (user.phone.startsWith('intl_') || user.phone !== normalizedPhone)) {
                const phoneOwner = await prisma.users.findUnique({
                    where: { phone: normalizedPhone }
                });
                if (!phoneOwner || phoneOwner.id === user.id) {
                    updateData.phone = normalizedPhone;
                }
            }

            user = await prisma.users.update({
                where: { id: user.id },
                data: updateData
            });
        }

        const token = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET || 'secret123',
            { expiresIn: '30d' }
        );

        const responsePhone = user.phone && !user.phone.startsWith('intl_')
            ? user.phone
            : (normalizedPhone || '');

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email || cleanEmail,
                phone: responsePhone,
                status: user.status,
                countryCode: cleanCountryCode || null,
                authProvider: cleanProvider
            }
        });
    } catch (error) {
        console.error('International login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Unable to complete login. Please try again.'
        });
    }
};
