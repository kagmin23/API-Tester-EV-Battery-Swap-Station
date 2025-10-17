const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { createBattery, getBattery, updateBattery, deleteBattery, listBatteriesAdmin, getModelBatteries } = require('../../controllers/battery/battery.controller');

/**
 * @swagger
 * tags:
 *   name: Batteries
 *   description: Battery management and lookup
 */

/**
 * @swagger
 * /api/batteries/model:
 *   get:
 *     summary: Public - Get all batteries
 *     tags: [Batteries]
 *     responses:
 *       200:
 *         description: List of all batteries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       serial:
 *                         type: string
 *                       model:
 *                         type: string
 *                       soh:
 *                         type: number
 *                       status:
 *                         type: string
 *                       station:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           stationName:
 *                             type: string
 *                           address:
 *                             type: string
 */
router.get('/model', getModelBatteries);

/**
 * @swagger
 * /api/batteries/{id}:
 *   get:
 *     summary: Public - Get battery by ID
 *     tags: [Batteries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Battery ObjectId
 *     responses:
 *       200:
 *         description: Battery details
 *       404:
 *         description: Battery not found
 */
router.get('/:id', getBattery);

// Protect admin battery management routes
router.use(authenticate, authorizeRoles('admin'));

/**
 * @swagger
 * /api/batteries:
 *   post:
 *     summary: Admin - Create a new battery
 *     tags: [Batteries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serial]
 *             properties:
 *               serial:
 *                 type: string
 *               model:
 *                 type: string
 *               soh:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [charging, full, faulty, in-use, idle]
 *               stationId:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               capacity_kWh:
 *                 type: number
 *               voltage:
 *                 type: number
 *     responses:
 *       201:
 *         description: Battery created
 *       400:
 *         description: Invalid input
 */
router.post('/', createBattery);

/**
 * @swagger
 * /api/batteries:
 *   get:
 *     summary: Admin - List batteries with filters and pagination
 *     tags: [Batteries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [charging, full, faulty, in-use, idle]
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sohMin
 *         schema:
 *           type: number
 *       - in: query
 *         name: sohMax
 *         schema:
 *           type: number
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, soh]
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Batteries list
 */
router.get('/', listBatteriesAdmin);

/**
 * @swagger
 * /api/batteries:
 *   post:
 *     summary: Admin - Create a new battery
 *     tags: [Batteries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serial]
 *             properties:
 *               serial:
 *                 type: string
 *               model:
 *                 type: string
 *               soh:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [charging, full, faulty, in-use, idle]
 *               stationId:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               capacity_kWh:
 *                 type: number
 *               voltage:
 *                 type: number
 *     responses:
 *       201:
 *         description: Battery created
 *       400:
 *         description: Invalid input
 */
router.post('/', createBattery);

/**
 * @swagger
 * /api/batteries/{id}:
 *   put:
 *     summary: Admin - Update battery
 *     tags: [Batteries]
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
 *               model:
 *                 type: string
 *               soh:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [charging, full, faulty, in-use, idle]
 *               stationId:
 *                 type: string
 *               manufacturer:
 *                 type: string
 *               capacity_kWh:
 *                 type: number
 *               voltage:
 *                 type: number
 *     responses:
 *       200:
 *         description: Battery updated
 *       404:
 *         description: Battery not found
 */
router.put('/:id', updateBattery);

/**
 * @swagger
 * /api/batteries/{id}:
 *   delete:
 *     summary: Admin - Delete a battery
 *     tags: [Batteries]
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
 *         description: Battery deleted
 *       404:
 *         description: Battery not found
 */
router.delete('/:id', deleteBattery);

module.exports = router;
