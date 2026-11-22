const { Op } = require('sequelize');
const BookingLead = require('../models/BookingLead');

// Helper to clean and normalize 10-digit phone number
const normalizePhone = (phoneStr) => {
    if (!phoneStr) return '';
    const digits = String(phoneStr).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
};

// Generate clean unique human-readable lead ID
const generateLeadId = () => {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    return `BL-${datePart}-${randPart}`;
};

/**
 * @desc    Submit / record a new booking search lead from Hero Search
 * @route   POST /api/booking-leads
 */
exports.createBookingLead = async (req, res) => {
    try {
        const {
            serviceType,
            tripType,
            fromCity,
            toCity,
            pickupAddress,
            dropAddress,
            pickupDate,
            pickupTime,
            returnDate,
            returnTime,
            dropTime,
            hourlyPackage,
            airportMode,
            flightNumber,
            distanceKm,
            durationMinutes,
            customerName,
            customerMobile,
            customerEmail,
            source,
            estimatedFare,
            notes,
            rawSearchParams
        } = req.body;

        if (!fromCity) {
            return res.status(400).json({
                success: false,
                message: 'Pickup location (fromCity) is required for a search lead'
            });
        }

        const resolvedServiceType = serviceType || tripType || 'outstation-oneway';
        const cleanFromCity = String(fromCity).trim();
        const cleanToCity = toCity ? String(toCity).trim() : null;
        const cleanPhone = customerMobile ? normalizePhone(customerMobile) : null;
        const cleanEmail = customerEmail ? String(customerEmail).trim().toLowerCase() : null;

        // Extract client IP and device/User-Agent
        const forwarded = req.headers['x-forwarded-for'];
        const clientIp = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || null);
        const userAgent = req.headers['user-agent'] || null;

        // Deduplication & Lead Linking check:
        // Case 1: If phone is provided, check if an unattached guest lead from this IP and matching route exists in last 15 mins to upgrade it
        // Case 2: If same phone & same route within 60 seconds (rapid re-search), refresh timestamp instead of creating duplicate
        // Case 3: If guest search with same IP & same route within 60 seconds, refresh timestamp
        // For any different route or trip type, ALWAYS create a new distinct lead!
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

        let existingLead = null;

        // Try upgrading an unattached guest lead for this route
        if (cleanPhone && clientIp) {
            existingLead = await BookingLead.findOne({
                where: {
                    customerMobile: null,
                    ipAddress: clientIp,
                    fromCity: cleanFromCity,
                    serviceType: resolvedServiceType,
                    ...(cleanToCity ? { toCity: cleanToCity } : {}),
                    createdAt: { [Op.gte]: fifteenMinsAgo }
                },
                order: [['createdAt', 'DESC']]
            });
        }

        // Check for rapid duplicate submission for the EXACT same route by same phone
        if (!existingLead && cleanPhone) {
            existingLead = await BookingLead.findOne({
                where: {
                    customerMobile: cleanPhone,
                    fromCity: cleanFromCity,
                    serviceType: resolvedServiceType,
                    ...(cleanToCity ? { toCity: cleanToCity } : {}),
                    createdAt: { [Op.gte]: oneMinuteAgo }
                },
                order: [['createdAt', 'DESC']]
            });
        }

        // Check for rapid duplicate submission for the EXACT same route by same guest IP
        if (!existingLead && !cleanPhone && clientIp) {
            existingLead = await BookingLead.findOne({
                where: {
                    customerMobile: null,
                    ipAddress: clientIp,
                    fromCity: cleanFromCity,
                    serviceType: resolvedServiceType,
                    ...(cleanToCity ? { toCity: cleanToCity } : {}),
                    createdAt: { [Op.gte]: oneMinuteAgo }
                },
                order: [['createdAt', 'DESC']]
            });
        }

        if (existingLead) {
            // Update existing lead with latest search params and customer mobile without losing contact info
            await existingLead.update({
                customerMobile: cleanPhone || existingLead.customerMobile,
                customerName: customerName ? String(customerName).trim() : existingLead.customerName,
                customerEmail: cleanEmail || existingLead.customerEmail,
                fromCity: cleanFromCity || existingLead.fromCity,
                toCity: cleanToCity || existingLead.toCity,
                pickupAddress: pickupAddress ? String(pickupAddress).trim() : (existingLead.pickupAddress || cleanFromCity),
                dropAddress: dropAddress ? String(dropAddress).trim() : (existingLead.dropAddress || cleanToCity),
                pickupDate: pickupDate || existingLead.pickupDate,
                pickupTime: pickupTime || existingLead.pickupTime,
                returnDate: returnDate || existingLead.returnDate,
                returnTime: returnTime || existingLead.returnTime,
                hourlyPackage: hourlyPackage || existingLead.hourlyPackage,
                airportMode: airportMode || existingLead.airportMode,
                distanceKm: distanceKm ?? existingLead.distanceKm,
                durationMinutes: durationMinutes ?? existingLead.durationMinutes,
                estimatedFare: estimatedFare ?? existingLead.estimatedFare,
                rawSearchParams: rawSearchParams || req.body || existingLead.rawSearchParams,
                searchedAt: new Date()
            });

            console.log(`[BookingLead] Refreshed existing lead ${existingLead.leadId}: phone=${existingLead.customerMobile}, from="${existingLead.fromCity}" to="${existingLead.toCity || 'Local'}"`);

            return res.status(200).json({
                success: true,
                message: 'Existing booking lead refreshed with contact details',
                data: existingLead
            });
        }

        const newLeadId = generateLeadId();

        const lead = await BookingLead.create({
            leadId: newLeadId,
            serviceType: resolvedServiceType,
            tripType: tripType || resolvedServiceType,
            fromCity: cleanFromCity,
            toCity: cleanToCity,
            pickupAddress: pickupAddress ? String(pickupAddress).trim() : cleanFromCity,
            dropAddress: dropAddress ? String(dropAddress).trim() : cleanToCity,
            pickupDate: pickupDate || new Date().toISOString().split('T')[0],
            pickupTime: pickupTime || '10:00 AM',
            returnDate: returnDate || null,
            returnTime: returnTime || dropTime || null,
            dropTime: dropTime || null,
            hourlyPackage: hourlyPackage || null,
            airportMode: airportMode || null,
            flightNumber: flightNumber ? String(flightNumber).trim() : null,
            distanceKm: distanceKm ? Number(distanceKm) : null,
            durationMinutes: durationMinutes ? Number(durationMinutes) : null,
            customerName: customerName ? String(customerName).trim() : null,
            customerMobile: cleanPhone || null,
            customerEmail: cleanEmail || null,
            status: 'New Search',
            source: source || 'Hero Search',
            ipAddress: clientIp,
            userAgent: userAgent ? userAgent.slice(0, 500) : null,
            estimatedFare: estimatedFare ? Number(estimatedFare) : null,
            notes: notes || null,
            rawSearchParams: rawSearchParams || req.body,
            searchedAt: new Date()
        });

        console.log(`[BookingLead] Captured search lead ${lead.leadId}: ${lead.serviceType} from "${lead.fromCity}" to "${lead.toCity || 'Local'}"`);

        return res.status(201).json({
            success: true,
            message: 'Booking lead recorded successfully',
            data: lead
        });
    } catch (error) {
        console.error('createBookingLead error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to record booking lead'
        });
    }
};

/**
 * @desc    Get all booking search leads with filters & search
 * @route   GET /api/booking-leads
 */
exports.getBookingLeads = async (req, res) => {
    try {
        const { status, serviceType, search, limit, page, sortBy } = req.query;
        const whereConditions = {};

        // Status filter
        if (status && status !== 'ALL' && status !== 'all') {
            whereConditions.status = { [Op.iLike]: status };
        }

        // Service Type filter
        if (serviceType && serviceType !== 'ALL' && serviceType !== 'all') {
            whereConditions.serviceType = { [Op.iLike]: `%${serviceType}%` };
        }

        // Global keyword search
        if (search && search.trim()) {
            const q = `%${search.trim()}%`;
            whereConditions[Op.or] = [
                { leadId: { [Op.iLike]: q } },
                { fromCity: { [Op.iLike]: q } },
                { toCity: { [Op.iLike]: q } },
                { pickupAddress: { [Op.iLike]: q } },
                { dropAddress: { [Op.iLike]: q } },
                { customerName: { [Op.iLike]: q } },
                { customerMobile: { [Op.iLike]: q } },
                { serviceType: { [Op.iLike]: q } },
                { hourlyPackage: { [Op.iLike]: q } }
            ];
        }

        const pageSize = limit ? parseInt(limit, 10) : 500;
        const pageNum = page ? parseInt(page, 10) : 1;
        const offset = (pageNum - 1) * pageSize;

        const orderDirection = sortBy === 'oldest' ? 'ASC' : 'DESC';

        const { count, rows } = await BookingLead.findAndCountAll({
            where: whereConditions,
            order: [
                ['searchedAt', orderDirection],
                ['createdAt', orderDirection]
            ],
            limit: pageSize,
            offset: offset
        });

        return res.status(200).json({
            success: true,
            count: rows.length,
            total: count,
            page: pageNum,
            pages: Math.ceil(count / pageSize),
            data: rows
        });
    } catch (error) {
        console.error('getBookingLeads error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch booking leads'
        });
    }
};

// Helper to safely match ID or leadId without PostgreSQL UUID syntax errors
const buildIdWhere = (id) => {
    if (!id) return { id: null };
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id));
    return isUuid ? { [Op.or]: [{ id }, { leadId: String(id) }] } : { leadId: String(id) };
};

/**
 * @desc    Get single booking lead by ID or LeadId
 * @route   GET /api/booking-leads/:id
 */
exports.getBookingLeadById = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await BookingLead.findOne({
            where: buildIdWhere(id)
        });

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Booking lead not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: lead
        });
    } catch (error) {
        console.error('getBookingLeadById error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch booking lead'
        });
    }
};

/**
 * @desc    Update booking lead status or details
 * @route   PATCH /api/booking-leads/:id
 */
exports.updateBookingLead = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const lead = await BookingLead.findOne({
            where: buildIdWhere(id)
        });

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Booking lead not found'
            });
        }

        await lead.update(updates);

        return res.status(200).json({
            success: true,
            message: 'Booking lead updated successfully',
            data: lead
        });
    } catch (error) {
        console.error('updateBookingLead error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update booking lead'
        });
    }
};

/**
 * @desc    Delete booking lead
 * @route   DELETE /api/booking-leads/:id
 */
exports.deleteBookingLead = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await BookingLead.findOne({
            where: buildIdWhere(id)
        });

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Booking lead not found'
            });
        }

        await lead.destroy();

        return res.status(200).json({
            success: true,
            message: 'Booking lead deleted successfully'
        });
    } catch (error) {
        console.error('deleteBookingLead error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete booking lead'
        });
    }
};
