const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createBooking, listBookings, cancelBooking, getBookingDetail, completeBooking } = require('../../controllers/booking/booking.controller');

/**
 * @swagger
 * tags:
 *   name: Booking
 *   description: Booking operations for battery swaps
 */

router.use(authenticate);

/**
 * @swagger
 * /api/booking:
 *   post:
 *     summary: Create a booking
 *     description: Creates a pending booking for the authenticated user at a specific station and time.
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [station_id, vehicle_id, battery_id, scheduled_time]
 *             properties:
 *               station_id:
 *                 type: string
 *                 description: Target station ObjectId
 *               vehicle_id:
 *                 type: string
 *                 description: Vehicle ObjectId that belongs to the user
 *               battery_id:
 *                 type: string
 *                 description: Battery ObjectId that is available at the station
 *               scheduled_time:
 *                 type: string
 *                 format: date-time
 *                 description: ISO date-time when you plan to arrive
 *  
 *     responses:
 *       201:
 *         description: Booking created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/', createBooking);

/**
 * @swagger
 * /api/booking:
 *   get:
 *     summary: List my bookings
 *     tags: [Booking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bookings list
 *       401:
 *         description: Unauthorized
 */
router.get('/', listBookings);

/**
 * @swagger
 * /api/booking/{id}/cancel:
 *   put:
 *     summary: Cancel a booking
 *     tags: [Booking]
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
 *       404:
 *         description: Booking not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/cancel', cancelBooking);

/**
 * @swagger
 * /api/booking/{id}/complete:
 *   put:
 *     summary: Complete a booking (driver)
 *     tags: [Booking]
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
 *         description: Booking completed
 *       404:
 *         description: Booking not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/complete', completeBooking);

/**
 * @swagger
 * /api/booking/{id}:
 *   get:
 *     summary: Get booking detail
 *     tags: [Booking]
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
 *       404:
 *         description: Booking not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getBookingDetail);

module.exports = router;
