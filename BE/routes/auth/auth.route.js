const express = require('express');
const router = express.Router();
const { login, register, refresh, logout, verifyEmail, resendOtp } = require('../../controllers/auth/auth.controller');

router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);

module.exports = router;
