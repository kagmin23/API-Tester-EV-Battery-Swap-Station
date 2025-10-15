const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { getMe, updateMe, uploadAvatar } = require('../../controllers/user/user.controller');
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
