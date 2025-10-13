var express = require('express');
var router = express.Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth/auth.middleware');

/* GET users listing. */
// Public example
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

// Admin-only example
router.get('/admin-only', authenticate, authorizeRoles('admin'), function(req, res) {
  res.json({ message: 'Hello Admin', user: req.user });
});

// Driver or Staff example
router.get('/staff-or-driver', authenticate, authorizeRoles('staff', 'driver', 'admin'), function(req, res) {
  res.json({ message: 'Hello Staff/Driver', user: req.user });
});

module.exports = router;
