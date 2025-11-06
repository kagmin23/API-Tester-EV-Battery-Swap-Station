const express = require("express");
const router = express.Router();
const {
  authenticate,
  authorizeRoles,
} = require("../../middlewares/auth/auth.middleware");
const {
  createBattery,
  getBattery,
  getBatteryById,
  updateBattery,
  deleteBattery,
  listBatteriesAdmin,
  getModelBatteries,
  getBatteriesByStation,
  updateStationBatteryCounts,
  updateAllStationsBatteryCounts,
  getStationBatteryManagement,
  getBatteryLogAdmin,
  getAllBatteryLogsAdmin,
} = require("../../controllers/battery/battery.controller");

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
 *               required: [serial, price]
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
 *                       price:
 *                         type: number
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

router.get("/model", getModelBatteries);

/**
 * @swagger
 * /api/batteries/{id}:
 *   get:
 *     summary: Public - Get battery by ID with formatted response
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
 *         description: Battery details with formatted response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     battery_id:
 *                       type: string
 *                     serial:
 *                       type: string
 *                     model:
 *                       type: string
 *                     soh:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [charging, full, faulty, in-use, idle, is-booking]
 *                     manufacturer:
 *                       type: string
 *                     capacity_kWh:
 *                       type: number
 *                     voltage:
 *                       type: number
 *                     price:
 *                       type: number
 *                     station:
 *                       type: object
 *                       properties:
 *                         station_id:
 *                           type: string
 *                         station_name:
 *                           type: string
 *                         address:
 *                           type: string
 *                         city:
 *                           type: string
 *                         district:
 *                           type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Battery not found
 */
router.get("/:id", getBatteryById);

/**
 * @swagger
 * /api/batteries/station/{stationId}:
 *   get:
 *     summary: Public - Get all batteries in a specific station
 *     tags: [Batteries]
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ObjectId
 *     responses:
 *       200:
 *         description: Batteries list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     station:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         address:
 *                           type: string
 *                         city:
 *                           type: string
 *                         district:
 *                           type: string
 *                     batteries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           serial:
 *                             type: string
 *                           model:
 *                             type: string
 *                           soh:
 *                             type: number
 *                           status:
 *                             type: string
 *                             enum: [charging, full, faulty, in-use, idle]
 *                           manufacturer:
 *                             type: string
 *                           capacity_kWh:
 *                             type: number
 *                           voltage:
 *                             type: number
 *                     grouped:
 *                       type: object
 *                       properties:
 *                         available:
 *                           type: array
 *                         charging:
 *                           type: array
 *                         inUse:
 *                           type: array
 *                         faulty:
 *                           type: array
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         available:
 *                           type: number
 *                         charging:
 *                           type: number
 *                         inUse:
 *                           type: number
 *                         faulty:
 *                           type: number
 *                         averageSoh:
 *                           type: number
 *       404:
 *         description: Station not found
 */
router.get("/station/:stationId", getBatteriesByStation);

/**
 * @swagger
 * /api/batteries/station/{stationId}/management:
 *   get:
 *     summary: Public - Get station battery management info
 *     tags: [Batteries]
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ObjectId
 *     responses:
 *       200:
 *         description: Station battery management information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     station:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         address:
 *                           type: string
 *                         city:
 *                           type: string
 *                         district:
 *                           type: string
 *                     capacity:
 *                       type: object
 *                       properties:
 *                         maxCapacity:
 *                           type: number
 *                         currentTotal:
 *                           type: number
 *                         utilizationPercentage:
 *                           type: number
 *                         availableSlots:
 *                           type: number
 *                     batteryCounts:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         available:
 *                           type: number
 *                         charging:
 *                           type: number
 *                         inUse:
 *                           type: number
 *                         faulty:
 *                           type: number
 *                     health:
 *                       type: object
 *                       properties:
 *                         averageSoh:
 *                           type: number
 *                         healthScore:
 *                           type: number
 *                         status:
 *                           type: string
 *                           enum: [Excellent, Good, Fair, Poor]
 *                     batteries:
 *                       type: array
 *                       items:
 *                         type: object
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Station not found
 */
router.get("/station/:stationId/management", getStationBatteryManagement);

/**
 * @swagger
 * /api/batteries/station/{stationId}/available:
 *   get:
 *     summary: Public - Get available batteries for booking at a station
 *     tags: [Batteries]
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ObjectId
 *       - in: query
 *         name: scheduledTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Optional scheduled time to check for conflicts
 *     responses:
 *       200:
 *         description: List of available batteries for booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     station:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         address:
 *                           type: string
 *                         city:
 *                           type: string
 *                         district:
 *                           type: string
 *                     availableBatteries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           serial:
 *                             type: string
 *                           model:
 *                             type: string
 *                           soh:
 *                             type: number
 *                           status:
 *                             type: string
 *                           manufacturer:
 *                             type: string
 *                           capacity_kWh:
 *                             type: number
 *                           price:
 *                             type: number
 *                           voltage:
 *                             type: number
 *                           healthStatus:
 *                             type: string
 *                             enum: [Excellent, Good, Fair, Poor]
 *                     totalAvailable:
 *                       type: number
 *                     scheduledTime:
 *                       type: string
 *                       format: date-time
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Station not found
 */

// Protect admin battery management routes
router.use(authenticate, authorizeRoles("admin", "staff"));

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
 *             required: [serial, price]
 *             properties:
 *               serial:
 *                 type: string
 *                 description: Battery serial number (unique)
 *               price:
 *                 type: number
 *                 description: Battery price in VND
 *                 example: 5000000
 *               model:
 *                 type: string
 *                 description: Battery model name
 *               soh:
 *                 type: number
 *                 description: State of Health (0-100)
 *                 example: 95
 *               status:
 *                 type: string
 *                 enum: [charging, full, faulty, in-use, idle, is-booking]
 *                 description: Battery status
 *               stationId:
 *                 type: string
 *                 description: Station ID where battery is located
 *               manufacturer:
 *                 type: string
 *                 description: Battery manufacturer
 *                 example: BYD
 *               capacity_kWh:
 *                 type: number
 *                 description: Battery capacity in kWh
 *                 example: 4.8
 *               voltage:
 *                 type: number
 *                 description: Battery voltage
 *                 example: 48
 *     responses:
 *       201:
 *         description: Battery created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     serial:
 *                       type: string
 *                     price:
 *                       type: number
 *                     model:
 *                       type: string
 *                     soh:
 *                       type: number
 *                     status:
 *                       type: string
 *                     station:
 *                       type: string
 *                     manufacturer:
 *                       type: string
 *                     capacity_kWh:
 *                       type: number
 *                     voltage:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input or serial already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Serial already exists
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */
router.post("/", createBattery);

// Admin: get battery logs (history) — includes parsed driver info when available
/**
 * @swagger
 * /api/batteries/{id}/logs:
 *   get:
 *     summary: Admin - Get battery logs and history
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
 *         description: Battery logs and history
 *       404:
 *         description: Battery not found
 */
router.get('/:id/logs', authenticate, authorizeRoles('admin'), getBatteryLogAdmin);

/**
 * @swagger
 * /api/batteries/logs:
 *   get:
 *     summary: Admin - Get all battery logs (with filters)
 *     tags: [Batteries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *         description: Filter by station id
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action (check-in, check-out, swap, repair, return)
 *       - in: query
 *         name: batteryId
 *         schema:
 *           type: string
 *         description: Filter by battery id
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Page size (default 50)
 *     responses:
 *       200:
 *         description: List of battery logs
 *       401:
 *         description: Unauthorized
 */
router.get('/logs', authenticate, authorizeRoles('admin'), getAllBatteryLogsAdmin);

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
router.get("/", listBatteriesAdmin);

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
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Battery updated
 *       404:
 *         description: Battery not found
 */
router.put("/:id", updateBattery);

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
router.delete("/:id", deleteBattery);

/**
 * @swagger
 * /api/batteries/station/{stationId}/update-counts:
 *   put:
 *     summary: Admin - Update battery counts for a specific station
 *     tags: [Batteries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Station ObjectId
 *     responses:
 *       200:
 *         description: Battery counts updated successfully
 *       404:
 *         description: Station not found
 */
router.put("/station/:stationId/update-counts", updateStationBatteryCounts);

/**
 * @swagger
 * /api/batteries/update-all-counts:
 *   put:
 *     summary: Admin - Update battery counts for all stations
 *     tags: [Batteries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All stations battery counts updated successfully
 */
router.put("/update-all-counts", updateAllStationsBatteryCounts);

module.exports = router;
