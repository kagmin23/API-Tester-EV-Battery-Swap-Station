const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
const { dashboard, listStationBatteries, batteryDetail, batteryHistory, updateBattery, listSwapRequests, confirmSwapRequest, recordSwapReturn, createStationPayment, stationSwapHistory } = require('../../controllers/staff/staff.controller');

router.use(authenticate, authorizeRoles('staff','admin'));

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

module.exports = router;
