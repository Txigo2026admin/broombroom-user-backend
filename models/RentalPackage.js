const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const RentalPackage = sequelize.define('RentalPackage', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    state: {
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
    packageHours: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    includedKms: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    baseFare: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    extraKmRate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    extraHourRate: {
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
    tableName: 'rental_packages',
    timestamps: true
});

module.exports = attachMongooseCompatibility(RentalPackage);
