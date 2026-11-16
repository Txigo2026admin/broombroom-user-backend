const { Op } = require('sequelize');
const User = require('../models/User');

// Helper to normalize Indian phone number into 10 digits
const extract10DigitPhone = (phoneStr) => {
    if (!phoneStr) return '';
    const digits = String(phoneStr).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
};

// @desc    Get all users / leads
// @route   GET /api/users
exports.getUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            order: [
                ['updatedAt', 'DESC'],
                ['registeredAt', 'DESC']
            ]
        });
        res.status(200).json(users);
    } catch (error) {
        console.error('getUsers error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create or Sync (Login) User Lead
// @route   POST /api/users
exports.createUser = async (req, res) => {
    try {
        const rawPhone = String(req.body.phone || '').trim();
        const rawEmail = req.body.email && String(req.body.email).trim() ? String(req.body.email).trim().toLowerCase() : null;
        const rawName = req.body.name ? String(req.body.name).trim() : '';
        const tenDigitPhone = extract10DigitPhone(rawPhone);

        if (!tenDigitPhone && !rawPhone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const loginSource = req.body.source || 'BroomBoom Web';
        const currentLoginTime = req.body.lastLoginAt || new Date().toISOString();

        // Check if incoming request is a Pilot or Cab Attachment lead
        const isPilotOrCab = (req.body.leadType || '').toLowerCase().includes('driver') ||
            (req.body.leadType || '').toLowerCase().includes('pilot') ||
            (req.body.leadType || '').toLowerCase().includes('attach') ||
            loginSource.toLowerCase().includes('driver') ||
            loginSource.toLowerCase().includes('attachment');

        // All the time a pilot or cab attachment lead is sent, ALWAYS create a separate lead entry!
        // Do NOT update/overwrite previous submissions: same phone number can have multiple leads
        // each with its own vehicle selection, city, and exact date & time.
        if (isPilotOrCab) {
            try {
                const user = await User.create({
                    name: rawName || `${(req.body.leadType || '').includes('driver') ? 'Pilot' : 'Cab Attachment'} Applicant (${req.body.city || 'General'})`,
                    phone: tenDigitPhone || rawPhone,
                    email: rawEmail || null,
                    status: req.body.status || 'New',
                    loginCount: 1,
                    leadType: req.body.leadType || 'New',
                    source: loginSource,
                    city: req.body.city || null,
                    state: req.body.state || null,
                    vehicleType: req.body.vehicleType || null,
                    carNo: req.body.carNo || null,
                    licenseNo: req.body.licenseNo || null,
                    notes: req.body.notes || null,
                    registeredAt: req.body.lastLoginAt ? new Date(req.body.lastLoginAt) : new Date(),
                    lastLoginAt: req.body.lastLoginAt ? new Date(req.body.lastLoginAt) : new Date(),
                    loginHistory: [{
                        id: require('crypto').randomUUID(),
                        source: loginSource,
                        loginTime: currentLoginTime,
                        leadType: req.body.leadType,
                        city: req.body.city,
                        vehicleType: req.body.vehicleType,
                    }]
                });
                return res.status(201).json(user);
            } catch (createErr) {
                console.warn('User.create failed for pilot/cab lead, falling back to update existing user lead:', createErr.message);
                const phoneVariants = [
                    rawPhone,
                    tenDigitPhone,
                    tenDigitPhone ? `+91${tenDigitPhone}` : null,
                    tenDigitPhone ? `+91 ${tenDigitPhone}` : null
                ].filter(Boolean);

                let existingUser = await User.findOne({
                    where: {
                        phone: { [Op.in]: phoneVariants }
                    }
                });

                if (existingUser) {
                    let currentHistory = [];
                    try {
                        currentHistory = Array.isArray(existingUser.loginHistory) 
                            ? existingUser.loginHistory 
                            : JSON.parse(existingUser.loginHistory || '[]');
                    } catch (e) {
                        currentHistory = [];
                    }

                    const leadEntry = {
                        id: require('crypto').randomUUID(),
                        source: loginSource,
                        loginTime: currentLoginTime,
                        leadType: req.body.leadType || existingUser.leadType,
                        city: req.body.city || existingUser.city,
                        vehicleType: req.body.vehicleType || existingUser.vehicleType,
                    };

                    await existingUser.update({
                        name: rawName || existingUser.name,
                        status: 'New',
                        leadType: req.body.leadType || existingUser.leadType || 'Pilot',
                        source: loginSource,
                        city: req.body.city || existingUser.city,
                        state: req.body.state || existingUser.state,
                        vehicleType: req.body.vehicleType || existingUser.vehicleType,
                        carNo: req.body.carNo || existingUser.carNo,
                        licenseNo: req.body.licenseNo || existingUser.licenseNo,
                        notes: req.body.notes || existingUser.notes,
                        updatedAt: new Date(),
                        lastLoginAt: new Date(currentLoginTime),
                        loginHistory: [leadEntry, ...currentHistory].slice(0, 50)
                    });

                    return res.status(200).json(existingUser);
                } else {
                    throw createErr;
                }
            }
        }

        // For regular customer accounts: match by phone and update login count & history
        const phoneVariants = [
            rawPhone,
            tenDigitPhone,
            tenDigitPhone ? `+91${tenDigitPhone}` : null,
            tenDigitPhone ? `+91 ${tenDigitPhone}` : null
        ].filter(Boolean);

        const orConditions = [
            { phone: { [Op.in]: phoneVariants } }
        ];

        if (rawEmail && rawEmail.length > 3) {
            orConditions.push({ email: rawEmail });
        }

        let allMatching = await User.findAll({
            where: {
                [Op.or]: orConditions
            },
            order: [['updatedAt', 'DESC']]
        });

        const isApplicant = (u) => {
            const n = (u.name || '').toLowerCase();
            const s = (u.source || '').toLowerCase();
            const lt = (u.leadType || '').toLowerCase();
            return n.includes('applicant') || n.includes('pilot applicant') || n.includes('cab attachment') || lt.startsWith('driver-') || lt.startsWith('cab-attachment') || s.includes('driver job') || s.includes('attachment application');
        };

        // Prefer real customer record over pilot applicant record
        let existingUser = allMatching.find(u => !isApplicant(u));

        if (existingUser) {
            // Existing user logged in again!
            const newLoginCount = (existingUser.loginCount || 1) + 1;

            let currentHistory = [];
            try {
                if (Array.isArray(existingUser.loginHistory)) {
                    currentHistory = existingUser.loginHistory;
                } else if (typeof existingUser.loginHistory === 'string') {
                    currentHistory = JSON.parse(existingUser.loginHistory || '[]');
                }
            } catch (e) {
                currentHistory = [];
            }

            const loginEntry = {
                id: require('crypto').randomUUID(),
                source: loginSource,
                loginTime: currentLoginTime,
                leadType: req.body.leadType || ((existingUser.leadType || '').toLowerCase() === 'loyal' ? 'Loyal' : 'Existing'),
                city: req.body.city || existingUser.city || null,
                vehicleType: req.body.vehicleType || existingUser.vehicleType || null,
            };

            const updatedHistory = [loginEntry, ...currentHistory].slice(0, 50);

            const updates = {
                loginCount: newLoginCount,
                updatedAt: new Date(),
                lastLoginAt: new Date(currentLoginTime),
                status: req.body.status || existingUser.status || 'Active',
                source: loginSource,
                loginHistory: updatedHistory
            };

            // If incoming lead is Pilot or Cab Attachment, keep/update the pilot/attachment leadType
            const isPilotOrCab = (req.body.leadType || '').toLowerCase().includes('driver') ||
                (req.body.leadType || '').toLowerCase().includes('pilot') ||
                (req.body.leadType || '').toLowerCase().includes('attach') ||
                loginSource.toLowerCase().includes('driver') ||
                loginSource.toLowerCase().includes('attachment');

            if (isPilotOrCab && req.body.leadType) {
                updates.leadType = req.body.leadType;
            } else if ((existingUser.leadType || '').toLowerCase() !== 'loyal') {
                updates.leadType = 'Existing';
            }

            if (req.body.city) updates.city = req.body.city;
            if (req.body.state) updates.state = req.body.state;
            if (req.body.vehicleType) updates.vehicleType = req.body.vehicleType;
            if (req.body.carNo) updates.carNo = req.body.carNo;
            if (req.body.licenseNo) updates.licenseNo = req.body.licenseNo;

            // Update name if a more complete name is provided
            if (rawName && (!existingUser.name || existingUser.name.startsWith('User ') || existingUser.name === 'New User' || existingUser.name === 'Customer')) {
                updates.name = rawName;
            }

            // Update email if provided and user had none
            if (rawEmail && !existingUser.email) {
                updates.email = rawEmail;
            }

            await existingUser.update(updates);
            return res.status(200).json(existingUser);
        }

        // User is brand new - create user lead
        const initialLog = [{
            id: require('crypto').randomUUID(),
            source: loginSource,
            loginTime: currentLoginTime,
            leadType: req.body.leadType || 'New'
        }];

        const user = await User.create({
            name: rawName || `User ${tenDigitPhone ? tenDigitPhone.slice(-4) : 'Guest'}`,
            phone: tenDigitPhone || rawPhone,
            email: rawEmail || null,
            status: req.body.status || 'Active',
            loginCount: 1,
            leadType: req.body.leadType || 'New',
            source: loginSource,
            loginHistory: initialLog,
            city: req.body.city || null,
            state: req.body.state || null,
            vehicleType: req.body.vehicleType || null,
            carNo: req.body.carNo || null,
            licenseNo: req.body.licenseNo || null,
            registeredAt: req.body.lastLoginAt ? new Date(req.body.lastLoginAt) : new Date(),
            lastLoginAt: req.body.lastLoginAt ? new Date(req.body.lastLoginAt) : new Date()
        });

        return res.status(201).json(user);
    } catch (error) {
        console.error('Create/Sync user error:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.updateUserStatus = async (req, res) => {
    try {
        const updateData = req.body.$set ? req.body.$set : req.body;
        const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete user lead
// @route   DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        await user.destroy();
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
