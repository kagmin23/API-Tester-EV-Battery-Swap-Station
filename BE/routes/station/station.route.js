const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { listNearbyStations, getStationDetail, postStationRating, listStationRatings } = require('../../controllers/station/station.controller');

router.get('/', authenticate, listNearbyStations); // /api/stations?lat=&lng=
router.get('/:id', authenticate, getStationDetail);
router.post('/:id/ratings', authenticate, postStationRating);
router.get('/:id/ratings', authenticate, listStationRatings);

module.exports = router;
