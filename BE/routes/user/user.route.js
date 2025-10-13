const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { getMe, updateMe } = require('../../controllers/user/user.controller');

router.use(authenticate);
router.get('/me', getMe);
router.put('/me', updateMe);

module.exports = router;
