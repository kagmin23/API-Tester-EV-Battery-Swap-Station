const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middlewares/auth/auth.middleware');
const { createSupportRequest, listSupportRequests } = require('../../controllers/support/support.controller');

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Support requests
 */

router.use(authenticate);

/**
 * @swagger
 * /api/support/requests:
 *   post:
 *     summary: Create a support request
 *     description: Submits a support ticket with optional description and image URLs.
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 description: Support request title
 *               description:
 *                 type: string
 *                 description: Detailed description of the issue
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: Image URL
 *     responses:
 *       201:
 *         description: Support request created
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/requests', createSupportRequest);

/**
 * @swagger
 * /api/support/requests:
 *   get:
 *     summary: List my support requests
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support requests list
 *       401:
 *         description: Unauthorized
 */
router.get('/requests', listSupportRequests);

module.exports = router;
