const express = require('express');
const router = express.Router();
const { 
    getPricingRules, 
    createPricingRule, 
    updatePricingRule,
    deletePricingRule,
    calculatePrice,
    
    // State Pricing
    getStateRules,
    createStateRule,
    updateStateRule,
    deleteStateRule,

    // Route Pricing
    getRouteRules,
    createRouteRule,
    updateRouteRule,
    deleteRouteRule,

    // Rental Packages
    getRentalRules,
    createRentalRule,
    updateRentalRule,
    deleteRentalRule
} = require('../controllers/pricingRuleController');

// Calculation Engine
router.post('/calculate', calculatePrice);

// State-wise General Pricing
router.route('/state')
    .get(getStateRules)
    .post(createStateRule);
router.route('/state/:id')
    .put(updateStateRule)
    .delete(deleteStateRule);

// Route-specific Overrides
router.route('/route')
    .get(getRouteRules)
    .post(createRouteRule);
router.route('/route/:id')
    .put(updateRouteRule)
    .delete(deleteRouteRule);

// Rental Packages
router.route('/rental')
    .get(getRentalRules)
    .post(createRentalRule);
router.route('/rental/:id')
    .put(updateRentalRule)
    .delete(deleteRentalRule);

// Legacy Pricing Rules (Backward Compatibility)
router.route('/')
    .get(getPricingRules)
    .post(createPricingRule);
router.route('/:id')
    .put(updatePricingRule)
    .delete(deletePricingRule);

module.exports = router;
