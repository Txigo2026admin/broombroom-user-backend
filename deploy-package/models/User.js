const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Active'
    },
    loginCount: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    leadType: {
        type: DataTypes.STRING,
        defaultValue: 'New'
    },
    source: {
        type: DataTypes.STRING,
        defaultValue: 'BroomBoom App'
    },
    loginHistory: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true
    },
    state: {
        type: DataTypes.STRING,
        allowNull: true
    },
    vehicleType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    carNo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    licenseNo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    registeredAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true
});

module.exports = attachMongooseCompatibility(User);
