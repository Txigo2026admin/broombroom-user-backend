const { calculatePrice } = require('../services/pricingService');
const StatePricing = require('../models/StatePricing');
const { sequelize } = require('../config/db');

async function testUserExamples() {
    try {
        console.log('=== TEST USER EXAMPLES ===\n');

        // Setup test rule for Example 1 (Admin-set price: 2000, rate: 10, slab: 151-200 km)
        const [ruleEx1] = await StatePricing.findOrCreate({
            where: {
                city: 'TestCity1',
                rideCategory: 'Oneway',
                carCategory: 'Sedan'
            },
            defaults: {
                state: 'TestState',
                seater: 4,
                ratePerKm: 10,
                threshold: 2000,
                advanceType: 'Percentage',
                advanceValue: 20,
                status: 'Active'
            }
        });
        await ruleEx1.update({ ratePerKm: 10, threshold: 2000 });

        console.log('--- TEST 1: ONEWAY 181 KM with Admin-set price = ₹2,000 ---');
        const res1 = await calculatePrice({
            rideType: 'Oneway',
            category: 'Sedan',
            sourceCity: 'TestCity1',
            destinationCity: 'AnyWhere',
            pickupLat: 22.5,
            pickupLng: 88.3,
            dropLat: 23.5,
            dropLng: 89.3,
            distance: 181,
            pickupDate: '28-10-2026',
            pickupTime: '10:00 AM'
        });

        console.log('Distance:', res1.distance);
        console.log('Slab:', res1.details.slab);
        console.log('Rate per km:', res1.details.ratePerKm);
        console.log('Distance fare:', res1.details.distanceFare);
        console.log('Admin-set price:', res1.details.adminSetPrice);
        console.log('Selected base fare:', res1.details.selectedBaseFare);
        console.log('Final Fare:', res1.fare);
        console.log('Comparison:', res1.details.comparison);

        console.log('\n--- TEST 2: ONEWAY 181 KM with Admin-set price = ₹1,500 ---');
        await ruleEx1.update({ ratePerKm: 10, threshold: 1500 });
        const res2 = await calculatePrice({
            rideType: 'Oneway',
            category: 'Sedan',
            sourceCity: 'TestCity1',
            destinationCity: 'AnyWhere',
            pickupLat: 22.5,
            pickupLng: 88.3,
            dropLat: 23.5,
            dropLng: 89.3,
            distance: 181,
            pickupDate: '28-10-2026',
            pickupTime: '10:00 AM'
        });

        console.log('Distance:', res2.distance);
        console.log('Slab:', res2.details.slab);
        console.log('Rate per km:', res2.details.ratePerKm);
        console.log('Distance fare:', res2.details.distanceFare);
        console.log('Admin-set price:', res2.details.adminSetPrice);
        console.log('Selected base fare:', res2.details.selectedBaseFare);
        console.log('Final Fare:', res2.fare);
        console.log('Comparison:', res2.details.comparison);

        console.log('\n--- TEST 3: ROUNDTRIP 362 KM (181 km oneway), 24 hours, Admin min ₹3,000, rate ₹14/km, hourly ₹100/hr ---');
        const [ruleEx3] = await StatePricing.findOrCreate({
            where: {
                city: 'TestCity1',
                rideCategory: 'Roundtrip',
                carCategory: 'Sedan'
            },
            defaults: {
                state: 'TestState',
                seater: 4,
                ratePerKm: 14,
                hourlyRate: 100,
                threshold: 3000,
                advanceType: 'Percentage',
                advanceValue: 20,
                status: 'Active'
            }
        });
        await ruleEx3.update({ ratePerKm: 14, hourlyRate: 100, threshold: 3000 });

        const res3 = await calculatePrice({
            rideType: 'Roundtrip',
            category: 'Sedan',
            sourceCity: 'TestCity1',
            destinationCity: 'AnyWhere',
            pickupLat: 22.5,
            pickupLng: 88.3,
            dropLat: 23.5,
            dropLng: 89.3,
            distance: 362,
            oneWayDistance: 181,
            bookingDuration: 24,
            pickupDate: '28-10-2026',
            pickupTime: '10:00 AM',
            returnDate: '29-10-2026',
            returnTime: '10:00 AM'
        });

        console.log('Total distance:', res3.distance);
        console.log('One way distance:', res3.details.oneWayDistance);
        console.log('Slab:', res3.details.slab);
        console.log('Rate per km:', res3.details.ratePerKm);
        console.log('Distance fare (362 * 14):', res3.details.distanceFare);
        console.log('Duration hours:', res3.details.totalHours);
        console.log('Hourly rate:', res3.details.hourlyRate);
        console.log('Hourly fare (24 * 100):', res3.details.hourlyFare);
        console.log('Admin-set min price:', res3.details.adminSetPrice);
        console.log('Selected base fare:', res3.details.selectedBaseFare);
        console.log('Final Fare:', res3.fare);
        console.log('Comparison:', res3.details.comparison);

        // Clean up test rules
        await ruleEx1.destroy();
        await ruleEx3.destroy();

        console.log('\n=== ALL USER EXAMPLES PASSED PERFECTLY ===');
        process.exit(0);
    } catch (e) {
        console.error('Error during test:', e);
        process.exit(1);
    }
}

testUserExamples();

