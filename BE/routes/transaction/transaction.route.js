const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { listMyTransactions, getMyTransaction, listStationTransactions, getStationTransaction, listAllTransactions, getTransaction } = require('../../controllers/transaction/transaction.controller');

// Driver endpoints
router.get('/me', authenticate, listMyTransactions);
router.get('/me/:id', authenticate, getMyTransaction);

// Staff endpoints (station-based)
router.get('/station', authenticate, authorizeRoles('staff','admin'), listStationTransactions); // ?stationId=&limit=
router.get('/station/:id', authenticate, authorizeRoles('staff','admin'), getStationTransaction);

// Admin endpoints
router.get('/admin', authenticate, authorizeRoles('admin'), listAllTransactions); // ?user_id=&station_id=&limit=
router.get('/admin/:id', authenticate, authorizeRoles('admin'), getTransaction);

module.exports = router;
