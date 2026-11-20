const { Op } = require('sequelize');
const Booking = require('../models/Booking');

/**
 * @desc    Get all bookings with full details from the bookings table for Admin
 * @route   GET /api/admin/bookings or GET /api/bookings/admin
 * @access  Admin
 */
exports.getAllBookingsAdmin = async (req, res) => {
    try {
        const { search, status, serviceType, page, limit } = req.query;
        const whereClause = {};

        // Status filter
        if (status && status !== 'all' && status !== 'All') {
            whereClause.status = { [Op.iLike]: `%${status.trim()}%` };
        }

        // Service type filter
        if (serviceType && serviceType !== 'all' && serviceType !== 'All') {
            whereClause.serviceType = { [Op.iLike]: `%${serviceType.trim()}%` };
        }

        // Search query filter (customerName, customerMobile, customerEmail, bookingId, addresses)
        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            whereClause[Op.or] = [
                { bookingId: { [Op.iLike]: term } },
                { customerName: { [Op.iLike]: term } },
                { customerMobile: { [Op.iLike]: term } },
                { customerEmail: { [Op.iLike]: term } },
                { pickupAddress: { [Op.iLike]: term } },
                { dropAddress: { [Op.iLike]: term } },
                { serviceType: { [Op.iLike]: term } },
                { fromCity: { [Op.iLike]: term } },
                { toCity: { [Op.iLike]: term } },
                { vehicleCategory: { [Op.iLike]: term } },
                { driverName: { [Op.iLike]: term } },
                { driverNumber: { [Op.iLike]: term } },
                { carNo: { [Op.iLike]: term } }
            ];
        }

        const queryOptions = {
            where: whereClause,
            order: [['createdAt', 'DESC']]
        };

        if (limit) {
            const parsedLimit = parseInt(limit, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
                queryOptions.limit = parsedLimit;
                if (page) {
                    const parsedPage = parseInt(page, 10);
                    if (!isNaN(parsedPage) && parsedPage > 1) {
                        queryOptions.offset = (parsedPage - 1) * parsedLimit;
                    }
                }
            }
        }

        const bookings = await Booking.findAll(queryOptions);

        console.log(`[Admin Bookings API] Retrieved ${bookings.length} bookings from database`);
        return res.status(200).json(bookings);
    } catch (error) {
        console.error('[Admin Bookings API] Error fetching bookings:', error);
        return res.status(500).json({
            message: 'Failed to fetch bookings from database',
            error: error.message
        });
    }
};

/**
 * @desc    Get single booking by ID or bookingId with all details
 * @route   GET /api/admin/bookings/:id or GET /api/bookings/details/:id
 * @access  Admin
 */
exports.getBookingDetailsAdmin = async (req, res) => {
    try {
        const idParam = (req.params.id || '').trim();
        if (!idParam) {
            return res.status(400).json({ message: 'Booking ID is required' });
        }

        let booking = null;

        // 1. Try finding by UUID primary key if valid UUID format
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);
        if (isUuid) {
            booking = await Booking.findByPk(idParam);
        }

        // 2. Fallback: Search by bookingId (e.g. TX26112934) or id as string
        if (!booking) {
            booking = await Booking.findOne({
                where: {
                    [Op.or]: [
                        { bookingId: idParam },
                        { id: isUuid ? idParam : null }
                    ].filter(Boolean)
                }
            });
        }

        if (!booking) {
            return res.status(404).json({
                message: `Booking with ID '${idParam}' not found in database`
            });
        }

        return res.status(200).json(booking);
    } catch (error) {
        console.error('[Admin Bookings API] Error fetching booking details:', error);
        return res.status(500).json({
            message: 'Failed to fetch booking details',
            error: error.message
        });
    }
};

/**
 * @desc    Create new booking directly from Admin
 * @route   POST /api/admin/bookings
 * @access  Admin
 */
exports.createBookingAdmin = async (req, res) => {
    try {
        const data = { ...req.body };

        if (!data.bookingId) {
            const now = new Date();
            const yr = String(now.getFullYear()).slice(-2);
            const mo = String(now.getMonth() + 1).padStart(2, '0');
            const rand = Math.floor(1000 + Math.random() * 9000);
            data.bookingId = `TX${yr}${mo}${rand}`;
        }

        if (!data.customerName) data.customerName = 'Customer';
        if (!data.serviceType) data.serviceType = 'Outstation oneway';
        if (!data.state) data.state = 'West Bengal';
        if (!data.pickupDate) data.pickupDate = new Date().toISOString().split('T')[0];
        if (!data.pickupTime) data.pickupTime = '10:00 AM';
        if (!data.vehicleCategory) data.vehicleCategory = 'Sedan';
        if (!data.seater) data.seater = 4;
        if (!data.source) data.source = 'Admin Portal';
        if (!data.status) data.status = 'Pending';

        if (!Array.isArray(data.timeline)) {
            data.timeline = [{
                status: data.status,
                message: 'Booking created via Admin Portal',
                timestamp: new Date().toISOString()
            }];
        }

        const newBooking = await Booking.create(data);
        return res.status(201).json(newBooking);
    } catch (error) {
        console.error('[Admin Bookings API] Create booking error:', error);
        return res.status(400).json({
            message: 'Failed to create booking',
            error: error.message
        });
    }
};

/**
 * @desc    Update booking details from Admin (status, driver, fare, notes, etc.)
 * @route   PATCH /api/admin/bookings/:id
 * @access  Admin
 */
exports.updateBookingAdmin = async (req, res) => {
    try {
        const idParam = (req.params.id || '').trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);

        let booking = isUuid ? await Booking.findByPk(idParam) : null;
        if (!booking) {
            booking = await Booking.findOne({
                where: {
                    [Op.or]: [
                        { bookingId: idParam },
                        { id: isUuid ? idParam : null }
                    ].filter(Boolean)
                }
            });
        }

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const updates = { ...req.body };
        delete updates.id; // Protect primary key

        // If status changed, record in timeline
        if (updates.status && updates.status !== booking.status) {
            const currentTimeline = Array.isArray(booking.timeline) ? [...booking.timeline] : [];
            currentTimeline.push({
                status: updates.status,
                message: updates.timelineMessage || `Status updated to ${updates.status} by Admin`,
                timestamp: new Date().toISOString()
            });
            updates.timeline = currentTimeline;
        }

        // Apply updates
        await booking.update(updates);

        return res.status(200).json(booking);
    } catch (error) {
        console.error('[Admin Bookings API] Update error:', error);
        return res.status(400).json({
            message: 'Failed to update booking',
            error: error.message
        });
    }
};

/**
 * @desc    Delete booking by ID
 * @route   DELETE /api/admin/bookings/:id
 * @access  Admin
 */
exports.deleteBookingAdmin = async (req, res) => {
    try {
        const idParam = (req.params.id || '').trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);

        const count = await Booking.destroy({
            where: {
                [Op.or]: [
                    { bookingId: idParam },
                    { id: isUuid ? idParam : null }
                ].filter(Boolean)
            }
        });

        if (count === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        return res.status(200).json({
            success: true,
            message: `Booking ${idParam} deleted successfully`
        });
    } catch (error) {
        console.error('[Admin Bookings API] Delete error:', error);
        return res.status(500).json({
            message: 'Failed to delete booking',
            error: error.message
        });
    }
};

/**
 * @desc    Allocate driver/pilot to booking
 * @route   POST /api/admin/bookings/:id/allocate-pilot
 * @access  Admin
 */
exports.allocatePilotAdmin = async (req, res) => {
    try {
        const idParam = (req.params.id || '').trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);

        let booking = isUuid ? await Booking.findByPk(idParam) : null;
        if (!booking) {
            booking = await Booking.findOne({
                where: {
                    [Op.or]: [
                        { bookingId: idParam },
                        { id: isUuid ? idParam : null }
                    ].filter(Boolean)
                }
            });
        }

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const { pilotId, pilotName, pilotNumber, mobile, carNo, vehicleCategory } = req.body;
        const resolvedDriverName = pilotName || 'Pilot';
        const resolvedDriverNumber = pilotNumber || mobile || '';
        const resolvedCarNo = carNo || '';

        const currentTimeline = Array.isArray(booking.timeline) ? [...booking.timeline] : [];
        currentTimeline.push({
            status: 'Confirmed',
            message: `Pilot assigned: ${resolvedDriverName} (${resolvedDriverNumber}) • Car: ${resolvedCarNo}`,
            timestamp: new Date().toISOString()
        });

        await booking.update({
            driverId: pilotId || null,
            driverName: resolvedDriverName,
            driverNumber: resolvedDriverNumber,
            carNo: resolvedCarNo,
            vehicleCategory: vehicleCategory || booking.vehicleCategory,
            allocateOurPilot: true,
            status: 'Confirmed',
            timeline: currentTimeline
        });

        return res.status(200).json(booking);
    } catch (error) {
        console.error('[Admin Bookings API] Allocate pilot error:', error);
        return res.status(400).json({
            message: 'Failed to allocate pilot to booking',
            error: error.message
        });
    }
};
