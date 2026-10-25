const express = require('express');

const router = express.Router();

const {
    createPaymentOrder,
    checkPaymentStatus
} = require('../controllers/paymentController');

// Create Cashfree payment order
router.post(
    '/create-order',
    createPaymentOrder
);

// Check Cashfree payment status
router.get(
    '/status/:bookingId',
    checkPaymentStatus
);

module.exports = router;