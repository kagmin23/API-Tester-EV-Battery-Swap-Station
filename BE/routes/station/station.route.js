const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { listNearbyStations, getStationDetail, postStationRating, listStationRatings } = require('../../controllers/station/station.controller');

router.get('/', authenticate, listNearbyStations); // /api/stations?lat=&lng=
router.get('/:id', authenticate, getStationDetail);
router.post('/:id/ratings', authenticate, postStationRating);
router.get('/:id/ratings', authenticate, listStationRatings);
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
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Station list
 */

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
 */

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
 */

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
 */

module.exports = router;
