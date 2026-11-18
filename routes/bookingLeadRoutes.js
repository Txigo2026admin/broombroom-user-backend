const express = require('express');
const router = express.Router();
const {
    getBookingLeads,
    createBookingLead,
    getBookingLeadById,
    updateBookingLead,
    deleteBookingLead
} = require('../controllers/bookingLeadController');

router.route('/')
    .get(getBookingLeads)
    .post(createBookingLead);

router.route('/:id')
    .get(getBookingLeadById)
    .patch(updateBookingLead)
    .put(updateBookingLead)
    .delete(deleteBookingLead);

router.route('/:id/status')
    .patch(updateBookingLead);

module.exports = router;
