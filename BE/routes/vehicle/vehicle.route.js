const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');
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
 *             required:
 *               - vin
 *               - license_plate
 *             properties:
 *               vin:
 *                 type: string
 *                 description: 17-character VIN (no I,O,Q)
 *               battery:
 *                 type: object
 *                 properties:
 *                   station:
 *                     type: string
 *                   serial:
 *                     type: string
 *                   model:
 *                     type: string
 *                   soh:
 *                     type: number
 *                     description: State of Health (0-100)
 *                   manufacturer:
 *                     type: string
 *                   capacity_kWh:
 *                     type: number
 *                   price:
 *                     type: number
 *                   voltage:
 *                     type: number
 *                   status:
 *                     type: string
 *                     enum: [in-use, charging, full, faulty, idle, is-booking]
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

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: List vehicles for current user
 *     description: Returns vehicles belonging to the authenticated user. Admins can pass `?all=true` to list all vehicles.
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Set to `true` to list all vehicles (admin only)
 *     responses:
 *       200:
 *         description: Vehicles list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       vehicle_id:
 *                         type: string
 *                       user_id:
 *                         type: string
 *                       vin:
 *                         type: string
 *                       battery_id:
 *                         type: string
 *                         nullable: true
 *                       license_plate:
 *                         type: string
 *                       car_name:
 *                         type: string
 *                       brand:
 *                         type: string
 *                       model_year:
 *                         type: integer
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 */
router.get('/', listVehicles);

// Get vehicle by vehicle_id
/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Get vehicle by vehicleId
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
