const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createSupportRequest, listSupportRequests } = require('../../controllers/support/support.controller');

router.use(authenticate);
router.post('/requests', createSupportRequest);
router.get('/requests', listSupportRequests);

module.exports = router;
