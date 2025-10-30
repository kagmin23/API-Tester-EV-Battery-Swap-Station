const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { createSupportRequest, listSupportRequests, adminListAllSupportRequests, resolveSupportRequest, completeSupportRequest, closeSupportRequest, getSupportRequestsByStation } = require('../../controllers/support/support.controller');

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

/**
 * @swagger
 * /api/support/admin/requests:
 *   get:
 *     summary: Admin list all support requests
 *     description: Returns all support requests. Admins and staff can filter by status using the `status` query param.
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [in-progress, resolved, completed, closed]
 *         description: Filter by ticket status
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
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
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
 *                       resolvedBy:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                       resolveNote:
 *                         type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */

// Admin: list all support requests
router.get('/admin/requests', authorizeRoles('admin', 'staff'), adminListAllSupportRequests);

/**
 * @swagger
 * /api/support/station/{id}/requests:
 *   get:
 *     summary: List support requests for a station
 *     description: Admin can list support requests for any station. Staff can list requests only for their assigned station.
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Station id
 *     responses:
 *       200:
 *         description: Support requests list for station
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (staff not assigned to station)
 */
router.get('/station/:id/requests', authorizeRoles('admin', 'staff'), getSupportRequestsByStation);

// Admin: resolve a support request (admin only)
router.patch('/requests/:id/resolve', authorizeRoles('admin'), resolveSupportRequest);

/**
 * @swagger
 * /api/support/requests/{id}/resolve:
 *   patch:
 *     summary: Resolve a support request
 *     description: Admin marks an in-progress ticket as resolved and may include an optional note visible to driver/staff. (Admin only)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Support request id
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolveNote:
 *                 type: string
 *                 description: Optional note from admin/staff when resolving
 *     responses:
 *       200:
 *         description: Support request resolved
 *       400:
 *         description: Invalid request or wrong status
 *       401:
 *         description: Unauthorized
 */

// Driver (owner) marks completed
/**
 * @swagger
 * /api/support/requests/{id}/complete:
 *   patch:
 *     summary: Driver marks a resolved support request as completed
 *     description: Only the ticket owner (driver) can mark a resolved ticket as completed.
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Support request id
 *     responses:
 *       200:
 *         description: Support request completed
 *       400:
 *         description: Invalid request or wrong status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch('/requests/:id/complete', authenticate, completeSupportRequest);

// Staff/Admin: close a completed request
/**
 * @swagger
 * /api/support/requests/{id}/close:
 *   patch:
 *     summary: Staff/Admin closes a resolved or completed support request
 *     description: Staff or admin marks a resolved or completed support request as closed. A `closeNote` is required and will be visible to the driver.
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Support request id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [closeNote]
 *             properties:
 *               closeNote:
 *                 type: string
 *                 description: Note visible to the driver when closing the ticket
 *     responses:
 *       200:
 *         description: Support request closed
 *       400:
 *         description: Invalid request or wrong status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch('/requests/:id/close', authorizeRoles('staff', 'admin'), closeSupportRequest);

module.exports = router;
