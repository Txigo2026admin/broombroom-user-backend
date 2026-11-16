const GlobalSetting = require('../models/GlobalSetting');

// @desc    Get all global settings
// @route   GET /api/global-settings
exports.getGlobalSettings = async (req, res) => {
    try {
        const settings = await GlobalSetting.find();
        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update or create global setting
// @route   POST /api/global-settings
exports.updateGlobalSetting = async (req, res) => {
    const { key, value } = req.body;
    try {
        const setting = await GlobalSetting.findOneAndUpdate(
            { key },
            { value },
            { new: true, upsert: true }
        );
        res.status(200).json(setting);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
