const { calculatePrice } = require('../services/pricingService');
const { sequelize } = require('../config/db');

async function runTest() {
    try {
        console.log('--- TEST 1: ONEWAY 250 KM (Sedan, Kolkata) ---');
        // In Kolkata, Sedan ratePerKm is 10.
        // For 250 km, distanceFare should be 250 * 10 = 2500.
        // NOT (200 * 10) + (50 * extraKmRate).
        const res1 = await calculatePrice({
            rideType: 'Oneway',
            category: 'Sedan',
            sourceCity: 'Kolkata',
            destinationCity: 'Durgapur',
            distance: 250,
            pickupDate: '27-10-2026',
            pickupTime: '10:00 AM'
        });
        console.log('Result 1 (Oneway 250 km):');
        console.log('Fare:', res1.fare);
        console.log('Advance:', res1.advance);
        console.log('DueFare:', res1.dueFare);
        console.log('AdvanceType:', res1.advanceType);
        console.log('AdvanceValue:', res1.advanceValue);
        console.log('AdvancePercentage:', res1.advancePercentage);
        console.log('Details slab:', res1.details.slab);
        console.log('Details distanceFare:', res1.details.distanceFare);
        console.log('Details extraKms:', res1.details.extraKms);
        console.log('Details extraKmCharges:', res1.details.extraKmCharges);

        console.log('\n--- TEST 2: ROUNDTRIP 250 KM (Sedan, Kolkata) ---');
        // In Kolkata, Sedan Roundtrip ratePerKm is 10, advanceValue is 25, threshold is 1200.
        // 250 * 10 = 2500. Total hours = 4 hrs * 100 = 400. Threshold = 1200. Max is 2500.
        // Advance should be 25% of 2500 = 625.
        // DueFare = 1875.
        const res2 = await calculatePrice({
            rideType: 'Roundtrip',
            category: 'Sedan',
            sourceCity: 'Kolkata',
            destinationCity: 'Durgapur',
            distance: 250,
            pickupDate: '27-10-2026',
            pickupTime: '10:00 AM',
            returnDate: '27-10-2026',
            returnTime: '02:00 PM'
        });
        console.log('Result 2 (Roundtrip 250 km):');
        console.log('Fare:', res2.fare);
        console.log('Advance:', res2.advance);
        console.log('DueFare:', res2.dueFare);
        console.log('AdvanceType:', res2.advanceType);
        console.log('AdvanceValue:', res2.advanceValue);
        console.log('AdvancePercentage:', res2.advancePercentage);
        console.log('Details slab:', res2.details.slab);
        console.log('Details distanceFare:', res2.details.distanceFare);
        console.log('Details extraKms:', res2.details.extraKms);
        console.log('Details extraKmCharges:', res2.details.extraKmCharges);

        console.log('\n--- TEST 3: ONEWAY 30 KM (Sedan, Kolkata) ---');
        // 0-50 km slab: billable 50 km * 10 = 500. Threshold is 600. So fare = 600.
        // Advance should be 20% of 600 = 120. DueFare = 480.
        const res3 = await calculatePrice({
            rideType: 'Oneway',
            category: 'Sedan',
            sourceCity: 'Kolkata',
            destinationCity: 'Howrah',
            distance: 30,
            pickupDate: '27-10-2026',
            pickupTime: '10:00 AM'
        });
        console.log('Result 3 (Oneway 30 km):');
        console.log('Fare:', res3.fare);
        console.log('Advance:', res3.advance);
        console.log('DueFare:', res3.dueFare);
        console.log('AdvanceType:', res3.advanceType);
        console.log('AdvanceValue:', res3.advanceValue);
        console.log('AdvancePercentage:', res3.advancePercentage);

        process.exit(0);
    } catch (e) {
        console.error('Error during test:', e);
        process.exit(1);
    }
}

runTest();

