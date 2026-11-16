const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const CarCategory = sequelize.define('CarCategory', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    displayName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    seater: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    baseFare: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    perKmRate: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Active'
    }
}, {
    tableName: 'car_categories',
    timestamps: true
});

module.exports = attachMongooseCompatibility(CarCategory);
