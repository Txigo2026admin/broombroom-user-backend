const express = require('express');
const router = express.Router();
const {
    getCareerLeads,
    createCareerLead,
    getCareerLeadById,
    updateCareerLead,
    deleteCareerLead
} = require('../controllers/careerController');

// Public route for candidates to submit applications & Admin to get list
router.route('/')
    .get(getCareerLeads)
    .post(createCareerLead);

router.route('/:id')
    .get(getCareerLeadById)
    .patch(updateCareerLead)
    .put(updateCareerLead)
    .delete(deleteCareerLead);

router.route('/:id/status')
    .patch(updateCareerLead);

module.exports = router;
