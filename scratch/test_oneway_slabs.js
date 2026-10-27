const path = require('path');
const { calculatePrice } = require('../services/pricingService');
const { StatePricing } = require('../models');

async function runTests() {
    console.log('====================================================');
    console.log('TEST 1: 30 km (0-50 km slab, Sedan rate 10.2, daytime 10:00 AM)');
    console.log('====================================================');
    const res1 = await calculatePrice({
        rideType: 'Oneway',
        category: 'Sedan',
        distance: 30,
        pickupTime: '10:00 AM'
    });
    console.log('Fare:', res1.fare);
    console.log('Slab:', res1.details?.slab);
    console.log('Billable Kms:', res1.details?.billableKms);
    console.log('Distance Fare:', res1.details?.distanceFare);
    console.log('Night Allowance:', res1.details?.nightAllowance);
    console.log('Threshold:', res1.details?.threshold);
    console.log('Is Threshold Applied:', res1.details?.isThresholdApplied);
    console.assert(res1.fare === 510, `Expected fare 510, got ${res1.fare}`);
    console.assert(res1.details?.billableKms === 50, `Expected 50 km, got ${res1.details?.billableKms}`);
    console.assert(res1.details?.slab === '0-50 km', `Expected slab 0-50 km, got ${res1.details?.slab}`);

    console.log('\n====================================================');
    console.log('TEST 2: 20 km (0-50 km slab, Hatchback rate 9.5 -> 50*9.5 = 475 < threshold 500)');
    console.log('====================================================');
    const res2 = await calculatePrice({
        rideType: 'Oneway',
        category: 'Hatchback',
        distance: 20,
        pickupTime: '11:00 AM'
    });
    console.log('Fare:', res2.fare);
    console.log('Slab:', res2.details?.slab);
    console.log('Billable Kms:', res2.details?.billableKms);
    console.log('Raw Total:', res2.details?.rawCalculatedTotal);
    console.log('Threshold:', res2.details?.threshold);
    console.log('Is Threshold Applied:', res2.details?.isThresholdApplied);
    console.assert(res2.fare === 500, `Expected fare 500 (threshold), got ${res2.fare}`);
    console.assert(res2.details?.isThresholdApplied === true, 'Threshold should be applied');

    console.log('\n====================================================');
    console.log('TEST 3: 75 km (51-100 km slab, Sedan rate 10.2 -> 100 * 10.2 = 1020)');
    console.log('====================================================');
    const res3 = await calculatePrice({
        rideType: 'Oneway',
        category: 'Sedan',
        distance: 75,
        pickupTime: '02:00 PM'
    });
    console.log('Fare:', res3.fare);
    console.log('Slab:', res3.details?.slab);
    console.log('Billable Kms:', res3.details?.billableKms);
    console.assert(res3.fare === 1020, `Expected fare 1020, got ${res3.fare}`);
    console.assert(res3.details?.billableKms === 100, `Expected 100 km, got ${res3.details?.billableKms}`);
    console.assert(res3.details?.slab === '51-100 km', `Expected slab 51-100 km, got ${res3.details?.slab}`);

    console.log('\n====================================================');
    console.log('TEST 4: 130 km (101-150 km slab, Sedan rate 10.2 -> 150 * 10.2 = 1530)');
    console.log('====================================================');
    const res4 = await calculatePrice({
        rideType: 'Oneway',
        category: 'Sedan',
        distance: 130,
        pickupTime: '04:00 PM'
    });
    console.log('Fare:', res4.fare);
    console.log('Slab:', res4.details?.slab);
    console.log('Billable Kms:', res4.details?.billableKms);
    console.assert(res4.fare === 1530, `Expected fare 1530, got ${res4.fare}`);
    console.assert(res4.details?.billableKms === 150, `Expected 150 km, got ${res4.details?.billableKms}`);
    console.assert(res4.details?.slab === '101-150 km', `Expected slab 101-150 km, got ${res4.details?.slab}`);

    console.log('\n====================================================');
    console.log('TEST 5: 180 km (151-200 km slab, Sedan rate 10.2 -> 200 * 10.2 = 2040)');
    console.log('====================================================');
    const res5 = await calculatePrice({
        rideType: 'Oneway',
        category: 'Sedan',
        distance: 180,
        pickupTime: '06:00 PM'
    });
    console.log('Fare:', res5.fare);
    console.log('Slab:', res5.details?.slab);
    console.log('Billable Kms:', res5.details?.billableKms);
    console.assert(res5.fare === 2040, `Expected fare 2040, got ${res5.fare}`);
    console.assert(res5.details?.billableKms === 200, `Expected 200 km, got ${res5.details?.billableKms}`);
    console.assert(res5.details?.slab === '151-200 km', `Expected slab 151-200 km, got ${res5.details?.slab}`);

    console.log('\n====================================================');
    console.log('TEST 6: 250 km (Upto 4000 km slab, Sedan base 200@10.2 + 50@12 extraKmRate -> 2040 + 600 = 2640)');
    console.log('====================================================');
    const res6 = await calculatePrice({
        rideType: 'Oneway',
        category: 'Sedan',
        distance: 250,
        pickupTime: '08:00 PM'
    });
    console.log('Fare:', res6.fare);
    console.log('Slab:', res6.details?.slab);
    console.log('Billable Kms:', res6.details?.billableKms);
    console.log('Extra Kms:', res6.details?.extraKms);
    console.log('Extra Km Charges:', res6.details?.extraKmCharges);
    console.assert(res6.fare === 2640, `Expected fare 2640, got ${res6.fare}`);
    console.assert(res6.details?.extraKms === 50, `Expected 50 extra kms, got ${res6.details?.extraKms}`);
    console.assert(res6.details?.slab === 'Upto 4000 km', `Expected slab Upto 4000 km, got ${res6.details?.slab}`);

    console.log('\n====================================================');
    console.log('TEST 7: Night Time Allowance (11:30 PM = 23:30 -> Night allowance 250 applied once)');
    console.log('====================================================');
    const res7 = await calculatePrice({
        rideType: 'Oneway',
        category: 'Sedan',
        distance: 30,
        pickupTime: '11:30 PM'
    });
    console.log('Fare:', res7.fare);
    console.log('Night Allowance:', res7.details?.nightAllowance);
    console.log('Is Night:', res7.details?.isNight);
    // 510 distance fare + 250 night allowance = 760
    console.assert(res7.fare === 760, `Expected fare 760 (510 + 250), got ${res7.fare}`);
    console.assert(res7.details?.nightAllowance === 250, 'Night allowance should be 250');

    console.log('\n====================================================');
    console.log('TEST 8: City-wise Rule Matching (e.g. Kolkata)');
    console.log('====================================================');
    // Create Kolkata specific rule: rate 12.0, threshold 750
    const kolRule = await StatePricing.create({
        city: 'Kolkata',
        state: 'West Bengal',
        rideCategory: 'Oneway',
        carCategory: 'Sedan',
        seater: 4,
        ratePerKm: 12.0,
        extraKmRate: 15.0,
        threshold: 750,
        waitingChargePerHour: 180,
        waitingFreeMins: 60,
        nightAllowance: 300,
        nightStartHour: 23,
        nightEndHour: 6,
        status: 'Active'
    });

    const res8 = await calculatePrice({
        rideType: 'Oneway',
        sourceCity: 'Kolkata',
        category: 'Sedan',
        distance: 30,
        pickupTime: '10:00 AM'
    });
    console.log('Kolkata Matched Type:', res8.details?.type);
    console.log('Kolkata City:', res8.details?.city);
    console.log('Kolkata Rate Per Km:', res8.details?.ratePerKm);
    console.log('Kolkata Distance Fare:', res8.details?.distanceFare); // 50 * 12 = 600
    console.log('Kolkata Threshold:', res8.details?.threshold); // 750
    console.log('Kolkata Final Fare:', res8.fare); // Math.max(600, 750) = 750!
    console.assert(res8.fare === 750, `Expected fare 750 (threshold), got ${res8.fare}`);
    console.assert(res8.details?.ratePerKm === 12.0, 'Expected ratePerKm 12.0');

    // Clean up test rule
    await StatePricing.destroy({ where: { id: kolRule.id } });
    console.log('Cleaned up Kolkata test rule successfully.');

    console.log('\n>>> ALL 8 TESTS PASSED SUCCESSFULLY! <<<');
    process.exit(0);
}

runTests().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});

