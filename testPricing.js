require('dotenv').config();
const mongoose = require('mongoose');
const pricingService = require('./services/pricingService');

async function runTests() {
    try {
        console.log('Connecting to database for pricing tests...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/broomboom_user_db');
        console.log('Connected.');

        // Test Helper
        const testCase = async (name, params, validator) => {
            console.log(`\n--------------------------------------------------`);
            console.log(`RUNNING TEST: ${name}`);
            const result = await pricingService.calculatePrice(params);
            console.log('Parameters:', JSON.stringify(params));
            console.log('Result:', JSON.stringify(result, null, 2));
            if (validator(result)) {
                console.log('✅ TEST PASSED');
            } else {
                console.log('❌ TEST FAILED');
                process.exit(1);
            }
        };

        // Case 1: Route-Specific Pricing (Exact Match)
        await testCase(
            'Route-Specific Exact Match (Kolkata Airport to Digha)',
            {
                rideType: 'Oneway',
                sourceCity: 'Kolkata Airport',
                destinationCity: 'Digha',
                category: 'Sedan'
            },
            (res) => res.success === true && res.fare === 3500 && res.ruleType === 'RouteSpecific'
        );

        // Case 2: Route-Specific Proximity Match (Within 25km radius)
        await testCase(
            'Route-Specific Proximity Match (Kolkata Airport to Salt Lake)',
            {
                rideType: 'Airport',
                sourceCity: 'Kolkata Airport',
                destinationCity: 'Salt Lake',
                pickupLat: 22.6500, // Near 22.6547
                pickupLng: 88.4400, // Near 88.4467
                dropLat: 22.5700,   // Near 22.5726
                dropLng: 88.4300,   // Near 88.4348
                category: 'Sedan'
            },
            (res) => res.success === true && res.fare === 899 && res.details.tollTax === 'Included'
        );

        // Case 3: State-wise Fallback (West Bengal Oneway Sedan)
        await testCase(
            'State-wise Oneway Sedan (Distance: 120km, Time: 08:00)',
            {
                rideType: 'Oneway',
                sourceCity: 'Kolkata', // WB city
                destinationCity: 'Bardhaman',
                category: 'Sedan',
                distance: 120,
                pickupTime: '08:00'
            },
            // Expected: billable kms = Max(120, 100) = 120. 
            // Distance fare = 120 * 13 = 1560
            // Driver bata = 250
            // Night Allowance = 0 (Time 08:00 is day)
            // Total = 1560 + 250 = 1810
            (res) => res.success === true && res.fare === 1810 && res.ruleType === 'StateGeneral'
        );

        // Case 4: State-wise Roundtrip Sedan (Distance: 200km, Days: 2)
        await testCase(
            'State-wise Roundtrip Sedan (Distance: 200km, 2 Days)',
            {
                rideType: 'Roundtrip',
                sourceCity: 'Kolkata',
                destinationCity: 'Digha',
                category: 'Sedan',
                distance: 200,
                days: 2
            },
            // Expected:
            // Min Kms = 250/day * 2 = 500 kms.
            // Distance Fare = 500 * 13 = 6500.
            // Hourly Fare = 48 * 120 = 5760.
            // Higher base is Distance = 6500.
            // Allowances = driverBata (250 * 2) + night (250 * 2) = 1000.
            // Total = 6500 + 1000 = 7500.
            (res) => res.success === true && res.fare === 7500 && res.details.baseFareChosen === 6500
        );

        // Case 5: Rental Package (West Bengal Sedan, Exceeding Package Limits)
        await testCase(
            'State-wise Rental Package (8hr/80km, Actual: 90km, 9hrs)',
            {
                rideType: 'Rental',
                sourceCity: 'Kolkata',
                category: 'Sedan',
                distance: 90,
                packageHours: 8,
                includedKms: 80,
                pickupDate: '2026-05-25',
                pickupTime: '10:00',
                returnDate: '2026-05-25',
                returnTime: '19:00' // 9 hours
            },
            // Expected:
            // Base: 2000
            // Extra Kms: 10 * 14 = 140
            // Extra Hours: 1 * 150 = 150
            // Total = 2000 + 140 + 150 = 2290
            (res) => res.success === true && res.fare === 2290 && res.details.extraCharges === 290
        );

        // Case 6: Fallback rule missing
        await testCase(
            'Unmapped fallback pricing message check',
            {
                rideType: 'Oneway',
                sourceCity: 'Panaji', // Goa city
                destinationCity: 'Margao',
                category: 'Sedan'
            },
            (res) => res.success === false && res.message.includes('unavailable')
        );

        console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
        process.exit(0);
    } catch (error) {
        console.error('Test execution error:', error);
        process.exit(1);
    }
}

runTests();
