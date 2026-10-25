const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const PricingRule = sequelize.define('PricingRule', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    rideType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    sourceCity: {
        type: DataTypes.STRING,
        allowNull: true
    },
    destinationCity: {
        type: DataTypes.STRING,
        allowNull: true
    },
    state: {
        type: DataTypes.STRING,
        allowNull: true
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false
    },
    baseFare: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    perKmRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    fixedFare: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    minKmsPerDay: {
        type: DataTypes.FLOAT,
        defaultValue: 250
    },
    driverAllowance: {
        type: DataTypes.FLOAT,
        defaultValue: 250
    },
    nightAllowance: {
        type: DataTypes.FLOAT,
        defaultValue: 250
    },
    packages: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Active'
    }
}, {
    tableName: 'pricing_rules',
    timestamps: true
});

module.exports = attachMongooseCompatibility(PricingRule);
