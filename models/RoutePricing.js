const mongoose = require('mongoose');

const routePricingSchema = new mongoose.Schema({
    pickupLocation: {
        type: String,
        required: true
    },
    dropLocation: {
        type: String,
        required: true
    },
    pickupLat: {
        type: Number,
        required: false
    },
    pickupLng: {
        type: Number,
        required: false
    },
    dropLat: {
        type: Number,
        required: false
    },
    dropLng: {
        type: Number,
        required: false
    },
    nearbyRadiusKm: {
        type: Number,
        default: 25
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
        required: false
    },
    fixedPrice: {
        type: Number,
        required: true
    },
    includeToll: {
        type: Boolean,
        default: false
    },
    includeParking: {
        type: Boolean,
        default: false
    },
    includeNightAllowance: {
        type: Boolean,
        default: false
    },
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

module.exports = mongoose.model('RoutePricing', routePricingSchema);
