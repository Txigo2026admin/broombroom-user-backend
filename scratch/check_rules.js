const connectDB = require('../config/db');
const StatePricing = require('../models/StatePricing');
const RoutePricing = require('../models/RoutePricing');

(async () => {
    try {
        await connectDB();
        const stateRules = await StatePricing.findAll({ raw: true });
        console.log('Total StatePricing rules:', stateRules.length);
        for (const r of stateRules) {
            console.log(`- ID: ${r.id}, City: ${r.city}, State: ${r.state}, Ride: ${r.rideCategory}, Cat: ${r.carCategory}, Rate: Rs.${r.ratePerKm}/km, Threshold: Rs.${r.threshold}, 0-50: ${r.rate0to50}, 51-100: ${r.rate51to100}, 101-150: ${r.rate101to150}, 151-200: ${r.rate151to200}, 201-4000: ${r.rate201to4000}`);
        }

        const routeRules = await RoutePricing.findAll({ raw: true });
        console.log('\nTotal RoutePricing rules:', routeRules.length);
        for (const r of routeRules) {
            console.log(`- ID: ${r.id}, From: ${r.pickupLocation} -> To: ${r.dropLocation}, Ride: ${r.rideCategory}, Cat: ${r.carCategory}, FixedPrice: Rs.${r.fixedPrice}`);
        }
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
