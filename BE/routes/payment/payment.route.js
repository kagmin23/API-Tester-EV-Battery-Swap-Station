const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createVnpayPayment, vnpayReturn, vnpayIpn } = require('../../controllers/payment/payment.controller');

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
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/vnpay/create', authenticate, createVnpayPayment);

/**
 * @swagger
 * /api/payments/vnpay/return:
 *   get:
 *     summary: VNPay return URL
 *     description: Handles the return from VNPay after payment completion
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Return handled
 */
router.get('/vnpay/return', vnpayReturn);

/**
 * @swagger
 * /api/payments/vnpay/ipn:
 *   get:
 *     summary: VNPay IPN callback
 *     description: Handles VNPay Instant Payment Notification
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: IPN received
 */
router.get('/vnpay/ipn', vnpayIpn);
// Accept POST as well (some gateways send IPN via POST)
router.post('/vnpay/ipn', vnpayIpn);

module.exports = router;
