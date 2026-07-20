const mongoose = require('mongoose');

const statePricingSchema = new mongoose.Schema({
    state: {
        type: String,
        required: true
    },
    rideCategory: {
        type: String,
        required: true,
        enum: ['Oneway', 'Roundtrip', 'Rental', 'Airport', 'Station']
    },
    carCategory: {
        type: String,
        required: true
    },
    acType: {
        type: String,
        enum: ['AC', 'Non-AC', 'Any'],
        default: 'Any'
    },
    seater: {
        type: Number,
        required: true
    },
    // Rates & Allowances
    ratePerKm: {
        type: Number,
        default: 0
    },
    hourlyRate: {
        type: Number,
        default: 0
    },
    minKms: {
        type: Number,
        default: 0
    },
    driverBata: {
        type: Number,
        default: 0
    },
    extraKmRate: {
        type: Number,
        default: 0
    },
    extraHourRate: {
        type: Number,
        default: 0
    },
    waitingCharge: {
        type: Number,
        default: 2 // default waiting charge ₹2/min
    },
    nightAllowance: {
        type: Number,
        default: 0
    },
    // Advance payment config
    advanceType: {
        type: String,
        enum: ['Percentage', 'Fixed'],
        default: 'Percentage'
    },
    advanceValue: {
        type: Number,
        default: 20
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('StatePricing', statePricingSchema);
