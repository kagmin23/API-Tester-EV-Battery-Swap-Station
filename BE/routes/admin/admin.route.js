const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { listStations, getStation, transferBatteries, listFaultyBatteries, listComplaints, resolveComplaint, listCustomers, getCustomer, listStaff, upsertStaff, listPlans, upsertPlan, reportsOverview, reportsUsage, aiPredictions, createStation } = require('../../controllers/admin/admin.controller');

router.use(authenticate, authorizeRoles('admin'));

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management APIs
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * api/admin/stations:
 *   get:
 *     summary: List all stations
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of stations
 *       401:
 *         description: Unauthorized
 */
router.get('/stations', listStations);
/**
 * @swagger
 * /api/admin/stations:
 *   post:
 *     summary: Create a new station
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []        # Nếu cần JWT xác thực
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stationName:
 *                 type: string
 *                 description: Name of the station (min length 2)
 *                 example: "Battery Hub District 1"
 *               address:
 *                 type: string
 *                 description: Full address of the station
 *                 example: "123 Nguyen Trai, District 1"
 *               city:
 *                 type: string
 *                 description: City where the station is located
 *                 example: "Ho Chi Minh City"
 *               district:
 *                 type: string
 *                 description: District of the station
 *                 example: "District 1"
 *               map_url:
 *                 type: string
 *                 format: url
 *                 description: Google Map URL of the station
 *                 example: "https://goo.gl/maps/abc123"
 *               capacity:
 *                 type: integer
 *                 description: Maximum number of batteries the station can hold
 *                 example: 100
 *               lat:
 *                 type: number
 *                 description: Latitude coordinate of the station
 *                 example: 10.762622
 *               lng:
 *                 type: number
 *                 description: Longitude coordinate of the station
 *                 example: 106.660172
 *     responses:
 *       201:
 *         description: Station created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Station created
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "670e8c2036e4c918f5aa7b32"
 *                     stationName:
 *                       type: string
 *                       example: "Battery Hub District 1"
 *                     address:
 *                       type: string
 *                       example: "123 Nguyen Trai, District 1"
 *                     city:
 *                       type: string
 *                       example: "Ho Chi Minh City"
 *                     district:
 *                       type: string
 *                       example: "District 1"
 *                     map_url:
 *                       type: string
 *                       example: "https://goo.gl/maps/abc123"
 *                     capacity:
 *                       type: integer
 *                       example: 100
 *                     sohAvg:
 *                       type: number
 *                       example: 100
 *                     availableBatteries:
 *                       type: integer
 *                       example: 0
 *                     location:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           example: "Point"
 *                         coordinates:
 *                           type: array
 *                           items:
 *                             type: number
 *                           example: [106.660172, 10.762622]
 *       400:
 *         description: Invalid input or validation error
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
 *                   example: Invalid input
 */

router.post('/stations', createStation);
/**
 * @swagger
 * api/admin/stations/{id}:
 *   get:
 *     summary: Get station details
 *     tags: [Admin]
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
 *         description: Station details
 *       404:
 *         description: Station not found
 *       401:
 *         description: Unauthorized
 */
router.get('/stations/:id', getStation);
/**
 * @swagger
 * api/admin/stations/transfer:
 *   post:
 *     summary: Transfer batteries between stations
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Transfer executed
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/stations/transfer', transferBatteries);
/**
 * @swagger
 * api/admin/batteries/faulty:
 *   get:
 *     summary: List faulty batteries
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of faulty batteries
 *       401:
 *         description: Unauthorized
 */
router.get('/batteries/faulty', listFaultyBatteries);
/**
 * @swagger
 * api/admin/complaints:
 *   get:
 *     summary: List customer complaints
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of complaints
 *       401:
 *         description: Unauthorized
 */
router.get('/complaints', listComplaints);
/**
 * @swagger
 * api/admin/complaints/{id}/resolve:
 *   put:
 *     summary: Resolve a complaint
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *     responses:
 *       200:
 *         description: Complaint resolved
 *       404:
 *         description: Complaint not found
 *       401:
 *         description: Unauthorized
 */
router.put('/complaints/:id/resolve', resolveComplaint);
/**
 * @swagger
 * api/admin/customers:
 *   get:
 *     summary: List customers
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of customers
 *       401:
 *         description: Unauthorized
 */
router.get('/customers', listCustomers);
/**
 * @swagger
 * api/admin/customers/{id}:
 *   get:
 *     summary: Get customer details
 *     tags: [Admin]
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
 *         description: Customer details
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 */
router.get('/customers/:id', getCustomer);
/**
 * @swagger
 * api/admin/staff:
 *   get:
 *     summary: List staff
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of staff
 *       401:
 *         description: Unauthorized
 */
router.get('/staff', listStaff);
/**
 * @swagger
 * api/admin/staff:
 *   post:
 *     summary: Create or update a staff member
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Staff upserted
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/staff', upsertStaff);
/**
 * @swagger
 * api/admin/staff/{id}:
 *   put:
 *     summary: Update a staff member
 *     tags: [Admin]
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
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Staff updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Staff not found
 */
router.put('/staff/:id', upsertStaff);
/**
 * @swagger
 * api/admin/subscriptions/plans:
 *   get:
 *     summary: List subscription plans
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of plans
 *       401:
 *         description: Unauthorized
 */
router.get('/subscriptions/plans', listPlans);
/**
 * @swagger
 * api/admin/subscriptions/plans:
 *   post:
 *     summary: Create or update a subscription plan
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Plan upserted
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/subscriptions/plans', upsertPlan);
/**
 * @swagger
 * api/admin/subscriptions/plans/{id}:
 *   put:
 *     summary: Update a subscription plan
 *     tags: [Admin]
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
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Plan updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Plan not found
 */
router.put('/subscriptions/plans/:id', upsertPlan);
/**
 * @swagger
 * api/admin/reports/overview:
 *   get:
 *     summary: Get overview reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview metrics
 *       401:
 *         description: Unauthorized
 */
router.get('/reports/overview', reportsOverview);
/**
 * @swagger
 * api/admin/reports/usage:
 *   get:
 *     summary: Get usage reports
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage metrics
 *       401:
 *         description: Unauthorized
 */
router.get('/reports/usage', reportsUsage);
/**
 * @swagger
 * api/admin/ai/predictions:
 *   get:
 *     summary: Get AI predictions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prediction results
 *       401:
 *         description: Unauthorized
 */
router.get('/ai/predictions', aiPredictions);

module.exports = router;
