const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { listMyTransactions, getMyTransaction, listStationTransactions, getStationTransaction, listAllTransactions, getTransaction } = require('../../controllers/transaction/transaction.controller');

// Driver endpoints
router.get('/me', authenticate, listMyTransactions);
router.get('/me/:id', authenticate, getMyTransaction);

// Staff endpoints (station-based)
router.get('/station', authenticate, authorizeRoles('staff', 'admin'), listStationTransactions); // ?stationId=&limit=
router.get('/station/:id', authenticate, authorizeRoles('staff', 'admin'), getStationTransaction);

// Admin endpoints
router.get('/admin', authenticate, authorizeRoles('admin'), listAllTransactions); // ?user_id=&station_id=&limit=
router.get('/admin/:id', authenticate, authorizeRoles('admin'), getTransaction);

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction queries for drivers, staff, and admins
 */

/**
 * @swagger
 * /api/transactions/me:
 *   get:
 *     summary: List my transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: My transactions
 */

/**
 * @swagger
 * /api/transactions/me/{id}:
 *   get:
 *     summary: Get my transaction detail
 *     tags: [Transactions]
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
 *         description: Transaction detail
 */

/**
 * @swagger
 * /api/transactions/station:
 *   get:
 *     summary: List transactions for a station
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Station transactions
 */

/**
 * @swagger
 * /api/transactions/station/{id}:
 *   get:
 *     summary: Get station transaction detail
 *     tags: [Transactions]
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
 *         description: Station transaction detail
 */

/**
 * @swagger
 * /api/transactions/admin:
 *   get:
 *     summary: List all transactions (admin)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: All transactions
 */

/**
 * @swagger
 * /api/transactions/admin/{id}:
 *   get:
 *     summary: Get a transaction (admin)
 *     tags: [Transactions]
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
 *         description: Transaction
 */

module.exports = router;
