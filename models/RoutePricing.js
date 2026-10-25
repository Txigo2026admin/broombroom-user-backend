const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const RoutePricing = sequelize.define('RoutePricing', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    pickupLocation: {
        type: DataTypes.STRING,
        allowNull: false
    },
    dropLocation: {
        type: DataTypes.STRING,
        allowNull: false
    },
    pickupLat: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    pickupLng: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    dropLat: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    dropLng: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    nearbyRadiusKm: {
        type: DataTypes.FLOAT,
        defaultValue: 25
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
        allowNull: true
    },
    fixedPrice: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    includeToll: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    includeParking: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    includeNightAllowance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
    tableName: 'route_pricings',
    timestamps: true
});

module.exports = attachMongooseCompatibility(RoutePricing);
