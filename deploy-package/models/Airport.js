const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const Airport = sequelize.define('Airport', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false
    },
    city: {
        type: DataTypes.STRING,
        allowNull: false
    },
    state: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lat: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lon: {
        type: DataTypes.STRING,
        allowNull: true
    },
    terminals: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'Active'
    }
}, {
    tableName: 'airports',
    timestamps: true
});

module.exports = attachMongooseCompatibility(Airport);

