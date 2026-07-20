const mongoose = require('mongoose');

const pricingRuleSchema = new mongoose.Schema({
    rideType: {
        type: String,
        required: true,
        enum: ['Oneway', 'Roundtrip', 'Local', 'Airport']
    },
    // For route-based (Oneway/Roundtrip)
    sourceCity: String,
    destinationCity: String,
    
    // For location-based (General state/city rules)
    state: String,
    city: String,

    category: {
        type: String,
        required: true
    },
    
    // Pricing details
    baseFare: {
        type: Number,
        default: 0
    },
    perKmRate: {
        type: Number,
        default: 0
    },
    fixedFare: {
        type: Number, // If set, this overrides per-km calculation
        default: 0
    },
    
    // Roundtrip specific
    minKmsPerDay: {
        type: Number,
        default: 250
    },
    driverAllowance: {
        type: Number,
        default: 250
    },
    nightAllowance: {
        type: Number,
        default: 250
    },

    // Local Rental specific
    packages: [{
        hours: Number,
        kms: Number,
        price: Number
    }],

    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PricingRule', pricingRuleSchema);
