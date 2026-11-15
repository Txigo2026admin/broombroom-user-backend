const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUserStatus, deleteUser } = require('../controllers/userController');

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id', updateUserStatus);
router.delete('/:id', deleteUser);

module.exports = router;
