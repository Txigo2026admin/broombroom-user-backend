const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const GlobalSetting = sequelize.define('GlobalSetting', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: DataTypes.JSONB,
        allowNull: false
    }
}, {
    tableName: 'global_settings',
    timestamps: true
});

module.exports = attachMongooseCompatibility(GlobalSetting);
