const GlobalSetting = require('../models/GlobalSetting');

const DEFAULT_ADDONS = [
    {
        id: 'addon-pet',
        key: 'petAllowance',
        name: 'Travel with Pet (Pet Allowance)',
        price: 1001,
        description: 'Sanitized pet-friendly cab with protective seat covers'
    },
    {
        id: 'addon-carrier',
        key: 'roofCarrier',
        name: 'Add Roof Carrier',
        price: 157,
        description: 'Fit 4 more large bags comfortably on luggage carrier'
    },
    {
        id: 'addon-lang',
        key: 'language',
        name: 'Preferred Driver Language',
        price: 209,
        description: 'Assigns driver fluent in English, Hindi, or Bengali'
    },
    {
        id: 'addon-new-vehicle',
        key: 'newVehicle',
        name: 'New Vehicle (2023+)',
        price: 262,
        description: 'Promised latest 2023 or newer car model with pristine interior'
    },
    {
        id: 'addon-sightseeing',
        key: 'sightseeing',
        name: 'Local sightseeing package',
        price: 787,
        description: 'Dedicated sightseeing route stopovers within city limits'
    },
    {
        id: 'addon-refundable',
        key: 'refundable',
        name: 'Upgrade to Refundable booking',
        price: 751,
        description: '100% refund for cancellation before 3 hours of departure time'
    }
];

/**
 * Get all addon services (read from PostgreSQL global_settings or return defaults)
 */
const getAddons = async (req, res) => {
    try {
        const setting = await GlobalSetting.findOne({
            where: { key: 'addons_config' }
        });

        if (setting && Array.isArray(setting.value) && setting.value.length > 0) {
            return res.status(200).json({
                success: true,
                addons: setting.value
            });
        }

        // Initialize default addons in database if not yet present
        await GlobalSetting.create({
            key: 'addons_config',
            value: DEFAULT_ADDONS
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            addons: DEFAULT_ADDONS
        });
    } catch (error) {
        console.error('Error fetching addons:', error);
        return res.status(200).json({
            success: true,
            addons: DEFAULT_ADDONS,
            warning: 'Returned default addons due to db read error'
        });
    }
};

/**
 * Update all addon services (saved by admin panel)
 */
const updateAddons = async (req, res) => {
    try {
        const incomingAddons = Array.isArray(req.body)
            ? req.body
            : req.body?.addons || [];

        if (!Array.isArray(incomingAddons) || incomingAddons.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Addon list must be a non-empty array'
            });
        }

        // Sanitize incoming addons
        const sanitized = incomingAddons.map((item, idx) => ({
            id: item.id || `addon-${idx + 1}`,
            key: item.key || (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_'),
            name: item.name,
            price: Number(item.price) || 0,
            description: item.description || '',
            isActive: item.isActive !== false,
            isPopular: Boolean(item.isPopular)
        }));

        let setting = await GlobalSetting.findOne({
            where: { key: 'addons_config' }
        });

        if (setting) {
            setting.value = sanitized;
            await setting.save();
        } else {
            setting = await GlobalSetting.create({
                key: 'addons_config',
                value: sanitized
            });
        }

        console.log(`[Addons] Updated ${sanitized.length} addon services in database.`);

        return res.status(200).json({
            success: true,
            message: 'Addon services successfully updated and synced across all BroomBoom web pages!',
            addons: setting.value
        });
    } catch (error) {
        console.error('Error updating addons:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to save addon services'
        });
    }
};

module.exports = {
    getAddons,
    updateAddons
};
