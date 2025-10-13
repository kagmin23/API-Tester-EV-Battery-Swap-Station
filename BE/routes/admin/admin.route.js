const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { listStations, getStation, transferBatteries, listFaultyBatteries, listComplaints, resolveComplaint, listCustomers, getCustomer, listStaff, upsertStaff, listPlans, upsertPlan, reportsOverview, reportsUsage, aiPredictions, createStation } = require('../../controllers/admin/admin.controller');

router.use(authenticate, authorizeRoles('admin'));

router.get('/stations', listStations);
router.post('/stations', createStation);
router.get('/stations/:id', getStation);
router.post('/stations/transfer', transferBatteries);
router.get('/batteries/faulty', listFaultyBatteries);
router.get('/complaints', listComplaints);
router.put('/complaints/:id/resolve', resolveComplaint);
router.get('/customers', listCustomers);
router.get('/customers/:id', getCustomer);
router.get('/staff', listStaff);
router.post('/staff', upsertStaff);
router.put('/staff/:id', upsertStaff);
router.get('/subscriptions/plans', listPlans);
router.post('/subscriptions/plans', upsertPlan);
router.put('/subscriptions/plans/:id', upsertPlan);
router.get('/reports/overview', reportsOverview);
router.get('/reports/usage', reportsUsage);
router.get('/ai/predictions', aiPredictions);

module.exports = router;
