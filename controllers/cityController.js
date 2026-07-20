const City = require('../models/City');

// @desc    Get all cities
// @route   GET /api/cities
// @access  Public
exports.getCities = async (req, res) => {
    try {
        const cities = await City.find().sort({ createdAt: -1 });
        res.json(cities);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Save a city
// @route   POST /api/cities
// @access  Public
exports.saveCity = async (req, res) => {
    try {
        const { name, displayName, lat, lon, state, country, placeId } = req.body;

        // Check if city already exists by placeId
        let city = await City.findOne({ placeId });
        if (city) {
            return res.status(200).json(city);
        }

        city = new City({
            name,
            displayName,
            lat,
            lon,
            state,
            country,
            placeId
        });

        const savedCity = await city.save();
        res.status(201).json(savedCity);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update city status
// @route   PUT /api/cities/:id
// @access  Private/Admin
exports.updateCity = async (req, res) => {
    try {
        const city = await City.findById(req.params.id);
        if (city) {
            city.status = req.body.status || city.status;
            const updatedCity = await city.save();
            res.json(updatedCity);
        } else {
            res.status(404).json({ message: 'City not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
