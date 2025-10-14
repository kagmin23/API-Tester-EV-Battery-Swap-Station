const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createVehicle, listVehicles, getVehicle, updateVehicle, deleteVehicle } = require('../../controllers/vehicle/vehicle.controller');

/**
 * @swagger
 * tags:
 *   name: Vehicles
 *   description: Vehicle management
 */

// All vehicle routes require authentication
router.use(authenticate);

// Create/link vehicle to current user
/**
 * @swagger
 * /api/vehicles:
 *   post:
 *     summary: Create/link a vehicle to current user
 *     description: Registers a vehicle to your account. VIN must be 17 chars (no I,O,Q). License plate must be unique.
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vin, license_plate]
 *             properties:
 *               vin:
 *                 type: string
 *                 description: 17-character VIN (no I,O,Q)
 *               battery_model:
 *                 type: string
 *               license_plate:
 *                 type: string
 *               car_name:
 *                 type: string
 *               brand:
 *                 type: string
 *               model_year:
 *                 type: number
 *     responses:
 *       201:
 *         description: Vehicle created
 */
router.post('/', createVehicle);

// List vehicles (mine; admin can pass ?all=true to list all)
/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: List current vehicles
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Vehicles list
 */
router.get('/', listVehicles);

// Get vehicle by vehicle_id
/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Get vehicle by id
 *     tags: [Vehicles]
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
 *         description: Vehicle detail
 */
router.get('/:id', getVehicle);

// Update vehicle by vehicle_id
/**
 * @swagger
 * /api/vehicles/{id}:
 *   patch:
 *     summary: Update vehicle by id
 *     tags: [Vehicles]
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
 *         description: Updated vehicle
 */
router.patch('/:id', updateVehicle);

// Delete vehicle by vehicle_id
/**
 * @swagger
 * /api/vehicles/{id}:
 *   delete:
 *     summary: Delete vehicle by id
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted
 */
router.delete('/:id', deleteVehicle);

module.exports = router;
