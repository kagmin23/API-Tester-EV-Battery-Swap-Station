const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createVnpayPayment, vnpayReturn, vnpayIpn } = require('../../controllers/payment/payment.controller');

router.post('/vnpay/create', authenticate, createVnpayPayment);
router.get('/vnpay/return', vnpayReturn);
router.get('/vnpay/ipn', vnpayIpn);

module.exports = router;
