const express = require('express');
const router = express.Router();
const { getGlobalSettings, updateGlobalSetting } = require('../controllers/globalSettingController');

router.get('/', getGlobalSettings);
router.post('/', updateGlobalSetting);

module.exports = router;
