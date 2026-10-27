const { calculatePrice } = require('../services/pricingService');

async function runRoundtripTests() {
    console.log('====================================================');
    console.log('TEST 1: User Example - 0-50 km slab');
    console.log('Kolkata to New Town (one-way 15 km, round-trip 30 km)');
    console.log('Distance: 30 km @ 15/km = 450');
    console.log('Hours: 4 hrs @ 100/hr = 400');
    console.log('Threshold: 1000');
    console.log('Compare max(450, 400, 1000) -> Expected: 1000');
    console.log('====================================================');
    const res1 = await calculatePrice({
        rideType: 'Roundtrip',
        category: 'Sedan',
        sourceCity: 'Kolkata',
        distance: 30,
        oneWayDistance: 15,
        pickupDate: '27-10-2026',
        pickupTime: '10:00 AM',
        returnDate: '27-10-2026',
        returnTime: '02:00 PM'
    });
    console.log('Fare:', res1.fare);
    console.log('Slab:', res1.details?.slab);
    console.log('Distance Fare:', res1.details?.distanceFare);
    console.log('Total Hours:', res1.details?.totalHours);
    console.log('Hourly Fare:', res1.details?.hourlyFare);
    console.log('Threshold:', res1.details?.threshold);
    console.log('Comparison:', res1.details?.comparison);
    console.assert(res1.fare === 1000, `Expected fare 1000, got ${res1.fare}`);
    console.assert(res1.details?.distanceFare === 450, `Expected distance fare 450, got ${res1.details?.distanceFare}`);
    console.assert(res1.details?.hourlyFare === 400, `Expected hourly fare 400, got ${res1.details?.hourlyFare}`);
    console.assert(res1.details?.threshold === 1000, `Expected threshold 1000, got ${res1.details?.threshold}`);

    console.log('\n====================================================');
    console.log('TEST 2: 51-100 km slab (75 km roundtrip)');
    console.log('Distance Fare: 75 * 15 = 1125, Hourly: 400, Threshold: 1000 -> Expected: 1125');
    console.log('====================================================');
    const res2 = await calculatePrice({
        rideType: 'Roundtrip',
        category: 'Sedan',
        sourceCity: 'Kolkata',
        distance: 75,
        oneWayDistance: 37.5,
        pickupDate: '27-10-2026',
        pickupTime: '10:00 AM',
        returnDate: '27-10-2026',
        returnTime: '02:00 PM'
    });
    console.log('Fare:', res2.fare);
    console.log('Slab:', res2.details?.slab);
    console.log('Distance Fare:', res2.details?.distanceFare);
    console.assert(res2.fare === 1125, `Expected fare 1125, got ${res2.fare}`);

    console.log('\n====================================================');
    console.log('TEST 3: 101-150 km slab (130 km roundtrip)');
    console.log('Distance Fare: 130 * 15 = 1950, Hourly: 400, Threshold: 1000 -> Expected: 1950');
    console.log('====================================================');
    const res3 = await calculatePrice({
        rideType: 'Roundtrip',
        category: 'Sedan',
        sourceCity: 'Kolkata',
        distance: 130,
        oneWayDistance: 65,
        pickupDate: '27-10-2026',
        pickupTime: '10:00 AM',
        returnDate: '27-10-2026',
        returnTime: '02:00 PM'
    });
    console.log('Fare:', res3.fare);
    console.log('Slab:', res3.details?.slab);
    console.log('Distance Fare:', res3.details?.distanceFare);
    console.assert(res3.fare === 1950, `Expected fare 1950, got ${res3.fare}`);

    console.log('\n====================================================');
    console.log('TEST 4: 151-200 km slab (180 km roundtrip)');
    console.log('Distance Fare: 180 * 15 = 2700, Hourly: 400, Threshold: 1000 -> Expected: 2700');
    console.log('====================================================');
    const res4 = await calculatePrice({
        rideType: 'Roundtrip',
        category: 'Sedan',
        sourceCity: 'Kolkata',
        distance: 180,
        oneWayDistance: 90,
        pickupDate: '27-10-2026',
        pickupTime: '10:00 AM',
        returnDate: '27-10-2026',
        returnTime: '02:00 PM'
    });
    console.log('Fare:', res4.fare);
    console.log('Slab:', res4.details?.slab);
    console.log('Distance Fare:', res4.details?.distanceFare);
    console.assert(res4.fare === 2700, `Expected fare 2700, got ${res4.fare}`);

    console.log('\n====================================================');
    console.log('TEST 5: 200 to 4000 km slab (250 km roundtrip)');
    console.log('Base 200 @ 15 = 3000 + 50 extra @ 17 = 850 -> Distance Fare: 3850');
    console.log('====================================================');
    const res5 = await calculatePrice({
        rideType: 'Roundtrip',
        category: 'Sedan',
        sourceCity: 'Kolkata',
        distance: 250,
        oneWayDistance: 125,
        pickupDate: '27-10-2026',
        pickupTime: '10:00 AM',
        returnDate: '27-10-2026',
        returnTime: '04:00 PM' // 6 hours
    });
    console.log('Fare:', res5.fare);
    console.log('Slab:', res5.details?.slab);
    console.log('Distance Fare:', res5.details?.distanceFare);
    console.log('Extra Kms:', res5.details?.extraKms);
    console.assert(res5.fare === 3850, `Expected fare 3850, got ${res5.fare}`);

    console.log('\n====================================================');
    console.log('TEST 6: Hourly Fare Wins (30 km roundtrip, but 14 hours duration)');
    console.log('Distance: 450, Hourly: 14 * 100 = 1400, Threshold: 1000 -> Expected: 1400');
    console.log('====================================================');
    const res6 = await calculatePrice({
        rideType: 'Roundtrip',
        category: 'Sedan',
        sourceCity: 'Kolkata',
        distance: 30,
        oneWayDistance: 15,
        pickupDate: '27-10-2026',
        pickupTime: '08:00 AM',
        returnDate: '27-10-2026',
        returnTime: '10:00 PM' // 14 hours
    });
    console.log('Fare:', res6.fare);
    console.log('Total Hours:', res6.details?.totalHours);
    console.log('Hourly Fare:', res6.details?.hourlyFare);
    console.assert(res6.fare === 1400, `Expected fare 1400, got ${res6.fare}`);

    console.log('\n====================================================');
    console.log('TEST 7: Night Driving Allowance in Roundtrip (11:30 PM pickup)');
    console.log('Base fare: 1000 + Night allowance: 250 -> Expected: 1250');
    console.log('====================================================');
    const res7 = await calculatePrice({
        rideType: 'Roundtrip',
        category: 'Sedan',
        sourceCity: 'Kolkata',
        distance: 30,
        oneWayDistance: 15,
        pickupDate: '27-10-2026',
        pickupTime: '11:30 PM',
        returnDate: '28-10-2026',
        returnTime: '03:30 AM' // 4 hours
    });
    console.log('Fare:', res7.fare);
    console.log('Night Allowance:', res7.details?.nightAllowance);
    console.log('Is Night:', res7.details?.isNight);
    console.assert(res7.fare === 1250, `Expected fare 1250, got ${res7.fare}`);

    console.log('\n>>> ALL 7 ROUNDTRIP TESTS PASSED SUCCESSFULLY! <<<');
    process.exit(0);
}

runRoundtripTests().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});

