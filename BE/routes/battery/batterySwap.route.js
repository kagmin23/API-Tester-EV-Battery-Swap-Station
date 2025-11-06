const express = require('express');
const router = express.Router();

const {
    createPillar,
    getPillarsByStation,
    initiateSwap,
    getAvailableSlots,
    insertOldBattery,
    completeSwap,
    getSwapHistory,
    getPillarSlots,
    assignBatteryToSlot,
    removeBatteryFromSlot
} = require('../../controllers/battery/batterySwap.controller');
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');

router.use(authenticate)
/**
 * @swagger
 * tags:
 *   - name: BatteryPillar
 *     description: Manage battery pillars
 *   - name: BatterySlot
 *     description: Manage battery slots
 *   - name: BatterySwap
 *     description: Manage battery swap process
 */

// ==================== PILLAR ROUTES ====================

/**
 * @swagger
 * /api/battery-swap/pillars:
 *   post:
 *     summary: create new pillars (Admin only)
 *     tags: [BatteryPillar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stationId
 *               - pillarName
 *               - pillarNumber
 *             properties:
 *               stationId:
 *                 type: string
 *               pillarName:
 *                 type: string
 *               pillarNumber:
 *                 type: number
 *               totalSlots:
 *                 type: number
 *                 default: 10
 *     responses:
 *       201:
 *         description: Pillar created successfully with slots initialized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Tạo trụ pin thành công
 *                 pillar:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     pillarCode:
 *                       type: string
 *                       example: ABC123-P01
 *                     pillarName:
 *                       type: string
 *                     pillarNumber:
 *                       type: number
 *                     totalSlots:
 *                       type: number
 *                     status:
 *                       type: string
 *                       example: active
 *                     slotStats:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         occupied:
 *                           type: number
 *                         empty:
 *                           type: number
 *                         reserved:
 *                           type: number
 *       400:
 *         description: Bad request - Pillar number already exists
 *       404:
 *         description: Station not found
 *       500:
 *         description: Server error
 */
router.post('/pillars', authorizeRoles('admin'), createPillar);

/**
 * @swagger
 * /api/battery-swap/pillars/station/{stationId}:
 *   get:
 *     summary: Get list of battery pillars by station
 *     tags: [BatteryPillar]
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, maintenance, error]
 *     responses:
 *       200:
 *         description: List of pillars with their slots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lấy danh sách trụ pin thành công
 *                 pillars:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       pillarName:
 *                         type: string
 *                       pillarCode:
 *                         type: string
 *                       pillarNumber:
 *                         type: number
 *                       status:
 *                         type: string
 *                       slotStats:
 *                         type: object
 *                       slots:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             slotNumber:
 *                               type: number
 *                             status:
 *                               type: string
 *                             battery:
 *                               type: object
 *                               nullable: true
 *       500:
 *         description: Server error
 */
router.get('/pillars/station/:stationId', getPillarsByStation);

/**
 * @swagger
 * /api/battery-swap/pillars/{pillarId}/slots:
 *   get:
 *     summary: get status of slots in a pillar
 *     tags: [BatterySlot]
 *     parameters:
 *       - in: path
 *         name: pillarId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pillar information with detailed slot status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lấy trạng thái slot thành công
 *                 pillar:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     pillarCode:
 *                       type: string
 *                     pillarName:
 *                       type: string
 *                     status:
 *                       type: string
 *                     slotStats:
 *                       type: object
 *                 slots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       slotNumber:
 *                         type: number
 *                       status:
 *                         type: string
 *                       battery:
 *                         type: object
 *                         nullable: true
 *                       reservation:
 *                         type: object
 *                         nullable: true
 *       404:
 *         description: Pillar not found
 *       500:
 *         description: Server error
 */
router.get('/pillars/:pillarId/slots', getPillarSlots);

// ==================== SLOT ROUTES ====================

/**
 * @swagger
 * /api/battery-swap/slots/available:
 *   get:
 *     summary: Find available slots for swapping
 *     tags: [BatterySlot]
 *     parameters:
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *       - in: query
 *         name: pillarId
 *         schema:
 *           type: string
 *       - in: query
 *         name: needEmpty
 *         schema:
 *           type: boolean
 *         description: if true, only return completely empty slots
 *     responses:
 *       200:
 *         description: List of available slots
 *         content:
 *           application/json:
/**
 * @swagger
 * /api/battery-swap/swap/initiate:
 *   post:
 *     summary: start battery swap process
 *     tags: [BatterySwap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - vehicleId
 *               - stationId
 *             properties:
 *               userId:
 *                 type: string
 *               vehicleId:
 *                 type: string
 *               stationId:
 *                 type: string
 *               bookingId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Swap initiated successfully with instructions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Khởi tạo giao dịch đổi pin thành công
 *                 swapId:
 *                   type: string
 *                   example: SWAP-1730880000000-ABC123XYZ
 *                 instructions:
 *                   type: object
 *                   properties:
 *                     step1:
 *                       type: string
 *                     step2:
 *                       type: string
 *                     step3:
 *                       type: string
 *                     step4:
 *                       type: string
 *                 emptySlot:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     slotNumber:
 *                       type: number
 *                     pillarName:
 *                       type: string
 *                 newBattery:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     serial:
 *                       type: string
 *                     slotNumber:
 *                       type: number
 *                     charge:
 *                       type: number
 *                     soh:
 *                       type: number
 *       400:
 *         description: No empty slot or no battery available
 *       500:
 *         description: Server error
 */
router.post('/swap/initiate', initiateSwap);
router.get('/slots/available', getAvailableSlots);

// ==================== SWAP ROUTES ====================

/**
 * @swagger
 * /api/battery-swap/swap/initiate:
 *   post:
 *     summary: start battery swap process
 *     tags: [BatterySwap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - vehicleId
 *               - stationId
 *             properties:
 *               userId:
 *                 type: string
 *               vehicleId:
 *                 type: string
 *               stationId:
 *                 type: string
 *               bookingId:
 *                 type: string
 */
router.post('/swap/initiate', initiateSwap);

/**
 * @swagger
 * /api/battery-swap/swap/insert-old-battery:
 *   post:
 *     summary: Insert old battery information after swap
 *     tags: [BatterySwap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - swapId
 *               - oldBatterySerial
 *               - slotId
 *             properties:
 *               swapId:
 *                 type: string
 *               oldBatterySerial:
 *                 type: string
 *               slotId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Old battery inserted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Đã nhận pin cũ. Vui lòng lấy pin mới.
 *                 swapId:
 *                   type: string
 *                 oldBattery:
 *                   type: object
 *                   properties:
 *                     serial:
 *                       type: string
 *                     slotNumber:
 *                       type: number
 *                 nextStep:
 *                   type: string
 *       400:
 *         description: Invalid swap status
 *       404:
 *         description: Swap or slot not found
 *       500:
 *         description: Server error
 */
router.post('/swap/insert-old-battery', insertOldBattery);

/**
 * @swagger
 * /api/battery-swap/swap/complete:
 *   post:
 *     summary: Complete the battery swap process
 *     tags: [BatterySwap]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - swapId
 *             properties:
 *               swapId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Swap completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Đổi pin thành công!
 *                 swapId:
 *                   type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     oldBattery:
 *                       type: string
 *                     newBattery:
 *                       type: string
 *                     newBatteryCharge:
 *                       type: number
 *                     swapDuration:
 *                       type: number
 *                       description: Duration in seconds
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid swap status
 *       404:
 *         description: Swap not found
 *       500:
 *         description: Server error
 */
router.post('/swap/complete', completeSwap);

/**
 * @swagger
 * /api/battery-swap/swap/history:
 *   get:
 *     summary: Get battery swap history with filters and pagination
 *     tags: [BatterySwap]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *     responses:
 *       200:
 *         description: Swap history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lấy lịch sử đổi pin thành công
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       swapId:
 *                         type: string
 *                       user:
 *                         type: object
 *                         properties:
 *                           username:
 *                             type: string
 *                           email:
 *                             type: string
 *                       station:
 *                         type: object
 *                       pillar:
 *                         type: object
 *                       oldBattery:
 *                         type: object
 *                       newBattery:
 *                         type: object
 *                       status:
 *                         type: string
 *                       swapTime:
 *                         type: string
 *                         format: date-time
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                       metadata:
 *                         type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *       500:
 *         description: Server error
 */
router.get('/swap/history', getSwapHistory);

// ==================== STAFF SLOT MANAGEMENT ====================

/**
 * @swagger
 * /api/battery-swap/slots/assign-battery:
 *   post:
 *     summary: Staff - Assign battery to slot (only at assigned station)
 *     description: Staff can only assign batteries to slots at their assigned station. Admin has full access to all stations.
 *     tags: [BatterySlot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - batteryId
 *               - slotId
 *             properties:
 *               batteryId:
 *                 type: string
 *                 description: Battery ObjectId to assign
 *                 example: 673b1234567890abcdef0021
 *               slotId:
 *                 type: string
 *                 description: Slot ObjectId to assign battery to
 *                 example: 690cd37ffc11f988150b30b7
 *     responses:
 *       200:
 *         description: Battery assigned to slot successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Gán pin vào slot thành công
 *                 battery:
 *                   type: object
 *                   properties:
 *                     serial:
 *                       type: string
 *                       example: BAT-001
 *                     model:
 *                       type: string
 *                       example: LiFePO4-48V-100Ah
 *                     soh:
 *                       type: number
 *                       example: 95
 *                     status:
 *                       type: string
 *                       example: full
 *                 slot:
 *                   type: object
 *                   properties:
 *                     slotNumber:
 *                       type: number
 *                       example: 1
 *                     slotCode:
 *                       type: string
 *                       example: 9B4445-P01-S01
 *                     pillarName:
 *                       type: string
 *                       example: Pillar A
 *                     stationName:
 *                       type: string
 *                       example: EV Station District 7
 *       400:
 *         description: Battery already in slot or slot already occupied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Pin đang ở trong slot khác. Vui lòng lấy pin ra trước.
 *       403:
 *         description: Staff not assigned to station or trying to access different station
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bạn chỉ có quyền quản lý slot tại trạm được phân công.
 *       404:
 *         description: Battery or slot not found
 *       500:
 *         description: Server error
 */
router.post('/slots/assign-battery', authorizeRoles('admin', 'staff'), assignBatteryToSlot);

/**
 * @swagger
 * /api/battery-swap/slots/remove-battery:
 *   post:
 *     summary: Staff - Remove battery from slot (only at assigned station)
 *     description: Staff can only remove batteries from slots at their assigned station. Admin has full access to all stations.
 *     tags: [BatterySlot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - slotId
 *             properties:
 *               slotId:
 *                 type: string
 *                 description: Slot ObjectId to remove battery from
 *                 example: 690cd37ffc11f988150b30b7
 *     responses:
 *       200:
 *         description: Battery removed from slot successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lấy pin ra khỏi slot thành công
 *                 battery:
 *                   type: object
 *                   properties:
 *                     serial:
 *                       type: string
 *                       example: BAT-001
 *                     model:
 *                       type: string
 *                       example: LiFePO4-48V-100Ah
 *                     soh:
 *                       type: number
 *                       example: 95
 *                     status:
 *                       type: string
 *                       example: full
 *                 slot:
 *                   type: object
 *                   properties:
 *                     slotNumber:
 *                       type: number
 *                       example: 1
 *                     slotCode:
 *                       type: string
 *                       example: 9B4445-P01-S01
 *                     pillarName:
 *                       type: string
 *                       example: Pillar A
 *                     stationName:
 *                       type: string
 *                       example: EV Station District 7
 *                     status:
 *                       type: string
 *                       example: empty
 *       400:
 *         description: Slot is empty or reserved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Slot đang trống. Không có pin để lấy ra.
 *       403:
 *         description: Staff not assigned to station or trying to access different station
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bạn chỉ có quyền quản lý slot tại trạm được phân công.
 *       404:
 *         description: Slot not found
 *       500:
 *         description: Server error
 */
router.post('/slots/remove-battery', authorizeRoles('admin', 'staff'), removeBatteryFromSlot);

module.exports = router;
