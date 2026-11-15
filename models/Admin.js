const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');
const { attachMongooseCompatibility } = require('./baseModel');

const Admin = sequelize.define('Admin', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'BroomBoom Admin'
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    role: {
        type: DataTypes.STRING(50),
        defaultValue: 'superadmin'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    failedLoginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lockUntil: {
        type: DataTypes.DATE,
        allowNull: true
    },
    twoFactorEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    twoFactorSecret: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    twoFactorBackupCodes: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastLoginIp: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    lastFailedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    passwordChangedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    mustChangePassword: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'admins',
    timestamps: true,
    hooks: {
        beforeSave: async (admin) => {
            // Hash password with 12 rounds of bcrypt salt if changed and not already hashed
            if (admin.changed('password') && admin.password) {
                const isAlreadyHashed = admin.password.startsWith('$2a$') || 
                                       admin.password.startsWith('$2b$') || 
                                       admin.password.startsWith('$2y$');
                if (!isAlreadyHashed) {
                    const salt = await bcrypt.genSalt(12);
                    admin.password = await bcrypt.hash(admin.password, salt);
                    admin.passwordChangedAt = new Date();
                }
            }
            if (admin.username) {
                admin.username = admin.username.trim().toLowerCase();
            }
        }
    }
});

// Compare plain candidate password against salted bcrypt hash
Admin.prototype.validatePassword = async function (plainPassword) {
    if (!plainPassword || !this.password) return false;
    return await bcrypt.compare(plainPassword, this.password);
};

// Check if account is currently locked out
Admin.prototype.isLocked = function () {
    return Boolean(this.lockUntil && new Date(this.lockUntil).getTime() > Date.now());
};

// Get remaining lockout time in milliseconds
Admin.prototype.getRemainingLockoutMs = function () {
    if (!this.lockUntil) return 0;
    return Math.max(0, new Date(this.lockUntil).getTime() - Date.now());
};

// Strip sensitive fields (hash, 2FA secret, backup codes) from JSON output
const origToJSON = Admin.prototype.toJSON;
Admin.prototype.toJSON = function () {
    const values = origToJSON ? origToJSON.call(this) : { ...this.get() };
    delete values.password;
    delete values.twoFactorSecret;
    delete values.twoFactorBackupCodes;
    return values;
};

module.exports = attachMongooseCompatibility(Admin);
