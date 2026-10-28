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

        // Build search conditions to find if this user already exists
        // Match 10-digit phone, +91+10digit, +91 10digit, or exact phone
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

        let existingUser = await User.findOne({
            where: {
                [Op.or]: orConditions
            }
        });

        if (existingUser) {
            // Existing user logged in again!
            const newLoginCount = (existingUser.loginCount || 1) + 1;
            const updates = {
                loginCount: newLoginCount,
                updatedAt: new Date(),
                status: 'Active'
            };

            // Upgrade leadType to Existing if not already Loyal
            if ((existingUser.leadType || '').toLowerCase() !== 'loyal') {
                updates.leadType = 'Existing';
            }

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
        const user = await User.create({
            name: rawName || `User ${tenDigitPhone ? tenDigitPhone.slice(-4) : 'Guest'}`,
            phone: tenDigitPhone || rawPhone,
            email: rawEmail || null,
            status: req.body.status || 'Active',
            loginCount: 1,
            leadType: req.body.leadType || 'New',
            registeredAt: new Date()
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
