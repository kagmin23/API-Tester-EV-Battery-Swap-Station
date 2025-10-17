const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { listStations, getStation, transferBatteries, listFaultyBatteries, listComplaints, resolveComplaint, listCustomers, getCustomer, listStaff, upsertStaff, listBatteries, deleteStaff, listPlans, upsertPlan, reportsOverview, reportsUsage, aiPredictions, createStation, changeUserRole, changeUserStatus } = require('../../controllers/admin/admin.controller');

// Public endpoint: list stations is accessible to unauthenticated users (e.g., drivers)
router.get('/stations', listStations);

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
 * /api/admin/stations:
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
 * /api/admin/stations/{id}:
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
 * /api/admin/stations/transfer:
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
 *             required: [fromStationId, toStationId, batteryIds]
 *             properties:
 *               fromStationId:
 *                 type: string
 *               toStationId:
 *                 type: string
 *               batteryIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
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
 * /api/admin/batteries/faulty:
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
 * /api/admin/batteries:
 *   get:
 *     summary: List all batteries (admin)
 *     tags: [Admin]
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
 *           minimum: 0
 *           maximum: 100
 *       - in: query
 *         name: sohMax
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, soh]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Batteries list with pagination
 */
router.get('/batteries', listBatteries);
/**
 * @swagger
 * /api/admin/complaints:
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
 * /api/admin/complaints/{id}/resolve:
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               response:
 *                 type: string
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
 * /api/admin/customers:
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
 * /api/admin/customers/{id}:
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
 * /api/admin/staff:
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
 * /api/admin/staff:
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
 *             required: [fullName, email, phoneNumber]
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *                 description: Must start with 0 and have 10 digits
 *                 example: "0912345678"
 *               password:
 *                 type: string
 *                 minLength: 6
 *               stationId:
 *                 type: string
 *                 description: Optional station to assign the staff
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
 * /api/admin/staff/{id}:
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
 *             required: [fullName, email, phoneNumber]
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *                 description: Must start with 0 and have 10 digits
 *                 example: "0912345678"
 *               password:
 *                 type: string
 *                 minLength: 6
 *               stationId:
 *                 type: string
 *                 description: Optional station to assign the staff
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
 * /api/admin/staff/{id}:
 *   delete:
 *     summary: Delete a staff account
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
 *         description: Staff deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Staff not found
 */
router.delete('/staff/:id', deleteStaff);
/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     summary: Update a user's role (admin-only)
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
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, driver, staff]
 *     responses:
 *       200:
 *         description: User role updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/users/:id/role', changeUserRole);
/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   put:
 *     summary: Update a user's status (active/locked)
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, locked]
 *     responses:
 *       200:
 *         description: User status updated
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.put('/users/:id/status', changeUserStatus);
/**
 * @swagger
 * /api/admin/subscriptions/plans:
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
 * /api/admin/subscriptions/plans:
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
 *             required: [price]
 *             properties:
 *               subcriptionName:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               period:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               benefits:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [active, expired]
 *               duration_months:
 *                 type: integer
 *                 minimum: 1
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *               name:
 *                 type: string
 *                 description: Legacy field, mapped to subcriptionName
 *               active:
 *                 type: boolean
 *                 description: Legacy field, mapped to status
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
 * /api/admin/subscriptions/plans/{id}:
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
 *             properties:
 *               subcriptionName:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               period:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               benefits:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [active, expired]
 *               duration_months:
 *                 type: integer
 *                 minimum: 1
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *               name:
 *                 type: string
 *                 description: Legacy field, mapped to subcriptionName
 *               active:
 *                 type: boolean
 *                 description: Legacy field, mapped to status
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
 * /api/admin/reports/overview:
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
 * /api/admin/reports/usage:
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
 * /api/admin/ai/predictions:
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
