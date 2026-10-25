const Airport = require('../models/Airport');

const DEFAULT_AIRPORTS = [
    {
        name: 'Netaji Subhash Chandra Bose International Airport',
        code: 'CCU',
        city: 'Kolkata',
        state: 'West Bengal',
        lat: '22.6547',
        lon: '88.4467',
        terminals: ['Terminal 1 (Domestic)', 'Terminal 2 (International)'],
        status: 'Active'
    },
    {
        name: 'Indira Gandhi International Airport',
        code: 'DEL',
        city: 'Delhi',
        state: 'Delhi',
        lat: '28.5562',
        lon: '77.1000',
        terminals: ['Terminal 1 (T1)', 'Terminal 2 (T2)', 'Terminal 3 (T3)'],
        status: 'Active'
    },
    {
        name: 'Chhatrapati Shivaji Maharaj International Airport',
        code: 'BOM',
        city: 'Mumbai',
        state: 'Maharashtra',
        lat: '19.0896',
        lon: '72.8656',
        terminals: ['Terminal 1 (T1 - Domestic)', 'Terminal 2 (T2 - International & Domestic)'],
        status: 'Active'
    },
    {
        name: 'Kempegowda International Airport',
        code: 'BLR',
        city: 'Bengaluru',
        state: 'Karnataka',
        lat: '13.1986',
        lon: '77.7066',
        terminals: ['Terminal 1 (T1)', 'Terminal 2 (T2)'],
        status: 'Active'
    },
    {
        name: 'Rajiv Gandhi International Airport',
        code: 'HYD',
        city: 'Hyderabad',
        state: 'Telangana',
        lat: '17.2403',
        lon: '78.4294',
        terminals: ['Main Terminal (Domestic & International)'],
        status: 'Active'
    },
    {
        name: 'Chennai International Airport',
        code: 'MAA',
        city: 'Chennai',
        state: 'Tamil Nadu',
        lat: '12.9941',
        lon: '80.1709',
        terminals: ['Terminal 1 (Domestic)', 'Terminal 2 (International)', 'Terminal 4 (Domestic)'],
        status: 'Active'
    },
    {
        name: 'Sardar Vallabhbhai Patel International Airport',
        code: 'AMD',
        city: 'Ahmedabad',
        state: 'Gujarat',
        lat: '23.0772',
        lon: '72.6347',
        terminals: ['Terminal 1 (Domestic)', 'Terminal 2 (International)'],
        status: 'Active'
    },
    {
        name: 'Cochin International Airport',
        code: 'COK',
        city: 'Kochi',
        state: 'Kerala',
        lat: '10.1518',
        lon: '76.3930',
        terminals: ['Terminal 1 (Domestic)', 'Terminal 3 (International)'],
        status: 'Active'
    },
    {
        name: 'Pune International Airport',
        code: 'PNQ',
        city: 'Pune',
        state: 'Maharashtra',
        lat: '18.5822',
        lon: '73.9197',
        terminals: ['Terminal 1', 'New Integrated Terminal'],
        status: 'Active'
    },
    {
        name: 'Goa International Airport (Dabolim)',
        code: 'GOI',
        city: 'Goa',
        state: 'Goa',
        lat: '15.3808',
        lon: '73.8314',
        terminals: ['Terminal 1 (Integrated)'],
        status: 'Active'
    },
    {
        name: 'Manohar International Airport (Mopa)',
        code: 'GOX',
        city: 'Goa',
        state: 'Goa',
        lat: '15.7661',
        lon: '73.8687',
        terminals: ['Passenger Terminal'],
        status: 'Active'
    },
    {
        name: 'Bagdogra Airport',
        code: 'IXB',
        city: 'Siliguri',
        state: 'West Bengal',
        lat: '26.6812',
        lon: '88.3286',
        terminals: ['Terminal 1'],
        status: 'Active'
    },
    {
        name: 'Kazi Nazrul Islam Airport',
        code: 'RDP',
        city: 'Durgapur',
        state: 'West Bengal',
        lat: '23.6231',
        lon: '87.2423',
        terminals: ['Passenger Terminal'],
        status: 'Active'
    },
    {
        name: 'Jaipur International Airport',
        code: 'JAI',
        city: 'Jaipur',
        state: 'Rajasthan',
        lat: '26.8242',
        lon: '75.8122',
        terminals: ['Terminal 1', 'Terminal 2'],
        status: 'Active'
    },
    {
        name: 'Chaudhary Charan Singh International Airport',
        code: 'LKO',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        lat: '26.7606',
        lon: '80.8893',
        terminals: ['Terminal 1', 'Terminal 2', 'Terminal 3'],
        status: 'Active'
    },
    {
        name: 'Biju Patnaik International Airport',
        code: 'BBI',
        city: 'Bhubaneswar',
        state: 'Odisha',
        lat: '20.2444',
        lon: '85.8178',
        terminals: ['Terminal 1 (Domestic)', 'Terminal 2 (International)'],
        status: 'Active'
    },
    {
        name: 'Lokpriya Gopinath Bordoloi International Airport',
        code: 'GAU',
        city: 'Guwahati',
        state: 'Assam',
        lat: '26.1061',
        lon: '91.5859',
        terminals: ['Terminal 1 (Domestic)', 'Terminal 2 (International)'],
        status: 'Active'
    }
];

// Helper to auto-seed default airports if database has none
async function ensureAirportsSeeded() {
    try {
        const count = await Airport.find();
        if (!count || count.length === 0) {
            console.log('[Airport Controller] Seeding default Indian airports...');
            for (const item of DEFAULT_AIRPORTS) {
                await Airport.create(item);
            }
            console.log('[Airport Controller] Default airports seeded successfully.');
        }
    } catch (err) {
        console.error('[Airport Controller] Error seeding airports:', err.message);
    }
}

// @desc    Get all active airports
// @route   GET /api/airports
// @access  Public
exports.getAirports = async (req, res) => {
    try {
        await ensureAirportsSeeded();
        const airports = await Airport.find({ status: 'Active' }).sort({ name: 1 });
        res.status(200).json(airports);
    } catch (error) {
        console.error('Error fetching airports:', error);
        // Fallback to static list if database query errors
        res.status(200).json(DEFAULT_AIRPORTS);
    }
};

// @desc    Get airport by ID
// @route   GET /api/airports/:id
// @access  Public
exports.getAirportById = async (req, res) => {
    try {
        const airport = await Airport.findById(req.params.id);
        if (!airport) {
            return res.status(404).json({ message: 'Airport not found' });
        }
        res.status(200).json(airport);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new airport
// @route   POST /api/airports
// @access  Public (or Admin)
exports.createAirport = async (req, res) => {
    try {
        const { name, code, city, state, lat, lon, terminals, status } = req.body;
        if (!name || !code || !city) {
            return res.status(400).json({ message: 'Name, code, and city are required' });
        }

        const airport = await Airport.create({
            name,
            code: code.toUpperCase(),
            city,
            state: state || '',
            lat: lat ? String(lat) : '',
            lon: lon ? String(lon) : '',
            terminals: Array.isArray(terminals) ? terminals : [],
            status: status || 'Active'
        });

        res.status(201).json(airport);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update airport
// @route   PUT /api/airports/:id
// @access  Public (or Admin)
exports.updateAirport = async (req, res) => {
    try {
        const airport = await Airport.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!airport) {
            return res.status(404).json({ message: 'Airport not found' });
        }
        res.status(200).json(airport);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete airport
// @route   DELETE /api/airports/:id
// @access  Public (or Admin)
exports.deleteAirport = async (req, res) => {
    try {
        const airport = await Airport.findByIdAndDelete(req.params.id);
        if (!airport) {
            return res.status(404).json({ message: 'Airport not found' });
        }
        res.status(200).json({ message: 'Airport deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

