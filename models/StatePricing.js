const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const StatePricing = sequelize.define('StatePricing', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    state: {
        type: DataTypes.STRING,
        allowNull: false
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    rideCategory: {
        type: DataTypes.STRING,
        allowNull: false
    },
    carCategory: {
        type: DataTypes.STRING,
        allowNull: false
    },
    acType: {
        type: DataTypes.STRING,
        defaultValue: 'Any'
    },
    seater: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    ratePerKm: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    hourlyRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    minKms: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    driverBata: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    extraKmRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    extraHourRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    waitingCharge: {
        type: DataTypes.FLOAT,
        defaultValue: 2
    },
    waitingChargePerHour: {
        type: DataTypes.FLOAT,
        defaultValue: 150
    },
    waitingFreeMins: {
        type: DataTypes.INTEGER,
        defaultValue: 60
    },
    nightAllowance: {
        type: DataTypes.FLOAT,
        defaultValue: 250
    },
    nightStartHour: {
        type: DataTypes.INTEGER,
        defaultValue: 23
    },
    nightEndHour: {
        type: DataTypes.INTEGER,
        defaultValue: 6
    },
    threshold: {
        type: DataTypes.FLOAT,
        defaultValue: 500
    },
    rate0to50: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    },
    rate51to100: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    },
    rate101to150: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    },
    rate151to200: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    },
    rate201to4000: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: null
    },
    slabRates: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null
    },
    advanceType: {
        type: DataTypes.STRING,
        defaultValue: 'Percentage'
    },
    advanceValue: {
        type: DataTypes.FLOAT,
        defaultValue: 20
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Active'
    }
}, {
    tableName: 'state_pricings',
    timestamps: true
});

module.exports = attachMongooseCompatibility(StatePricing);
