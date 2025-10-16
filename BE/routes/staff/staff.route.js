const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { dashboard, listStationBatteries, batteryDetail, batteryHistory, updateBattery, listSwapRequests, confirmSwapRequest, recordSwapReturn, createStationPayment, stationSwapHistory, me } = require('../../controllers/staff/staff.controller');

router.use(authenticate, authorizeRoles('staff', 'admin'));

router.get('/stations/:stationId/dashboard', dashboard);
router.get('/stations/:stationId/batteries', listStationBatteries);
router.get('/batteries/:id', batteryDetail);
router.get('/batteries/:id/history', batteryHistory);
router.put('/batteries/:id', updateBattery);
router.get('/swap/requests', listSwapRequests);
router.put('/swap/requests/:id/confirm', confirmSwapRequest);
router.put('/swap/returns/:id', recordSwapReturn);
router.post('/payments/station', createStationPayment);
router.get('/swap/history', stationSwapHistory);
router.get('/me', me);

/**
 * @swagger
 * tags:
 *   name: Staff
 *   description: Station staff operations
 */

router.use(authenticate, authorizeRoles('staff', 'admin'));

/**
 * @swagger
 * /api/staff/stations/{stationId}/dashboard:
 *   get:
 *     summary: Station dashboard metrics
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dashboard data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/stations/:stationId/dashboard', dashboard);

/**
 * @swagger
 * /api/staff/stations/{stationId}/batteries:
 *   get:
 *     summary: List station batteries
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Batteries list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/stations/:stationId/batteries', listStationBatteries);

/**
 * @swagger
 * /api/staff/batteries/{id}:
 *   get:
 *     summary: Get battery detail
 *     tags: [Staff]
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
 *         description: Battery detail
 *       404:
 *         description: Battery not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/batteries/:id', batteryDetail);

/**
 * @swagger
 * /api/staff/batteries/{id}/history:
 *   get:
 *     summary: Get battery history
 *     tags: [Staff]
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
 *         description: Battery history
 *       404:
 *         description: Battery not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/batteries/:id/history', batteryHistory);

/**
 * @swagger
 * /api/staff/batteries/{id}:
 *   put:
 *     summary: Update a battery
 *     description: Update status and/or SOH for a battery. Status must be one of charging, full, faulty, in-use, idle. SOH range 0-100.
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [charging, full, faulty, in-use, idle]
 *               soh:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Battery updated
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Battery not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put('/batteries/:id', updateBattery);

/**
 * @swagger
 * /api/staff/swap/requests:
 *   get:
 *     summary: List swap requests
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Swap requests
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/swap/requests', listSwapRequests);

/**
 * @swagger
 * /api/staff/swap/requests/{id}/confirm:
 *   put:
 *     summary: Confirm a swap request
 *     tags: [Staff]
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
 *         description: Request confirmed
 *       404:
 *         description: Request not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put('/swap/requests/:id/confirm', confirmSwapRequest);

/**
 * @swagger
 * /api/staff/swap/returns/{id}:
 *   put:
 *     summary: Record a returned swap battery
 *     tags: [Staff]
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
 *         description: Return recorded
 *       404:
 *         description: Swap not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put('/swap/returns/:id', recordSwapReturn);

/**
 * @swagger
 * /api/staff/payments/station:
 *   post:
 *     summary: Create a station payment record
 *     description: Records a cash payment at the station, optionally linked to a booking.
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stationId, amount]
 *             properties:
 *               stationId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               bookingId:
 *                 type: string
 *                 description: Optional booking to associate
 *     responses:
 *       201:
 *         description: Payment recorded
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/payments/station', createStationPayment);

/**
 * @swagger
 * /api/staff/swap/history:
 *   get:
 *     summary: Station swap history
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Swap history
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/swap/history', stationSwapHistory);

module.exports = router;

/**
 * @swagger
 * /api/staff/me:
 *   get:
 *     summary: Get current staff profile and assigned station
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff info with assigned station
 */
