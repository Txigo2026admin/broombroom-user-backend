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
    nightAllowance: {
        type: DataTypes.FLOAT,
        defaultValue: 0
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
