const Booking = require('../models/Booking');

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
        const booking = await Booking.create(req.body);
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
                distance: parseFloat(req.body.distance || 0),
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

