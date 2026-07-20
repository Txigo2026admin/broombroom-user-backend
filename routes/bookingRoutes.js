const express = require('express');
const router = express.Router();
const { getBookings, createBooking, updateBookingStatus, calculateFare } = require('../controllers/bookingController');

router.get('/', getBookings);
router.post('/', createBooking);
router.post('/calculate-fare', calculateFare);
router.patch('/:id', updateBookingStatus);

module.exports = router;
