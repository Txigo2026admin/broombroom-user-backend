const mongoose = require('mongoose');

const carCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    seater: {
        type: Number,
        required: true
    },
    baseFare: {
        type: Number,
        required: true
    },
    perKmRate: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CarCategory', carCategorySchema);
