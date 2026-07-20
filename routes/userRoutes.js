const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUserStatus } = require('../controllers/userController');

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id', updateUserStatus);

module.exports = router;
