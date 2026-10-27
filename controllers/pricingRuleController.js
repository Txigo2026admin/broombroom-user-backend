const StatePricing = require('../models/StatePricing');
const RoutePricing = require('../models/RoutePricing');
const RentalPackage = require('../models/RentalPackage');
const PricingRule = require('../models/PricingRule');
const AirportPricing = require('../models/AirportPricing');
const pricingService = require('../services/pricingService');
const mapService = require('../services/mapService');

// @desc    Calculate Price
// @route   POST /api/pricing-rules/calculate
exports.calculatePrice = async (req, res) => {
    try {
        const result = await pricingService.calculatePrice(req.body);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Calculate distance via Map API (OSRM / Nominatim)
// @route   POST /api/pricing-rules/distance
exports.calculateDistance = async (req, res) => {
    try {
        const { from, to, pickupLat, pickupLng, dropLat, dropLng } = req.body;
        const result = await mapService.calculateDistanceBetween({
            from,
            to,
            pickupLat,
            pickupLng,
            dropLat,
            dropLng
        });
        res.status(200).json({
            success: true,
            distance: result.distanceKm,
            durationMinutes: result.durationMinutes,
            source: result.source,
            pickupCoords: result.pickupCoords,
            dropCoords: result.dropCoords,
            pickupAddress: result.pickupAddress,
            dropAddress: result.dropAddress
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// ROUTE-SPECIFIC PRICING CRUD
// ==========================================

// @desc    Get all route-specific pricing rules
// @route   GET /api/pricing-rules/route
exports.getRouteRules = async (req, res) => {
    try {
        const rules = await RoutePricing.find().sort({ createdAt: -1 });
        res.status(200).json(rules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new route-specific pricing rule
// @route   POST /api/pricing-rules/route
exports.createRouteRule = async (req, res) => {
    try {
        const rule = await RoutePricing.create(req.body);
        res.status(201).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update route-specific pricing rule
// @route   PUT /api/pricing-rules/route/:id
exports.updateRouteRule = async (req, res) => {
    try {
        const rule = await RoutePricing.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!rule) return res.status(404).json({ message: 'Route rule not found' });
        res.status(200).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete route-specific pricing rule
// @route   DELETE /api/pricing-rules/route/:id
exports.deleteRouteRule = async (req, res) => {
    try {
        const rule = await RoutePricing.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ message: 'Route rule not found' });
        res.status(200).json({ message: 'Route rule deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// ==========================================
// RENTAL PACKAGE PRICING CRUD
// ==========================================

// @desc    Get all rental package rules
// @route   GET /api/pricing-rules/rental
exports.getRentalRules = async (req, res) => {
    try {
        const rules = await RentalPackage.find().sort({ createdAt: -1 });
        res.status(200).json(rules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new rental package rule
// @route   POST /api/pricing-rules/rental
exports.createRentalRule = async (req, res) => {
    try {
        const rule = await RentalPackage.create(req.body);
        res.status(201).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update rental package rule
// @route   PUT /api/pricing-rules/rental/:id
exports.updateRentalRule = async (req, res) => {
    try {
        const rule = await RentalPackage.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!rule) return res.status(404).json({ message: 'Rental package not found' });
        res.status(200).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete rental package rule
// @route   DELETE /api/pricing-rules/rental/:id
exports.deleteRentalRule = async (req, res) => {
    try {
        const rule = await RentalPackage.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ message: 'Rental package not found' });
        res.status(200).json({ message: 'Rental package deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// ==========================================
// LEGACY PRICING RULE CRUD (Backward Compatibility)
// ==========================================

// @desc    Get all legacy pricing rules
// @route   GET /api/pricing-rules
exports.getPricingRules = async (req, res) => {
    try {
        const rules = await PricingRule.find().sort({ createdAt: -1 });
        res.status(200).json(rules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new legacy pricing rule
// @route   POST /api/pricing-rules
exports.createPricingRule = async (req, res) => {
    try {
        const rule = await PricingRule.create(req.body);
        res.status(201).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update legacy pricing rule
// @route   PUT /api/pricing-rules/:id
exports.updatePricingRule = async (req, res) => {
    try {
        const rule = await PricingRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!rule) return res.status(404).json({ message: 'Rule not found' });
        res.status(200).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete legacy pricing rule
// @route   DELETE /api/pricing-rules/:id
exports.deletePricingRule = async (req, res) => {
    try {
        const rule = await PricingRule.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ message: 'Rule not found' });
        res.status(200).json({ message: 'Rule deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


// ==========================================
// AIRPORT PRICING CRUD (City-wise, 0-15 km base, 15-25 km tier, >25 km outstation redirect, waiting, night allowance, threshold)
// ==========================================

const DEFAULT_AIRPORT_SEEDS = [
    // Default / All Cities Fallback Rules
    { city: 'Default', carCategory: 'Sedan', baseKms: 15, baseFare: 750, fare15to25: 1050, maxAirportKms: 25, extraKmRate: 16, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 250, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Default', carCategory: 'Hatchback', baseKms: 15, baseFare: 650, fare15to25: 950, maxAirportKms: 25, extraKmRate: 14, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 200, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Default', carCategory: 'SUV', baseKms: 15, baseFare: 1050, fare15to25: 1450, maxAirportKms: 25, extraKmRate: 20, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 200, waitingFreeMins: 60, nightAllowance: 300, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Default', carCategory: 'SUV+', baseKms: 15, baseFare: 1350, fare15to25: 1850, maxAirportKms: 25, extraKmRate: 24, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 250, waitingFreeMins: 60, nightAllowance: 350, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Default', carCategory: '13 Seater Traveller', baseKms: 15, baseFare: 2500, fare15to25: 3400, maxAirportKms: 25, extraKmRate: 35, advanceAmount: 1000, advanceType: 'Fixed', advanceValue: 1000, waitingChargePerHour: 350, waitingFreeMins: 60, nightAllowance: 450, nightStartHour: 23, nightEndHour: 6, threshold: 1000, status: 'Active' },
    { city: 'Default', carCategory: '17 Seater Traveller', baseKms: 15, baseFare: 3000, fare15to25: 4100, maxAirportKms: 25, extraKmRate: 40, advanceAmount: 1000, advanceType: 'Fixed', advanceValue: 1000, waitingChargePerHour: 400, waitingFreeMins: 60, nightAllowance: 500, nightStartHour: 23, nightEndHour: 6, threshold: 1000, status: 'Active' },
    { city: 'Default', carCategory: '25 Seater Traveller', baseKms: 15, baseFare: 3800, fare15to25: 5200, maxAirportKms: 25, extraKmRate: 48, advanceAmount: 1500, advanceType: 'Fixed', advanceValue: 1500, waitingChargePerHour: 500, waitingFreeMins: 60, nightAllowance: 600, nightStartHour: 23, nightEndHour: 6, threshold: 1500, status: 'Active' },

    // Mumbai City-wise Airport Pricing
    { city: 'Mumbai', carCategory: 'Sedan', baseKms: 15, baseFare: 850, fare15to25: 1200, maxAirportKms: 25, extraKmRate: 18, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 250, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Mumbai', carCategory: 'Hatchback', baseKms: 15, baseFare: 750, fare15to25: 1050, maxAirportKms: 25, extraKmRate: 15, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 200, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Mumbai', carCategory: 'SUV', baseKms: 15, baseFare: 1250, fare15to25: 1650, maxAirportKms: 25, extraKmRate: 22, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 200, waitingFreeMins: 60, nightAllowance: 300, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Mumbai', carCategory: 'SUV+', baseKms: 15, baseFare: 1550, fare15to25: 2100, maxAirportKms: 25, extraKmRate: 26, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 250, waitingFreeMins: 60, nightAllowance: 350, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },

    // Kolkata City-wise Airport Pricing
    { city: 'Kolkata', carCategory: 'Sedan', baseKms: 15, baseFare: 750, fare15to25: 1050, maxAirportKms: 25, extraKmRate: 16, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 250, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Kolkata', carCategory: 'Hatchback', baseKms: 15, baseFare: 650, fare15to25: 950, maxAirportKms: 25, extraKmRate: 14, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 200, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Kolkata', carCategory: 'SUV', baseKms: 15, baseFare: 1050, fare15to25: 1450, maxAirportKms: 25, extraKmRate: 20, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 200, waitingFreeMins: 60, nightAllowance: 300, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Kolkata', carCategory: 'SUV+', baseKms: 15, baseFare: 1350, fare15to25: 1850, maxAirportKms: 25, extraKmRate: 24, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 250, waitingFreeMins: 60, nightAllowance: 350, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },

    // Delhi City-wise Airport Pricing
    { city: 'Delhi', carCategory: 'Sedan', baseKms: 15, baseFare: 800, fare15to25: 1150, maxAirportKms: 25, extraKmRate: 17, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 250, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Delhi', carCategory: 'Hatchback', baseKms: 15, baseFare: 700, fare15to25: 1000, maxAirportKms: 25, extraKmRate: 15, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 200, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Delhi', carCategory: 'SUV', baseKms: 15, baseFare: 1150, fare15to25: 1550, maxAirportKms: 25, extraKmRate: 21, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 200, waitingFreeMins: 60, nightAllowance: 300, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' },
    { city: 'Delhi', carCategory: 'SUV+', baseKms: 15, baseFare: 1450, fare15to25: 1950, maxAirportKms: 25, extraKmRate: 25, advanceAmount: 500, advanceType: 'Fixed', advanceValue: 500, waitingChargePerHour: 250, waitingFreeMins: 60, nightAllowance: 350, nightStartHour: 23, nightEndHour: 6, threshold: 500, status: 'Active' }
];

async function ensureAirportSeeds() {
    try {
        for (const item of DEFAULT_AIRPORT_SEEDS) {
            const existing = await AirportPricing.findOne({
                city: { $regex: new RegExp('^' + item.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
                carCategory: { $regex: new RegExp('^' + item.carCategory.replace('+', '\\+') + '$', 'i') }
            });
            if (!existing) {
                await AirportPricing.create(item);
            }
        }
    } catch (e) {
        console.warn('[Pricing] Airport pricing seeding notice:', e.message);
    }
}

// @desc    Get all airport pricing rules
// @route   GET /api/pricing-rules/airport
exports.getAirportRules = async (req, res) => {
    try {
        await ensureAirportSeeds();
        const filter = {};
        if (req.query.city) {
            filter.city = { $regex: new RegExp('^' + req.query.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
        }
        if (req.query.carCategory) {
            filter.carCategory = { $regex: new RegExp('^' + req.query.carCategory.trim().replace('+', '\\+') + '$', 'i') };
        }
        const rules = await AirportPricing.find(filter).sort({ createdAt: -1 });
        res.status(200).json(rules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create or update airport pricing rule (City-wise)
// @route   POST /api/pricing-rules/airport
exports.createAirportRule = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.fare0to15 != null && data.baseFare == null) {
            data.baseFare = data.fare0to15;
        }
        if (data.city) data.city = data.city.trim();
        if (data.carCategory) data.carCategory = data.carCategory.trim();

        // Check if a rule for this city and carCategory already exists -> update it (upsert)
        if (data.city && data.carCategory) {
            const existing = await AirportPricing.findOne({
                city: { $regex: new RegExp('^' + data.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
                carCategory: { $regex: new RegExp('^' + data.carCategory.replace('+', '\\+') + '$', 'i') }
            });
            if (existing) {
                const updated = await AirportPricing.findByIdAndUpdate(existing.id || existing._id, data, { new: true });
                return res.status(200).json(updated);
            }
        }

        const rule = await AirportPricing.create(data);
        res.status(201).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update airport pricing rule
// @route   PUT /api/pricing-rules/airport/:id
exports.updateAirportRule = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.fare0to15 != null && data.baseFare == null) {
            data.baseFare = data.fare0to15;
        }
        if (data.city) data.city = data.city.trim();
        if (data.carCategory) data.carCategory = data.carCategory.trim();

        const rule = await AirportPricing.findByIdAndUpdate(req.params.id, data, { new: true });
        if (!rule) return res.status(404).json({ message: 'Airport pricing rule not found' });
        res.status(200).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete airport pricing rule
// @route   DELETE /api/pricing-rules/airport/:id
exports.deleteAirportRule = async (req, res) => {
    try {
        const rule = await AirportPricing.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ message: 'Airport pricing rule not found' });
        res.status(200).json({ message: 'Airport pricing rule deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// ==========================================
// OUTSTATION / STATE-WISE GENERAL PRICING CRUD (City-wise, Slabs, Decimal Rate, Threshold)
// ==========================================

const DEFAULT_OUTSTATION_SEEDS = [
    { city: 'Default', state: 'Default', rideCategory: 'Oneway', carCategory: 'Sedan', seater: 4, ratePerKm: 10.2, extraKmRate: 12, threshold: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 250, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Oneway', carCategory: 'Hatchback', seater: 4, ratePerKm: 9.5, extraKmRate: 11, threshold: 500, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 200, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Oneway', carCategory: 'SUV', seater: 6, ratePerKm: 14.5, extraKmRate: 16, threshold: 700, waitingChargePerHour: 200, waitingFreeMins: 60, nightAllowance: 300, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Oneway', carCategory: 'SUV+', seater: 7, ratePerKm: 18.0, extraKmRate: 20, threshold: 800, waitingChargePerHour: 250, waitingFreeMins: 60, nightAllowance: 350, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Oneway', carCategory: '13 Seater Traveller', seater: 13, ratePerKm: 28.0, extraKmRate: 30, threshold: 1200, waitingChargePerHour: 350, waitingFreeMins: 60, nightAllowance: 450, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Oneway', carCategory: '17 Seater Traveller', seater: 17, ratePerKm: 34.0, extraKmRate: 36, threshold: 1500, waitingChargePerHour: 400, waitingFreeMins: 60, nightAllowance: 500, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Oneway', carCategory: '25 Seater Traveller', seater: 25, ratePerKm: 42.0, extraKmRate: 45, threshold: 2000, waitingChargePerHour: 500, waitingFreeMins: 60, nightAllowance: 600, nightStartHour: 23, nightEndHour: 6, status: 'Active' },

    // Roundtrip Default Seeds (Threshold 1000, HourlyRate 100-150)
    { city: 'Default', state: 'Default', rideCategory: 'Roundtrip', carCategory: 'Sedan', seater: 4, ratePerKm: 12.0, extraKmRate: 14.0, hourlyRate: 100, threshold: 1000, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 250, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Roundtrip', carCategory: 'Hatchback', seater: 4, ratePerKm: 11.0, extraKmRate: 13.0, hourlyRate: 100, threshold: 1000, waitingChargePerHour: 150, waitingFreeMins: 60, nightAllowance: 200, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Roundtrip', carCategory: 'SUV', seater: 6, ratePerKm: 16.0, extraKmRate: 18.0, hourlyRate: 150, threshold: 1200, waitingChargePerHour: 200, waitingFreeMins: 60, nightAllowance: 300, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Roundtrip', carCategory: 'SUV+', seater: 7, ratePerKm: 19.0, extraKmRate: 21.0, hourlyRate: 180, threshold: 1400, waitingChargePerHour: 250, waitingFreeMins: 60, nightAllowance: 350, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Roundtrip', carCategory: '13 Seater Traveller', seater: 13, ratePerKm: 30.0, extraKmRate: 32.0, hourlyRate: 250, threshold: 1800, waitingChargePerHour: 350, waitingFreeMins: 60, nightAllowance: 450, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Roundtrip', carCategory: '17 Seater Traveller', seater: 17, ratePerKm: 36.0, extraKmRate: 38.0, hourlyRate: 300, threshold: 2200, waitingChargePerHour: 400, waitingFreeMins: 60, nightAllowance: 500, nightStartHour: 23, nightEndHour: 6, status: 'Active' },
    { city: 'Default', state: 'Default', rideCategory: 'Roundtrip', carCategory: '25 Seater Traveller', seater: 25, ratePerKm: 45.0, extraKmRate: 48.0, hourlyRate: 350, threshold: 2600, waitingChargePerHour: 500, waitingFreeMins: 60, nightAllowance: 600, nightStartHour: 23, nightEndHour: 6, status: 'Active' }
];

async function ensureOutstationSeeds() {
    try {
        for (const item of DEFAULT_OUTSTATION_SEEDS) {
            const existing = await StatePricing.findOne({
                rideCategory: item.rideCategory,
                carCategory: { $regex: new RegExp('^' + item.carCategory.replace('+', '\\+') + '$', 'i') },
                $or: [
                    { city: 'Default' },
                    { state: 'Default' }
                ]
            });
            if (!existing) {
                await StatePricing.create(item);
            }
        }
    } catch (e) {
        console.warn('[Pricing] Outstation pricing seeding notice:', e.message);
    }
}

// @desc    Get all state/city pricing rules
// @route   GET /api/pricing-rules/state
exports.getStateRules = async (req, res) => {
    try {
        await ensureOutstationSeeds();
        const filter = {};
        if (req.query.city) {
            filter.city = { $regex: new RegExp('^' + req.query.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
        }
        if (req.query.state) {
            filter.state = { $regex: new RegExp('^' + req.query.state.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
        }
        if (req.query.rideCategory) {
            filter.rideCategory = { $regex: new RegExp('^' + req.query.rideCategory.trim() + '$', 'i') };
        }
        if (req.query.carCategory) {
            filter.carCategory = { $regex: new RegExp('^' + req.query.carCategory.trim().replace('+', '\\+') + '$', 'i') };
        }
        const rules = await StatePricing.find(filter).sort({ createdAt: -1 });
        res.status(200).json(rules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new state/city pricing rule (with upsert)
// @route   POST /api/pricing-rules/state
exports.createStateRule = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.city) data.city = data.city.trim();
        if (data.state) data.state = data.state.trim();
        if (data.carCategory) data.carCategory = data.carCategory.trim();
        if (data.rideCategory) data.rideCategory = data.rideCategory.trim();

        if (data.waitingCharge != null) {
            if (data.waitingChargePerHour == null || data.waitingChargePerHour === 0) {
                data.waitingChargePerHour = data.waitingCharge;
            }
            data.waitingCharge = 0;
        }

        // Upsert check: if city + carCategory + rideCategory exists, update it
        if (data.carCategory && data.rideCategory && (data.city || data.state)) {
            const query = {
                rideCategory: { $regex: new RegExp('^' + data.rideCategory + '$', 'i') },
                carCategory: { $regex: new RegExp('^' + data.carCategory.replace('+', '\\+') + '$', 'i') }
            };
            if (data.city) {
                query.city = { $regex: new RegExp('^' + data.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
            } else {
                query.state = { $regex: new RegExp('^' + data.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') };
            }

            const existing = await StatePricing.findOne(query);
            if (existing) {
                const updated = await StatePricing.findByIdAndUpdate(existing.id || existing._id, data, { new: true });
                return res.status(200).json(updated);
            }
        }

        const rule = await StatePricing.create(data);
        res.status(201).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update state/city pricing rule
// @route   PUT /api/pricing-rules/state/:id
exports.updateStateRule = async (req, res) => {
    try {
        const data = { ...req.body };
        if (data.city) data.city = data.city.trim();
        if (data.state) data.state = data.state.trim();
        if (data.carCategory) data.carCategory = data.carCategory.trim();
        if (data.rideCategory) data.rideCategory = data.rideCategory.trim();

        if (data.waitingCharge != null) {
            if (data.waitingChargePerHour == null || data.waitingChargePerHour === 0) {
                data.waitingChargePerHour = data.waitingCharge;
            }
            data.waitingCharge = 0;
        }

        const rule = await StatePricing.findByIdAndUpdate(req.params.id, data, { new: true });
        if (!rule) return res.status(404).json({ message: 'State rule not found' });
        res.status(200).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete state/city pricing rule
// @route   DELETE /api/pricing-rules/state/:id
exports.deleteStateRule = async (req, res) => {
    try {
        const rule = await StatePricing.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ message: 'State rule not found' });
        res.status(200).json({ message: 'State rule deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

