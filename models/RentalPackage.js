const mongoose = require('mongoose');

const rentalPackageSchema = new mongoose.Schema({
    state: {
        type: String,
        required: true
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
    packageHours: {
        type: Number,
        required: true
    },
    includedKms: {
        type: Number,
        required: true
    },
    baseFare: {
        type: Number,
        required: true
    },
    extraKmRate: {
        type: Number,
        default: 0
    },
    extraHourRate: {
        type: Number,
        default: 0
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

module.exports = mongoose.model('RentalPackage', rentalPackageSchema);
