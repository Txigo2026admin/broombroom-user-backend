const StatePricing = require('../models/StatePricing');
const RoutePricing = require('../models/RoutePricing');
const RentalPackage = require('../models/RentalPackage');
const PricingRule = require('../models/PricingRule');
const pricingService = require('../services/pricingService');

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

// ==========================================
// STATE-WISE GENERAL PRICING CRUD
// ==========================================

// @desc    Get all state pricing rules
// @route   GET /api/pricing-rules/state
exports.getStateRules = async (req, res) => {
    try {
        const rules = await StatePricing.find().sort({ createdAt: -1 });
        res.status(200).json(rules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new state pricing rule
// @route   POST /api/pricing-rules/state
exports.createStateRule = async (req, res) => {
    try {
        const rule = await StatePricing.create(req.body);
        res.status(201).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update state pricing rule
// @route   PUT /api/pricing-rules/state/:id
exports.updateStateRule = async (req, res) => {
    try {
        const rule = await StatePricing.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!rule) return res.status(404).json({ message: 'State rule not found' });
        res.status(200).json(rule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete state pricing rule
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
