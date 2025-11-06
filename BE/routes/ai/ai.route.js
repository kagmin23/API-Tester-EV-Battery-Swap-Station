const express = require('express');
const router = express.Router();
const aiController = require('../../controllers/ai/ai.controller');
const { authenticate, authorizeRoles } = require('../../middlewares/auth/auth.middleware');

router.post('/forecast/demand',
  authenticate,
  authorizeRoles('admin', 'staff'),
  aiController.forecastDemand
);

router.post('/recommendations/capacity',
  authenticate,
  authorizeRoles('admin'),
  aiController.getCapacityRecommendation
);

router.get('/recommendations/all',
  authenticate,
  authorizeRoles('admin'),
  aiController.getAllRecommendations
);

router.post('/train',
  authenticate,
  authorizeRoles('admin'),
  aiController.trainModel
);

router.get('/model/status',
  authenticate,
  authorizeRoles('admin'),
  aiController.getModelStatus
);

module.exports = router;

