const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const Booking = sequelize.define(
    'Booking',
    {
        // =====================================================
        // BASIC BOOKING INFORMATION
        // =====================================================

        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },

        bookingId: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true
        },

        // =====================================================
        // CUSTOMER
        // =====================================================

        customerName: {
            type: DataTypes.STRING,
            allowNull: false
        },

        customerMobile: {
            type: DataTypes.STRING,
            allowNull: false
        },

        customerEmail: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // =====================================================
        // SERVICE
        // =====================================================

        serviceType: {
            type: DataTypes.STRING,
            allowNull: false
        },

        wayType: {
            type: DataTypes.STRING,
            allowNull: true
        },

        airportDirection: {
            type: DataTypes.STRING,
            allowNull: true
        },

        airportTerminal: {
            type: DataTypes.STRING,
            allowNull: true
        },

        rentalPackage: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // =====================================================
        // LOCATION
        // =====================================================

        state: {
            type: DataTypes.STRING,
            allowNull: false
        },

        pincode: {
            type: DataTypes.STRING,
            allowNull: true
        },

        pickupAddress: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        dropAddress: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        distance: {
            type: DataTypes.STRING,
            allowNull: true
        },

        pickupLat: {
            type: DataTypes.STRING,
            allowNull: true
        },

        pickupLng: {
            type: DataTypes.STRING,
            allowNull: true
        },

        dropLat: {
            type: DataTypes.STRING,
            allowNull: true
        },

        dropLng: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // =====================================================
        // DATE / TIME
        // =====================================================

        pickupDate: {
            type: DataTypes.STRING,
            allowNull: false
        },

        pickupTime: {
            type: DataTypes.STRING,
            allowNull: false
        },

        returnDate: {
            type: DataTypes.STRING,
            allowNull: true
        },

        returnTime: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // =====================================================
        // VEHICLE
        // =====================================================

        vehicleCategory: {
            type: DataTypes.STRING,
            allowNull: false
        },

        seater: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        acType: {
            type: DataTypes.STRING,
            allowNull: true
        },

        allocateOurPilot: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

        eligiblePilots: {
            type: DataTypes.JSONB,
            defaultValue: []
        },

        // =====================================================
        // FARE
        // =====================================================

        fare: {
            type: DataTypes.FLOAT,
            allowNull: false
        },

        advance: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },

        dueFare: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },

        // =====================================================
        // CASHFREE PAYMENT
        // =====================================================

        cashfreeOrderId: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },

        paymentStatus: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'PENDING'
        },

        paidAmount: {
            type: DataTypes.FLOAT,
            allowNull: false,
            defaultValue: 0
        },

        paymentMethod: {
            type: DataTypes.STRING,
            allowNull: true
        },

        paymentDate: {
            type: DataTypes.DATE,
            allowNull: true
        },

        // =====================================================
        // EXTRA CHARGES
        // =====================================================

        extraKm: {
            type: DataTypes.STRING,
            allowNull: true
        },

        extraHour: {
            type: DataTypes.STRING,
            allowNull: true
        },

        waitingCharges: {
            type: DataTypes.STRING,
            allowNull: true
        },

        nightAllowance: {
            type: DataTypes.STRING,
            allowNull: true
        },

        tollTax: {
            type: DataTypes.STRING,
            defaultValue: 'Excluded'
        },

        // =====================================================
        // BOOKING STATUS
        // =====================================================

        status: {
            type: DataTypes.STRING,
            defaultValue: 'Pending'
        },

        timeline: {
            type: DataTypes.JSONB,
            defaultValue: []
        },

        // =====================================================
        // DRIVER
        // =====================================================

        driverName: {
            type: DataTypes.STRING,
            allowNull: true
        },

        driverNumber: {
            type: DataTypes.STRING,
            allowNull: true
        },

        carNo: {
            type: DataTypes.STRING,
            allowNull: true
        }
    },
    {
        tableName: 'bookings',
        timestamps: true
    }
);


// =========================================================
// GENERATE BOOKING ID
// =========================================================

Booking.beforeCreate((booking) => {
    if (!booking.bookingId) {
        const date = new Date();

        const year = date
            .getFullYear()
            .toString()
            .slice(-2);

        const month = (date.getMonth() + 1)
            .toString()
            .padStart(2, '0');

        const random = Math.floor(
            1000 + Math.random() * 9000
        );

        booking.bookingId =
            `TX${year}${month}${random}`;
    }
});


// =========================================================
// EXPORT
// =========================================================

module.exports =
    attachMongooseCompatibility(Booking);