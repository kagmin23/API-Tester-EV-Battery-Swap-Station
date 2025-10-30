const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { getMe, updateMe, uploadAvatar } = require('../../controllers/user/user.controller');
const { getPlansForUser, purchaseSubscription, createSubscriptionPayment } = require('../../controllers/subscription/subscription.controller');
const uploadAvatarMiddleware = require('../../middlewares/upload/avatarUpload.middleware');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile endpoints
 */

router.use(authenticate);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/me', getMe);

/**
 * @swagger
 * /api/users/subscriptions/plans:
 *   get:
 *     summary: List available subscription plans for the authenticated driver
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: "Filter by plan status (default: active)"
 *     responses:
 *       200:
 *         description: A list of subscription plans
 *       401:
 *         description: Unauthorized
 */
router.get('/subscriptions/plans', getPlansForUser);
router.post('/subscriptions/create-payment', createSubscriptionPayment);

/**
 * @swagger
 * /api/users/subscriptions/purchase:
 *   post:
 *     summary: Purchase a subscription plan (driver only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date-time
 *                 description: Optional start date; defaults to now if omitted
 *     responses:
 *       201:
 *         description: Subscription created
 *       400:
 *         description: Invalid input or no available slots
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (only drivers allowed)
 */
router.post('/subscriptions/purchase', purchaseSubscription);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               phoneNumber:
 *                 type: string
 *                 description: Must start with 0 and have 10 digits
 *                 example: "0912345678"
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.put('/me', updateMe);

/**
 * @swagger
 * /api/users/me/avatar:
 *   post:
 *     summary: Upload avatar for current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded
 */
router.post('/me/avatar', uploadAvatarMiddleware, uploadAvatar);

module.exports = router;
