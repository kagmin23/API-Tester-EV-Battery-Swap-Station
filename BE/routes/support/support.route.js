const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createSupportRequest, listSupportRequests } = require('../../controllers/support/support.controller');

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Support requests
 */

router.use(authenticate);

/**
 * @swagger
 * /api/support/requests:
 *   post:
 *     summary: Create a support request
 *     description: Submits a support ticket with optional description and image URLs.
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, title]
 *             properties:
 *               bookingId:
 *                 type: string
 *                 description: Booking ID (only bookings with status 'completed' are allowed)
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 description: Support request title
 *               description:
 *                 type: string
 *                 description: Detailed description of the issue
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: Image URL
 *     responses:
 *       201:
 *         description: Support request created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     user:
 *                       type: string
 *                     booking:
 *                       type: object
 *                       properties:
 *                         bookingId:
 *                           type: string
 *                         scheduledTime:
 *                           type: string
 *                           format: date-time
 *                         status:
 *                           type: string
 *                         battery:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             serial:
 *                               type: string
 *                             model:
 *                               type: string
 *                             soh:
 *                               type: number
 *                             status:
 *                               type: string
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     images:
 *                       type: array
 *                       items:
 *                         type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/requests', createSupportRequest);

/**
 * @swagger
 * /api/support/requests:
 *   get:
 *     summary: List my support requests
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support requests list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       user:
 *                         type: string
 *                       booking:
 *                         type: object
 *                         properties:
 *                           bookingId:
 *                             type: string
 *                           scheduledTime:
 *                             type: string
 *                             format: date-time
 *                           status:
 *                             type: string
 *                           battery:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               serial:
 *                                 type: string
 *                               model:
 *                                 type: string
 *                               soh:
 *                                 type: number
 *                               status:
 *                                 type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       images:
 *                         type: array
 *                         items:
 *                           type: string
 *                       status:
 *                         type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/requests', listSupportRequests);

module.exports = router;
