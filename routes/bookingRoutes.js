const express = require('express');
const router = express.Router();
const { getBookings, createBooking, calculateFare, getPilots } = require('../controllers/bookingController');
const {
    getAllBookingsAdmin,
    getBookingDetailsAdmin,
    createBookingAdmin,
    updateBookingAdmin,
    deleteBookingAdmin
} = require('../controllers/adminBookingController');
const { protect } = require('../middleware/authMiddleware');

// Dedicated Admin Booking Endpoints (Returns all details from bookings table)
router.get('/all', getAllBookingsAdmin);
router.get('/admin', getAllBookingsAdmin);
router.get('/admin/all', getAllBookingsAdmin);
router.get('/admin/:id', getBookingDetailsAdmin);
router.get('/details/:id', getBookingDetailsAdmin);

// Standard GET /: If user token provided and not admin query, filter by user; otherwise return all bookings for Admin
router.get('/', (req, res, next) => {
    const isExplicitUser = req.headers.authorization && 
                           !req.headers.authorization.includes('admin') && 
                           !req.query.admin && 
                           req.headers['x-app-source'] !== 'admin';

    if (isExplicitUser) {
        return protect(req, res, () => getBookings(req, res));
    }
    return getAllBookingsAdmin(req, res);
});

router.get('/pilots', getPilots);
router.post('/', createBooking);
router.post('/admin', createBookingAdmin);
router.post('/calculate-fare', calculateFare);

router.get('/:id', getBookingDetailsAdmin);
router.patch('/:id', updateBookingAdmin);
router.put('/:id', updateBookingAdmin);
router.delete('/:id', deleteBookingAdmin);

module.exports = router;
