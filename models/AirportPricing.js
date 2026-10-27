const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const AirportPricing = sequelize.define('AirportPricing', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    city: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Default'
    },
    carCategory: {
        type: DataTypes.STRING,
        allowNull: false
    },
    baseKms: {
        type: DataTypes.FLOAT,
        defaultValue: 15
    },
    baseFare: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 750
    },
    fare15to25: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1050
    },
    maxAirportKms: {
        type: DataTypes.FLOAT,
        defaultValue: 25
    },
    extraKmRate: {
        type: DataTypes.FLOAT,
        defaultValue: 16
    },
    advanceAmount: {
        type: DataTypes.FLOAT,
        defaultValue: 500
    },
    advanceType: {
        type: DataTypes.STRING,
        defaultValue: 'Fixed'
    },
    advanceValue: {
        type: DataTypes.FLOAT,
        defaultValue: 500
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
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Active'
    }
}, {
    tableName: 'airport_pricings',
    timestamps: true
});

module.exports = attachMongooseCompatibility(AirportPricing);

