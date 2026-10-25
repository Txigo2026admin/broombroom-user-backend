const City = require('../models/City');
const mapService = require('../services/mapService');

// @desc    Search / Autocomplete cities and addresses
// @route   GET /api/cities/search
// @access  Public
exports.searchCities = async (req, res) => {
    try {
        const query = req.query.q || req.query.query || '';
        const results = await mapService.searchLocations(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

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
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ message: 'Valid city name is required' });
        }

        const cleanName = name.trim();
        const primaryName = cleanName.split(',')[0].trim();
        const genericWords = ['airport', 'terminal', 'station', 'railway', 'sector', 'gate'];
        const isGeneric = genericWords.includes(primaryName.toLowerCase());
        const saveName = isGeneric ? cleanName : primaryName;

        // Check if city already exists by placeId or by name
        let city = null;
        if (placeId) {
            city = await City.findOne({ placeId: String(placeId) });
        }
        if (!city) {
            city = await City.findOne({
                name: { $regex: new RegExp('^' + saveName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
            });
        }
        if (city) {
            return res.status(200).json(city);
        }

        city = await City.create({
            name: saveName,
            displayName: displayName || cleanName,
            lat: lat ? String(lat) : undefined,
            lon: lon ? String(lon) : undefined,
            state: state || '',
            country: country || 'India',
            placeId: placeId ? String(placeId) : undefined
        });

        res.status(201).json(city);
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
