const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const BookingLead = sequelize.define('BookingLead', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    leadId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    serviceType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'outstation-oneway'
    },
    tripType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    fromCity: {
        type: DataTypes.STRING,
        allowNull: false
    },
    toCity: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pickupAddress: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    dropAddress: {
        type: DataTypes.TEXT,
        allowNull: true
    },
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
    dropTime: {
        type: DataTypes.STRING,
        allowNull: true
    },
    hourlyPackage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    airportMode: {
        type: DataTypes.STRING,
        allowNull: true
    },
    flightNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    distanceKm: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    durationMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    customerName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    customerMobile: {
        type: DataTypes.STRING,
        allowNull: true
    },
    customerEmail: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'New Search'
    },
    source: {
        type: DataTypes.STRING,
        defaultValue: 'Hero Search'
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    estimatedFare: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    rawSearchParams: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
    },
    searchedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'booking_leads',
    timestamps: true
});

module.exports = attachMongooseCompatibility(BookingLead);
