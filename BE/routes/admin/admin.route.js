const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { listStations, getStation, transferBatteries, listFaultyBatteries, listComplaints, resolveComplaint, listCustomers, getCustomer, listStaff, upsertStaff, listPlans, upsertPlan, reportsOverview, reportsUsage, aiPredictions, createStation, changeUserRole } = require('../../controllers/admin/admin.controller');

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
 * /admin/stations:
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
 * /admin/stations:
 *   post:
 *     summary: Create a station
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
 *       201:
 *         description: Station created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/stations', createStation);
/**
 * @swagger
 * /admin/stations/{id}:
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
 * /admin/stations/transfer:
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
 * /admin/batteries/faulty:
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
 * /admin/complaints:
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
 * /admin/complaints/{id}/resolve:
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
 * /admin/customers:
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
 * /admin/customers/{id}:
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
 * /admin/staff:
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
 * /admin/staff:
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
 * /admin/staff/{id}:
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
 * /admin/users/{id}/role:
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
 * /admin/subscriptions/plans:
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
 * /admin/subscriptions/plans:
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
 * /admin/subscriptions/plans/{id}:
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
 * /admin/reports/overview:
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
 * /admin/reports/usage:
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
 * /admin/ai/predictions:
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
