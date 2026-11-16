const express = require('express');
const router = express.Router();
const {
    getAirports,
    getAirportById,
    createAirport,
    updateAirport,
    deleteAirport
} = require('../controllers/airportController');

router.route('/')
    .get(getAirports)
    .post(createAirport);

router.route('/:id')
    .get(getAirportById)
    .put(updateAirport)
    .delete(deleteAirport);

module.exports = router;

