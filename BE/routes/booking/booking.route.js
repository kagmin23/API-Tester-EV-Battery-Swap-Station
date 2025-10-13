const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createBooking, listBookings, cancelBooking, getBookingDetail } = require('../../controllers/booking/booking.controller');

router.use(authenticate);
router.post('/', createBooking);
router.get('/', listBookings);
router.put('/:id/cancel', cancelBooking);
router.get('/:id', getBookingDetail);

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Booking operations for battery swaps
 */

/**
 * @swagger
 * /api/booking:
 *   post:
 *     summary: Create a booking
 *     description: Creates a pending booking for the authenticated user at a specific station and time.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [station_id, scheduled_time]
 *             properties:
 *               station_id:
 *                 type: string
 *                 description: Target station ObjectId
 *               scheduled_time:
 *                 type: string
 *                 format: date-time
 *                 description: ISO date-time when you plan to arrive
 *               notes:
 *                 type: string
 *                 description: Optional note for staff
 *     responses:
 *       201:
 *         description: Booking created
 */

/**
 * @swagger
 * /api/booking:
 *   get:
 *     summary: List my bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bookings list
 */

/**
 * @swagger
 * /api/booking/{id}/cancel:
 *   put:
 *     summary: Cancel a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking canceled
 */

/**
 * @swagger
 * /api/booking/{id}:
 *   get:
 *     summary: Get booking detail
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking detail
 */

module.exports = router;
