const express = require('express');
const router = express.Router();
const { login, register, refresh, logout, verifyEmail, resendOtp, forgotPassword, resetPassword, changePassword } = require('../../controllers/auth/auth.controller');
const { authenticate, optionalAuthenticate } = require('../../middlewares/auth/auth.middleware');

router.post('/login', login);
router.post('/register', optionalAuthenticate, register);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.post('/change-password', authenticate, changePassword);

module.exports = router;
