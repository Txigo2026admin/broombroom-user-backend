const express = require('express');
const router = express.Router();
const { getAddons, updateAddons } = require('../controllers/addonController');

// Public read access for web pages, booking flow, and admin
router.get('/', getAddons);

// Admin update endpoint
router.post('/', updateAddons);
router.put('/', updateAddons);

module.exports = router;
