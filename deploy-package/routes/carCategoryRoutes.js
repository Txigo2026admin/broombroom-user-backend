const express = require('express');
const router = express.Router();
const { getCarCategories, createCarCategory, updateCarCategory } = require('../controllers/carCategoryController');

router.get('/', getCarCategories);
router.post('/', createCarCategory);
router.put('/:id', updateCarCategory);

module.exports = router;
