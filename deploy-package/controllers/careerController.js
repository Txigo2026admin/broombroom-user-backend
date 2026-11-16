const { Op } = require('sequelize');
const CareerLead = require('../models/CareerLead');

// Helper to clean and normalize 10-digit phone
const normalizePhone = (phoneStr) => {
    if (!phoneStr) return '';
    const digits = String(phoneStr).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
};

/**
 * @desc    Get all career leads with optional filters
 * @route   GET /api/careers
 */
exports.getCareerLeads = async (req, res) => {
    try {
        const { status, department, search, sortBy } = req.query;
        const whereConditions = {};

        // Status filter (case-insensitive)
        if (status && status !== 'ALL' && status !== 'all') {
            whereConditions.status = { [Op.iLike]: status };
        }

        // Department filter
        if (department && department !== 'ALL' && department !== 'all') {
            whereConditions.department = { [Op.iLike]: `%${department}%` };
        }

        // Global search
        if (search && search.trim()) {
            const q = `%${search.trim()}%`;
            whereConditions[Op.or] = [
                { name: { [Op.iLike]: q } },
                { email: { [Op.iLike]: q } },
                { phone: { [Op.iLike]: q } },
                { jobTitle: { [Op.iLike]: q } },
                { location: { [Op.iLike]: q } },
                { department: { [Op.iLike]: q } },
            ];
        }

        const orderDirection = sortBy === 'oldest' ? 'ASC' : 'DESC';

        const leads = await CareerLead.findAll({
            where: whereConditions,
            order: [
                ['appliedAt', orderDirection],
                ['createdAt', orderDirection]
            ]
        });

        return res.status(200).json({
            success: true,
            count: leads.length,
            data: leads
        });
    } catch (error) {
        console.error('getCareerLeads error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch career leads'
        });
    }
};

/**
 * @desc    Submit a new career application lead from website
 * @route   POST /api/careers
 */
exports.createCareerLead = async (req, res) => {
    try {
        const {
            jobId,
            jobTitle,
            department,
            name,
            fullName,
            email,
            phone,
            mobile,
            location,
            experience,
            linkedIn,
            portfolio,
            noticePeriod,
            cover,
            coverLetter,
            resumeUrl,
            resumeFileName,
            source
        } = req.body;

        const applicantName = (name || fullName || '').trim();
        const applicantEmail = (email || '').trim().toLowerCase();
        const applicantPhone = (phone || mobile || '').trim();
        const applicantCover = (cover || coverLetter || '').trim();

        if (!applicantName) {
            return res.status(400).json({ success: false, message: 'Applicant name is required' });
        }
        if (!applicantEmail) {
            return res.status(400).json({ success: false, message: 'Applicant email is required' });
        }
        if (!applicantPhone) {
            return res.status(400).json({ success: false, message: 'Applicant phone number is required' });
        }

        const cleanPhone = normalizePhone(applicantPhone);
        const resolvedJobTitle = jobTitle && jobTitle.trim() ? jobTitle.trim() : 'General Application';

        // Infer department if not explicitly given
        let resolvedDept = department && department.trim() ? department.trim() : 'General';
        if (resolvedDept === 'General' && jobId) {
            if (jobId.startsWith('tech-')) resolvedDept = 'Tech';
            else if (jobId.startsWith('prod-')) resolvedDept = 'Product/Business';
            else if (jobId.startsWith('ops-')) resolvedDept = 'Operations';
        }

        const newLead = await CareerLead.create({
            jobId: jobId || 'general',
            jobTitle: resolvedJobTitle,
            department: resolvedDept,
            name: applicantName,
            email: applicantEmail,
            phone: cleanPhone || applicantPhone,
            location: location ? location.trim() : 'Not Specified',
            experience: experience ? experience.trim() : 'Fresher / Any',
            linkedIn: linkedIn ? linkedIn.trim() : null,
            portfolio: portfolio ? portfolio.trim() : null,
            noticePeriod: noticePeriod ? noticePeriod.trim() : 'Immediate',
            cover: applicantCover || null,
            resumeUrl: resumeUrl || null,
            resumeFileName: resumeFileName || 'Uploaded via Careers Portal',
            status: 'New',
            source: source || 'BroomBoom Careers Page',
            appliedAt: new Date()
        });

        console.log(`[CareerLead] New applicant received: ${newLead.name} (${newLead.jobTitle}, ${newLead.phone})`);

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully! Our talent acquisition team will review your profile.',
            data: newLead
        });
    } catch (error) {
        console.error('createCareerLead error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to submit career application'
        });
    }
};

/**
 * @desc    Get single career lead details
 * @route   GET /api/careers/:id
 */
exports.getCareerLeadById = async (req, res) => {
    try {
        const lead = await CareerLead.findByPk(req.params.id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Career lead not found' });
        }
        return res.status(200).json({ success: true, data: lead });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update career lead status / notes / interview info
 * @route   PATCH /api/careers/:id or PUT /api/careers/:id
 */
exports.updateCareerLead = async (req, res) => {
    try {
        const lead = await CareerLead.findByPk(req.params.id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Career lead not found' });
        }

        const allowedFields = ['status', 'notes', 'location', 'experience', 'linkedIn', 'portfolio', 'noticePeriod', 'cover'];
        const updates = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (req.body.status) {
            updates.status = req.body.status;
        }

        await lead.update(updates);

        return res.status(200).json({
            success: true,
            message: 'Career lead updated successfully',
            data: lead
        });
    } catch (error) {
        console.error('updateCareerLead error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete a career lead
 * @route   DELETE /api/careers/:id
 */
exports.deleteCareerLead = async (req, res) => {
    try {
        const lead = await CareerLead.findByPk(req.params.id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Career lead not found' });
        }

        await lead.destroy();
        return res.status(200).json({
            success: true,
            message: 'Career lead deleted successfully'
        });
    } catch (error) {
        console.error('deleteCareerLead error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
