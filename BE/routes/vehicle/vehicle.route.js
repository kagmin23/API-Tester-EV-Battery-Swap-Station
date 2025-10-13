const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createVehicle, listVehicles, getVehicle, updateVehicle, deleteVehicle } = require('../../controllers/vehicle/vehicle.controller');

// All vehicle routes require authentication
router.use(authenticate);

// Create/link vehicle to current user
router.post('/', createVehicle);

// List vehicles (mine; admin can pass ?all=true to list all)
router.get('/', listVehicles);

// Get vehicle by vehicle_id
router.get('/:id', getVehicle);

// Update vehicle by vehicle_id
router.patch('/:id', updateVehicle);

// Delete vehicle by vehicle_id
router.delete('/:id', deleteVehicle);

module.exports = router;
