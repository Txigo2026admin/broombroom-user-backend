const { Op } = require('sequelize');
const Booking = require('../models/Booking');
const { syncToVendorOrders } = require('../services/vendorDispatchBridge');
const mapService = require('../services/mapService');

// @desc    Get all bookings
// @route   GET /api/bookings
exports.getBookings = async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new booking
// @route   POST /api/bookings
exports.createBooking = async (req, res) => {
    try {
        const bookingData = { ...req.body };

        // Ensure pickup coordinates are resolved and stored
        if ((!bookingData.pickupLat || !bookingData.pickupLng) && bookingData.pickupAddress) {
            try {
                const geo = await mapService.getCoordinates(bookingData.pickupAddress);
                if (geo && geo.lat != null && geo.lng != null) {
                    bookingData.pickupLat = String(geo.lat);
                    bookingData.pickupLng = String(geo.lng);
                }
            } catch (_) {}
        }

        // Ensure drop coordinates are resolved and stored
        if ((!bookingData.dropLat || !bookingData.dropLng) && bookingData.dropAddress) {
            try {
                const geo = await mapService.getCoordinates(bookingData.dropAddress);
                if (geo && geo.lat != null && geo.lng != null) {
                    bookingData.dropLat = String(geo.lat);
                    bookingData.dropLng = String(geo.lng);
                }
            } catch (_) {}
        }

        // Auto-cache pickup & drop places with coordinates into cities table
        if (bookingData.pickupAddress && bookingData.pickupLat && bookingData.pickupLng) {
            try {
                await mapService.saveOrUpdateCity({
                    name: bookingData.pickupAddress.split(',')[0].trim(),
                    displayName: bookingData.pickupAddress,
                    lat: bookingData.pickupLat,
                    lon: bookingData.pickupLng,
                    state: bookingData.state || ''
                });
            } catch (_) {}
        }

        if (bookingData.dropAddress && bookingData.dropLat && bookingData.dropLng) {
            try {
                await mapService.saveOrUpdateCity({
                    name: bookingData.dropAddress.split(',')[0].trim(),
                    displayName: bookingData.dropAddress,
                    lat: bookingData.dropLat,
                    lon: bookingData.dropLng,
                    state: bookingData.state || ''
                });
            } catch (_) {}
        }

        const booking = await Booking.create(bookingData);

        // Auto-sync customer as a User Lead in `users` table
        if (req.body.customerMobile) {
            try {
                const User = require('../models/User');
                const rawPhone = String(req.body.customerMobile).trim();
                const digits = rawPhone.replace(/\D/g, '');
                const tenDigitPhone = digits.length >= 10 ? digits.slice(-10) : digits;
                const rawEmail = req.body.customerEmail ? String(req.body.customerEmail).trim().toLowerCase() : null;
                const rawName = req.body.customerName ? String(req.body.customerName).trim() : '';

                const phoneVariants = [
                    rawPhone,
                    tenDigitPhone,
                    tenDigitPhone ? `+91${tenDigitPhone}` : null,
                    tenDigitPhone ? `+91 ${tenDigitPhone}` : null
                ].filter(Boolean);

                const orConditions = [{ phone: { [Op.in]: phoneVariants } }];
                if (rawEmail && rawEmail.length > 3) {
                    orConditions.push({ email: rawEmail });
                }

                let existingUser = await User.findOne({ where: { [Op.or]: orConditions } });
                const bookingSource = req.body.source || (req.headers['user-agent']?.toLowerCase().includes('dart') ? 'BroomBoom App' : 'BroomBoom Web');
                if (existingUser) {
                    await existingUser.update({
                        updatedAt: new Date(),
                        loginCount: (existingUser.loginCount || 1) + 1,
                        source: bookingSource,
                        name: rawName && (!existingUser.name || existingUser.name === 'New User' || existingUser.name.startsWith('User ')) ? rawName : existingUser.name
                    });
                } else {
                    await User.create({
                        name: rawName || `User ${tenDigitPhone ? tenDigitPhone.slice(-4) : 'Guest'}`,
                        phone: tenDigitPhone || rawPhone,
                        email: rawEmail || null,
                        status: 'Active',
                        loginCount: 1,
                        leadType: 'New',
                        source: bookingSource,
                        registeredAt: new Date()
                    });
                }
            } catch (syncErr) {
                console.warn('Booking lead auto-sync notice:', syncErr.message);
            }
        }

        // Auto-sync booking to Vendor Portal & Database Pincode-Wise & Plan-Wise
        try {
            await syncToVendorOrders(req.body, req.headers);
        } catch (vendorSyncErr) {
            console.warn('[VENDOR SYNC EXCEPTION NOTICE]:', vendorSyncErr.message);
        }

        res.status(201).json(booking);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update booking (status or general fields)
// @route   PATCH /api/bookings/:id
exports.updateBookingStatus = async (req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(
            req.params.id, 
            { $set: req.body }, 
            { new: true, runValidators: true }
        );
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        res.status(200).json(booking);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Calculate estimated fare
// @route   POST /api/bookings/calculate-fare
exports.calculateFare = async (req, res) => {
    try {
        const pricingService = require('../services/pricingService');
        
        // Map fields from request to pricing service parameter format
        const params = {
            rideType: req.body.rideType || req.body.serviceType || 'Oneway',
            sourceCity: req.body.city || req.body.sourceCity || req.body.pickupAddress,
            destinationCity: req.body.destinationCity || req.body.dropAddress,
            pickupLat: req.body.pickupLat,
            pickupLng: req.body.pickupLng,
            dropLat: req.body.dropLat,
            dropLng: req.body.dropLng,
            category: req.body.category || req.body.vehicleCategory,
            distance: req.body.distance,
            days: req.body.days || 1,
            state: req.body.state,
            acType: req.body.acType || 'AC',
            seater: req.body.seater,
            pickupDate: req.body.pickupDate,
            pickupTime: req.body.pickupTime,
            returnDate: req.body.returnDate,
            returnTime: req.body.returnTime,
            packageHours: req.body.packageHours,
            includedKms: req.body.includedKms
        };

        const result = await pricingService.calculatePrice(params);

        if (result.success) {
            res.status(200).json({
                baseFare: result.details.baseFare || 0,
                perKmRate: result.details.ratePerKm || 0,
                distance: result.distance || parseFloat(req.body.distance || 0),
                multiplier: result.multiplier,
                totalFare: result.fare,
                fare: result.fare,
                advance: result.advance,
                dueFare: result.dueFare,
                details: result.details,
                appliedRule: result.appliedRule,
                success: true
            });
        } else {
            res.status(200).json({
                success: false,
                message: result.message,
                totalFare: 0,
                fare: 0,
                advance: 0,
                dueFare: 0
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
