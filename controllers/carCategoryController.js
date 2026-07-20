const CarCategory = require('../models/CarCategory');

// @desc    Get all car categories
// @route   GET /api/car-categories
exports.getCarCategories = async (req, res) => {
    try {
        const categories = await CarCategory.find();
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new car category
// @route   POST /api/car-categories
exports.createCarCategory = async (req, res) => {
    try {
        const category = await CarCategory.create(req.body);
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update car category
// @route   PUT /api/car-categories/:id
exports.updateCarCategory = async (req, res) => {
    try {
        const category = await CarCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!category) return res.status(404).json({ message: 'Category not found' });
        res.status(200).json(category);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
