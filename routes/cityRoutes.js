const express = require('express');
const router = express.Router();
const { getCities, saveCity, updateCity, searchCities } = require('../controllers/cityController');

router.get('/search', searchCities);

router.route('/')
    .get(getCities)
    .post(saveCity);

router.route('/:id')
    .put(updateCity);

module.exports = router;
