const { Op } = require('sequelize');
const Booking = require('../models/Booking');
const { syncToVendorOrders } = require('../services/vendorDispatchBridge');
const mapService = require('../services/mapService');
const User = require('../models/User');
// @desc    Get all bookings
// @route   GET /api/bookings
exports.getBookings = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                message: 'Please login first'
            });
        }

        const user = await User.findByPk(req.user.id);

        if (!user || !user.phone) {
            return res.status(403).json({
                message: 'Registered mobile number not found'
            });
        }

        const digits = String(user.phone).replace(/\D/g, '');

        if (!/^(?:91)?[6-9]\d{9}$/.test(digits)) {
            return res.status(400).json({
                message: 'Invalid registered mobile number'
            });
        }

        const mobile = digits.slice(-10);

        const bookings = await Booking.findAll({
            where: {
                customerMobile: {
                    [Op.in]: [
                        mobile,
                        `91${mobile}`,
                        `+91${mobile}`,
                        `+91 ${mobile}`
                    ]
                }
            },
            order: [['createdAt', 'DESC']]
        });

        return res.status(200).json(bookings);

    } catch (error) {
        console.error('Get bookings error:', error);
        return res.status(500).json({
            message: 'Failed to fetch bookings'
        });
    }
};
// @desc    Create new booking
// @route   POST /api/bookings
exports.createBooking = async (req, res) => {
    try {
        const bookingData = { ...req.body };

        // Determine source reliably (BroomBoom App vs BroomBoom Web)
        const userAgent = (req.headers['user-agent'] || '').toLowerCase();
        const appSourceHeader = req.headers['x-app-source'];
        let detectedSource = req.body.source;
        if (!detectedSource) {
            if (appSourceHeader) {
                detectedSource = appSourceHeader;
            } else if (userAgent.includes('dart') || userAgent.includes('broomboom') || userAgent.includes('flutter')) {
                detectedSource = 'BroomBoom App';
            } else {
                detectedSource = 'BroomBoom Web';
            }
        }
        bookingData.source = detectedSource;

        // Auto infer From & To Cities if missing
        if (!bookingData.fromCity && bookingData.pickupAddress) {
            bookingData.fromCity = bookingData.pickupAddress.split(',')[0].trim();
        }
        if (!bookingData.toCity && bookingData.dropAddress) {
            bookingData.toCity = bookingData.dropAddress.split(',')[0].trim();
        }

        // Auto detect Pet Friendly
        if (
            bookingData.petFriendly ||
            (bookingData.serviceType && bookingData.serviceType.toLowerCase().includes('pet')) ||
            (bookingData.vehicleCategory && bookingData.vehicleCategory.toLowerCase().includes('pet'))
        ) {
            bookingData.petFriendly = true;
            if (!bookingData.petCount || bookingData.petCount < 1) {
                bookingData.petCount = 1;
            }
        }

        // Safe defaults for required database fields
        if (!bookingData.customerName) bookingData.customerName = 'Customer';
        if (!bookingData.customerMobile) {
    return res.status(400).json({
        message: 'Customer mobile number is required'
    });
}
        if (!bookingData.serviceType) bookingData.serviceType = 'Outstation oneway';
        if (!bookingData.state) bookingData.state = 'West Bengal';
        if (!bookingData.pickupDate) bookingData.pickupDate = new Date().toISOString().split('T')[0];
        if (!bookingData.pickupTime) bookingData.pickupTime = '10:00 AM';
        if (!bookingData.vehicleCategory) bookingData.vehicleCategory = 'Sedan';
        if (!bookingData.seater) bookingData.seater = 4;
        if (bookingData.fare === undefined || bookingData.fare === null) bookingData.fare = 0;

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
        if (bookingData.customerMobile) {
            try {
                const User = require('../models/User');
                const rawPhone = String(bookingData.customerMobile).trim();
                const digits = rawPhone.replace(/\D/g, '');
                const tenDigitPhone = digits.length >= 10 ? digits.slice(-10) : digits;
                const rawEmail = bookingData.customerEmail ? String(bookingData.customerEmail).trim().toLowerCase() : null;
                const rawName = bookingData.customerName ? String(bookingData.customerName).trim() : '';

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
                if (existingUser) {
                    await existingUser.update({
                        updatedAt: new Date(),
                        loginCount: (existingUser.loginCount || 1) + 1,
                        source: detectedSource,
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
                        source: detectedSource,
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

// @desc    Get pilots/vendors for booking allocation
// @route   GET /api/bookings/pilots
exports.getPilots = async (req, res) => {
    try {
        const { category = '', pilotType = '', search = '', state = '' } = req.query;
        const pilotsMap = new Map();

        const addPilot = (p) => {
            const name = String(p.pilotName || p.name || '').trim();
            const mobile = String(p.mobile || p.phone || '').trim();
            if (!name && !mobile) return;
            const key = `${mobile || name}`.toLowerCase();
            if (pilotsMap.has(key)) return;
            pilotsMap.set(key, {
                id: String(p.id || mobile || name),
                lowBalance: p.lowBalance || 'No',
                activeStatus: p.activeStatus || 'Active',
                pilotName: name || 'Pilot',
                pilotType: p.pilotType || 'Vendor',
                mobile: mobile || '-',
                vehicleCategory: p.vehicleCategory || 'Sedan',
                status: p.status || 'Available',
                city: p.city || '-',
                state: p.state || '-',
                carNo: p.carNo || '',
            });
        };

        // 1. Try Vendor Database if VENDOR_DATABASE_URL is configured
        if (process.env.VENDOR_DATABASE_URL) {
            try {
                const { getVendorPool } = require('../services/vendorDispatchBridge');
                const pool = getVendorPool();
                const queries = [
                    `SELECT id, vendor_name AS name, vendor_mobile AS mobile, city, state, status, plan_tier AS "pilotType", vehicle_category AS "vehicleCategory" FROM vendor_subscriptions LIMIT 500`,
                    `SELECT id, name, mobile, phone, city, state, status, pilot_type AS "pilotType", vehicle_category AS "vehicleCategory", car_no AS "carNo" FROM pilots LIMIT 500`,
                ];
                for (const sql of queries) {
                    try {
                        const result = await pool.query(sql);
                        if (result && Array.isArray(result.rows)) {
                            result.rows.forEach((row) =>
                                addPilot({
                                    id: row.id,
                                    lowBalance: 'No',
                                    activeStatus: String(row.status || 'Active').toLowerCase() === 'active' ? 'Active' : row.status || 'Active',
                                    pilotName: row.name,
                                    pilotType: row.pilotType || 'Partner',
                                    mobile: row.mobile || row.phone,
                                    vehicleCategory: row.vehicleCategory || 'Sedan',
                                    status: row.status || 'Available',
                                    city: row.city || '-',
                                    state: row.state || '-',
                                    carNo: row.carNo || '',
                                })
                            );
                        }
                    } catch (_) {
                        // Table/column shape may differ across vendor environments; continue gracefully
                    }
                }
            } catch (vendorErr) {
                console.warn('Vendor pilots lookup notice:', vendorErr.message);
            }
        }

        // 2. Enrich / fallback from existing bookings' assigned drivers & eligiblePilots
        try {
            const bookings = await Booking.findAll({
                attributes: ['driverId', 'driverName', 'driverNumber', 'carNo', 'vehicleCategory', 'fromCity', 'pickupAddress', 'eligiblePilots'],
                raw: true,
                limit: 300,
                order: [['createdAt', 'DESC']],
            });

            for (const b of bookings) {
                if (b.driverName || b.driverNumber) {
                    addPilot({
                        id: b.driverId || b.driverNumber || b.driverName,
                        lowBalance: 'No',
                        activeStatus: 'Active',
                        pilotName: b.driverName,
                        pilotType: 'Individual',
                        mobile: b.driverNumber,
                        vehicleCategory: b.vehicleCategory || 'Sedan',
                        status: 'Verified',
                        city: b.fromCity || (b.pickupAddress ? String(b.pickupAddress).split(',')[0].trim() : '-'),
                        state: '',
                        carNo: b.carNo || '',
                    });
                }
                if (Array.isArray(b.eligiblePilots)) {
                    for (const ep of b.eligiblePilots) {
                        if (ep && typeof ep === 'object') {
                            addPilot(ep);
                        }
                    }
                }
            }
        } catch (bkErr) {
            console.warn('Booking pilots fallback notice:', bkErr.message);
        }

        let list = Array.from(pilotsMap.values());

        const catFilter = String(category).trim().toLowerCase();
        const typeFilter = String(pilotType).trim().toLowerCase();
        const searchFilter = String(search).trim().toLowerCase();
        const stateFilter = String(state).trim().toLowerCase();

        if (catFilter && catFilter !== 'all' && catFilter !== 'choose vehicle category') {
            list = list.filter((p) => String(p.vehicleCategory || '').toLowerCase().includes(catFilter));
        }
        if (typeFilter && typeFilter !== 'all' && typeFilter !== 'pilot type') {
            list = list.filter((p) => String(p.pilotType || '').toLowerCase().includes(typeFilter));
        }
        if (stateFilter) {
            list = list.filter((p) =>
                `${p.state || ''} ${p.city || ''}`.toLowerCase().includes(stateFilter)
            );
        }
        if (searchFilter) {
            list = list.filter((p) =>
                `${p.id} ${p.pilotName} ${p.mobile} ${p.city} ${p.state} ${p.vehicleCategory} ${p.carNo}`
                    .toLowerCase()
                    .includes(searchFilter)
            );
        }

        res.status(200).json({ pilots: list, total: list.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
