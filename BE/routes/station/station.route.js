const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { listNearbyStations, listAllStations, getStationDetail, postStationRating, listStationRatings } = require('../../controllers/station/station.controller');

/**
 * @swagger
 * tags:
 *   name: Stations
 *   description: Station discovery and ratings
 */

/**
 * @swagger
 * /api/stations:
 *   get:
 *     summary: List nearby stations
 *     tags: [Stations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *     responses:
 *       200:
 *         description: Station list
 *       400:
 *         description: Invalid coordinates
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, listNearbyStations); // /api/stations?lat=&lng=
router.get('/all', authenticate, listAllStations); // /api/stations/all

/**
 * @swagger
 * /api/stations/{id}:
 *   get:
 *     summary: Get station detail
 *     tags: [Stations]
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
 *         description: Station detail
 *       404:
 *         description: Station not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', authenticate, getStationDetail);

/**
 * @swagger
 * /api/stations/{id}/ratings:
 *   post:
 *     summary: Post rating for a station
 *     description: Creates or updates your rating for the station. Rating must be between 1 and 5.
 *     tags: [Stations]
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
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *                 description: Optional comment
 *     responses:
 *       201:
 *         description: Rating created
 *       400:
 *         description: Invalid rating
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Station not found
 */
router.post('/:id/ratings', authenticate, postStationRating);

/**
 * @swagger
 * /api/stations/{id}/ratings:
 *   get:
 *     summary: List ratings for a station
 *     tags: [Stations]
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
 *         description: Ratings list
 *       404:
 *         description: Station not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id/ratings', authenticate, listStationRatings);

module.exports = router;
