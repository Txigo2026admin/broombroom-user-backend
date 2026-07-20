const express = require('express');
const router = express.Router();
const { getCities, saveCity, updateCity } = require('../controllers/cityController');

router.route('/')
    .get(getCities)
    .post(saveCity);

router.route('/:id')
    .put(updateCity);

module.exports = router;
