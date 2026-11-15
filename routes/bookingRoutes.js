const express = require('express');
const router = express.Router();
const { getBookings, createBooking, updateBookingStatus, calculateFare, getPilots } = require('../controllers/bookingController');

router.get('/', getBookings);
router.get('/pilots', getPilots);
router.post('/', createBooking);
router.post('/calculate-fare', calculateFare);
router.patch('/:id', updateBookingStatus);

module.exports = router;
