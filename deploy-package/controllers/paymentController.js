const { Op } = require('sequelize');
const Booking = require('../models/Booking');

const CASHFREE_API_VERSION = '2025-01-01';

const CASHFREE_BASE_URL =
    process.env.CASHFREE_ENV === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';

const formatBooking = (b) => ({
    id: b.id,
    bookingId: b.bookingId,
    customerName: b.customerName,
    customerMobile: b.customerMobile,
    customerEmail: b.customerEmail,
    serviceType: b.serviceType,
    wayType: b.wayType,
    airportDirection: b.airportDirection,
    rentalPackage: b.rentalPackage,
    state: b.state,
    pincode: b.pincode,
    pickupAddress: b.pickupAddress,
    dropAddress: b.dropAddress,
    pickupDate: b.pickupDate,
    pickupTime: b.pickupTime,
    returnDate: b.returnDate,
    returnTime: b.returnTime,
    vehicleCategory: b.vehicleCategory,
    seater: b.seater,
    status: b.status,
    fare: Number(b.fare || 0),
    advance: Number(b.advance || 0),
    dueFare: Number(b.dueFare || 0),
    paidAmount: Number(b.paidAmount || 0),
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod,
    orderId: b.cashfreeOrderId
});


// ============================================================
// CREATE CASHFREE PAYMENT ORDER
// POST /api/payment/create-order
// ============================================================

exports.createPaymentOrder = async (req, res) => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: 'bookingId is required'
            });
        }

        // ----------------------------------------------------
        // Find booking
        // ----------------------------------------------------

        const booking = await Booking.findOne({
            where: {
                bookingId: bookingId
            }
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // ----------------------------------------------------
        // Already paid?
        // ----------------------------------------------------

        if (booking.paymentStatus === 'SUCCESS') {
            return res.status(400).json({
                success: false,
                message: 'This booking has already been paid',
                bookingId: booking.bookingId,
                paymentStatus: booking.paymentStatus
            });
        }

        // ----------------------------------------------------
        // Advance amount
        // ----------------------------------------------------

        let amount = Number(booking.advance || 0);

        if (!amount || amount <= 0) {
            amount = Number(booking.fare ? (booking.fare * 0.25).toFixed(2) : 100);
        }

        // ----------------------------------------------------
        // Cashfree credentials
        // ----------------------------------------------------

        if (
            !process.env.CASHFREE_APP_ID ||
            !process.env.CASHFREE_SECRET_KEY
        ) {
            return res.status(500).json({
                success: false,
                message:
                    'Cashfree credentials are not configured'
            });
        }

        // ----------------------------------------------------
        // Customer phone
        // Cashfree requires a valid phone number.
        // Remove +91 and other non-numeric characters.
        // ----------------------------------------------------

        let customerPhone =
            String(booking.customerMobile || '')
                .replace(/\D/g, '');

        if (customerPhone.length === 12 &&
            customerPhone.startsWith('91')) {
            customerPhone =
                customerPhone.substring(2);
        }

        if (customerPhone.length !== 10) {
            customerPhone = '9876543210';
        }

        // ----------------------------------------------------
        // Customer ID
        // ----------------------------------------------------

        const customerId =
            `BB_${booking.bookingId}`;

        // ----------------------------------------------------
        // Create unique Cashfree order ID (fresh ID every time for retry)
        // ----------------------------------------------------

        const cashfreeOrderId =
            `BB_${booking.bookingId}_${Date.now()}`;

        // ----------------------------------------------------
        // Return URL
        //
        // Dynamic frontend URL support so Cashfree redirects
        // directly back to the Flutter app!
        // ----------------------------------------------------

        const frontendReturnUrl = req.body.returnUrl;
        let returnUrl = frontendReturnUrl || process.env.CASHFREE_RETURN_URL;

        if (!returnUrl) {
            const origin = req.headers.origin || req.headers.referer;
            if (origin) {
                try {
                    const parsed = new URL(origin);
                    returnUrl = parsed.origin;
                } catch (e) {
                    returnUrl = 'http://localhost:3000';
                }
            } else {
                returnUrl = 'http://localhost:3000';
            }
        }

        const baseUrlWithoutSlash = returnUrl.replace(/\/+$/, '');
        let targetReturnUrl = '';
        if (baseUrlWithoutSlash.includes('{order_id}')) {
            targetReturnUrl = baseUrlWithoutSlash.replace('{booking_id}', booking.bookingId);
        } else {
            const separator = baseUrlWithoutSlash.includes('?') ? '&' : '?';
            targetReturnUrl = `${baseUrlWithoutSlash}${separator}order_id={order_id}&booking_id=${booking.bookingId}`;
        }

        // ----------------------------------------------------
        // Cashfree request
        // ----------------------------------------------------

        const payload = {
            order_id: cashfreeOrderId,

            order_amount:
                Number(amount.toFixed(2)),

            order_currency: 'INR',

            customer_details: {
                customer_id: customerId,

                customer_name:
                    booking.customerName,

                customer_phone:
                    customerPhone,

                ...(booking.customerEmail
                    ? {
                        customer_email:
                            booking.customerEmail
                    }
                    : {})
            },

            order_meta: {
                return_url: targetReturnUrl
            },

            order_note:
                `BroomBoom booking ${booking.bookingId}`
        };

        console.log(
            '[Cashfree] Creating order:',
            {
                bookingId: booking.bookingId,
                orderId: cashfreeOrderId,
                amount: amount,
                environment:
                    process.env.CASHFREE_ENV
            }
        );

        // ----------------------------------------------------
        // Call Cashfree
        // ----------------------------------------------------

        const response = await fetch(
            `${CASHFREE_BASE_URL}/orders`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json',

                    'x-client-id':
                        process.env.CASHFREE_APP_ID,

                    'x-client-secret':
                        process.env.CASHFREE_SECRET_KEY,

                    'x-api-version':
                        CASHFREE_API_VERSION,

                    'Accept':
                        'application/json'
                },

                body:
                    JSON.stringify(payload)
            }
        );

        const data =
            await response.json();

        console.log(
            '[Cashfree] Response status:',
            response.status
        );

        if (!response.ok) {
            console.error(
                '[Cashfree] Error:',
                data
            );

            return res.status(
                response.status
            ).json({
                success: false,
                message:
                    data.message ||
                    'Cashfree order creation failed',
                cashfree: data
            });
        }

        // ----------------------------------------------------
        // Make sure session exists
        // ----------------------------------------------------

        if (!data.payment_session_id) {
            return res.status(500).json({
                success: false,
                message:
                    'Cashfree did not return payment_session_id',
                cashfree: data
            });
        }

        // ----------------------------------------------------
        // Save Cashfree order against booking
        // ----------------------------------------------------

        await booking.update({
            cashfreeOrderId:
                data.order_id,

            paymentStatus:
                'PENDING'
        });

        // ----------------------------------------------------
        // Send session to Flutter
        // ----------------------------------------------------

        return res.status(200).json({
            success: true,

            bookingId:
                booking.bookingId,

            orderId:
                data.order_id,

            paymentSessionId:
                data.payment_session_id,

            amount:
                amount,

            paymentStatus:
                'PENDING',

            environment:
                process.env.CASHFREE_ENV || 'sandbox'
        });

    } catch (error) {

        console.error(
            '[Cashfree] Create order error:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                'Payment order creation failed'
        });
    }
};


// ============================================================
// CHECK CASHFREE PAYMENT STATUS
// GET /api/payment/status/:bookingId
// ============================================================

exports.checkPaymentStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;

        // ----------------------------------------------------
        // Find booking by bookingId OR cashfreeOrderId
        // ----------------------------------------------------

        const booking = await Booking.findOne({
            where: {
                [Op.or]: [
                    { bookingId: bookingId },
                    { cashfreeOrderId: bookingId }
                ]
            }
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // ----------------------------------------------------
        // If already successful, return database status
        // ----------------------------------------------------

        if (booking.paymentStatus === 'SUCCESS') {
            return res.status(200).json({
                success: true,
                bookingId: booking.bookingId,
                paymentStatus: 'SUCCESS',
                paidAmount: Number(booking.paidAmount || 0),
                paymentMethod: booking.paymentMethod || 'Cashfree',
                fare: Number(booking.fare || 0),
                advance: Number(booking.advance || 0),
                dueFare: Number(booking.dueFare || 0),
                booking: formatBooking(booking)
            });
        }

        // ----------------------------------------------------
        // Cashfree order must exist
        // ----------------------------------------------------

        if (!booking.cashfreeOrderId) {
            return res.status(200).json({
                success: true,
                message: 'Cashfree order has not been created yet',
                bookingId: booking.bookingId,
                paymentStatus: booking.paymentStatus || 'PENDING',
                paidAmount: Number(booking.paidAmount || 0),
                fare: Number(booking.fare || 0),
                advance: Number(booking.advance || 0),
                dueFare: Number(booking.dueFare || 0),
                booking: formatBooking(booking)
            });
        }

        // ----------------------------------------------------
        // 1. Ask Cashfree for all payments for this order
        // ----------------------------------------------------

        let payments = [];
        try {
            const paymentsResponse = await fetch(
                `${CASHFREE_BASE_URL}/orders/${booking.cashfreeOrderId}/payments`,
                {
                    method: 'GET',
                    headers: {
                        'x-client-id': process.env.CASHFREE_APP_ID,
                        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
                        'x-api-version': CASHFREE_API_VERSION,
                        'Accept': 'application/json'
                    }
                }
            );

            if (paymentsResponse.ok) {
                payments = await paymentsResponse.json();
            } else {
                console.warn('[Cashfree] Payments fetch not ok:', paymentsResponse.status);
            }
        } catch (fetchErr) {
            console.error('[Cashfree] Error fetching payments:', fetchErr);
        }

        // ----------------------------------------------------
        // 2. Also ask Cashfree for order status directly
        // ----------------------------------------------------

        let isOrderPaid = false;
        let orderPaidAmount = 0;
        try {
            const orderResponse = await fetch(
                `${CASHFREE_BASE_URL}/orders/${booking.cashfreeOrderId}`,
                {
                    method: 'GET',
                    headers: {
                        'x-client-id': process.env.CASHFREE_APP_ID,
                        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
                        'x-api-version': CASHFREE_API_VERSION,
                        'Accept': 'application/json'
                    }
                }
            );

            if (orderResponse.ok) {
                const orderData = await orderResponse.json();
                console.log('[Cashfree] Order status details:', {
                    orderId: orderData.order_id,
                    status: orderData.order_status,
                    amount: orderData.order_amount
                });
                if (orderData.order_status === 'PAID') {
                    isOrderPaid = true;
                    orderPaidAmount = Number(orderData.order_amount || 0);
                }
            }
        } catch (orderErr) {
            console.error('[Cashfree] Error fetching order details:', orderErr);
        }

        console.log('[Cashfree] Payments array:', payments);

        // ----------------------------------------------------
        // SUCCESS CHECK
        // ----------------------------------------------------

        const successfulPayment = Array.isArray(payments)
            ? payments.find(p => p.payment_status === 'SUCCESS')
            : null;

        if (successfulPayment || isOrderPaid) {
            const paidAmount = Number(
                (successfulPayment && successfulPayment.payment_amount) ||
                orderPaidAmount ||
                booking.advance ||
                0
            );

            const dueFare = Math.max(0, Number(booking.fare) - paidAmount);
            const paymentMethod = (successfulPayment && (successfulPayment.payment_group || successfulPayment.payment_method)) || 'Cashfree';

            await booking.update({
                paymentStatus: 'SUCCESS',
                paidAmount: paidAmount,
                paymentMethod: paymentMethod,
                paymentDate: new Date(),
                status: 'Confirmed',
                dueFare: dueFare
            });

            return res.status(200).json({
                success: true,
                bookingId: booking.bookingId,
                paymentStatus: 'SUCCESS',
                paidAmount: paidAmount,
                paymentMethod: paymentMethod,
                fare: Number(booking.fare || 0),
                advance: Number(booking.advance || 0),
                dueFare: dueFare,
                booking: formatBooking(booking)
            });
        }

        // ----------------------------------------------------
        // PENDING CHECK
        // ----------------------------------------------------

        const pendingPayment = Array.isArray(payments)
            ? payments.find(p => p.payment_status === 'PENDING')
            : null;

        if (pendingPayment) {
            await booking.update({
                paymentStatus: 'PENDING'
            });

            return res.status(200).json({
                success: true,
                bookingId: booking.bookingId,
                paymentStatus: 'PENDING',
                paidAmount: Number(booking.paidAmount || 0),
                fare: Number(booking.fare || 0),
                advance: Number(booking.advance || 0),
                dueFare: Number(booking.dueFare || 0),
                booking: formatBooking(booking)
            });
        }

        // ----------------------------------------------------
        // FAILURE OR UNTRIED
        // ----------------------------------------------------

        const failedPayment = Array.isArray(payments)
            ? payments.find(p => p.payment_status === 'FAILED' || p.payment_status === 'USER_DROPPED' || p.payment_status === 'CANCELLED')
            : null;

        const finalPaymentStatus = failedPayment ? 'FAILED' : 'PENDING';

        await booking.update({
            paymentStatus: finalPaymentStatus
        });

        return res.status(200).json({
            success: true,
            bookingId: booking.bookingId,
            paymentStatus: finalPaymentStatus,
            paidAmount: Number(booking.paidAmount || 0),
            fare: Number(booking.fare || 0),
            advance: Number(booking.advance || 0),
            dueFare: Number(booking.dueFare || 0),
            booking: formatBooking(booking)
        });

    } catch (error) {
        console.error('[Cashfree] Payment status error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Unable to check payment status'
        });
    }
};