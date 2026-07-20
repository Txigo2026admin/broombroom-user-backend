const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingId: { type: String, unique: true, sparse: true },
    customerName: { type: String, required: true },
    customerMobile: { type: String, required: true },
    customerEmail: String,
    
    serviceType: {
        type: String,
        required: true
    },
    wayType: { type: String },
    airportDirection: { type: String },
    rentalPackage: { type: String },
    
    state: { type: String, required: true },
    pincode: String,

    // Route Information
    pickupAddress: { type: String, required: true },
    dropAddress: { type: String, required: true },
    distance: String,

    // GPS Coordinates
    pickupLat: String,
    pickupLng: String,
    dropLat: String,
    dropLng: String,

    // Schedule Details
    pickupDate: { type: String, required: true },
    pickupTime: { type: String, required: true },
    returnDate: String,
    returnTime: String,

    // Vehicle & Pilot Selection
    vehicleCategory: { type: String, required: true },
    seater: { type: Number, required: true },
    acType: String,
    allocateOurPilot: { type: Boolean, default: false },
    eligiblePilots: [{ type: String }],

    // Fare & Charges
    fare: { type: Number, required: true },
    advance: { type: Number, default: 0 },
    dueFare: { type: Number, default: 0 },
    extraKm: String,
    extraHour: String,
    waitingCharges: String,
    nightAllowance: String,
    tollTax: { type: String, enum: ['Included', 'Excluded'], default: 'Excluded' },

    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
        default: 'Pending'
    },
    timeline: [
        {
            status: String,
            message: String,
            timestamp: { type: Date, default: Date.now }
        }
    ],
    driverName: { type: String },
    driverNumber: { type: String },
    carNo: { type: String }
}, {
    timestamps: true
});

// Generate a random booking ID before saving
bookingSchema.pre('save', async function() {
    if (!this.bookingId) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        this.bookingId = `TX${year}${month}${random}`;
    }
});

module.exports = mongoose.model('Booking', bookingSchema);
