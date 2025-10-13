const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createVnpayPayment, vnpayReturn, vnpayIpn } = require('../../controllers/payment/payment.controller');

router.post('/vnpay/create', authenticate, createVnpayPayment);
router.get('/vnpay/return', vnpayReturn);
router.get('/vnpay/ipn', vnpayIpn);

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment integrations
 */

/**
 * @swagger
 * /api/payments/vnpay/create:
 *   post:
 *     summary: Create VNPay payment
 *     description: Generates a VNPay payment URL. Optionally links to an existing booking by bookingId.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, orderInfo, returnUrl]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Payment amount in VND
 *               orderInfo:
 *                 type: string
 *                 description: Order description to be displayed by VNPay
 *               bookingId:
 *                 type: string
 *                 description: Optional booking identifier to associate payment
 *               returnUrl:
 *                 type: string
 *                 description: Absolute URL VNPay redirects to after payment
 *     responses:
 *       201:
 *         description: Payment created with VNPay URL
 */

/**
 * @swagger
 * /api/payments/vnpay/return:
 *   get:
 *     summary: VNPay return URL
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Return handled
 */

/**
 * @swagger
 * /api/payments/vnpay/ipn:
 *   get:
 *     summary: VNPay IPN callback
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: IPN received
 */

module.exports = router;
