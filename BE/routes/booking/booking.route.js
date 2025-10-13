const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createBooking, listBookings, cancelBooking, getBookingDetail } = require('../../controllers/booking/booking.controller');

router.use(authenticate);
router.post('/', createBooking);
router.get('/', listBookings);
router.put('/:id/cancel', cancelBooking);
router.get('/:id', getBookingDetail);

module.exports = router;
