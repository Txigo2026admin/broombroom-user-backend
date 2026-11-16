const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { attachMongooseCompatibility } = require('./baseModel');

const CareerLead = sequelize.define('CareerLead', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    jobId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    jobTitle: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'General Application'
    },
    department: {
        type: DataTypes.STRING,
        defaultValue: 'General'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true
    },
    experience: {
        type: DataTypes.STRING,
        allowNull: true
    },
    linkedIn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    portfolio: {
        type: DataTypes.STRING,
        allowNull: true
    },
    noticePeriod: {
        type: DataTypes.STRING,
        defaultValue: 'Immediate'
    },
    cover: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    resumeUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    resumeFileName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'New'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    source: {
        type: DataTypes.STRING,
        defaultValue: 'BroomBoom Careers Page'
    },
    appliedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'career_leads',
    timestamps: true
});

module.exports = attachMongooseCompatibility(CareerLead);
