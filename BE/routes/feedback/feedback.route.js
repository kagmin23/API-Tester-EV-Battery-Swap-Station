const express = require('express');
const router = express.Router();
const feedbackController = require('../../controllers/feedback/feedback.controller');
const { authenticate } = require('../../middlewares/auth/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Feedback
 *   description: Feedback APIs
 */
/**
 * @swagger
 * /api/feedback/requests:
 *   post:
 *     summary: Create feedback for a completed booking (only booking owner)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, rating]
 *             properties:
 *               bookingId:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Feedback created
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Duplicate feedback
 */
router.post('/requests', authenticate, feedbackController.createFeedback);

/**
 * @swagger
 * /api/feedback/requests:
 *   get:
 *     summary: Public - list all feedbacks
 *     tags: [Feedback]
 *     responses:
 *       200:
 *         description: A list of feedbacks
 */
router.get('/requests', feedbackController.getAllFeedbacks);

/**
 * @swagger
 * /api/feedback/requests/station/{stationId}:
 *   get:
 *     summary: Public - list feedbacks for a specific station (by bookings at that station)
 *     tags: [Feedback]
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of feedbacks for the station
 */
router.get('/requests/station/:stationId', feedbackController.getFeedbacksByStation);

/**
 * @swagger
 * /api/feedback/requests/booking/{bookingId}:
 *   get:
 *     summary: Authenticated - get current user's feedback for a specific booking
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback for the booking by the current user
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Feedback not found
 */
router.get('/requests/booking/:bookingId', authenticate, feedbackController.getMyFeedbackByBooking);

module.exports = router;
