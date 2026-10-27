const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../services/pricingService.js');
const content = fs.readFileSync(filePath, 'utf8');

const p2Marker = '// ---------- Priority 2B: State';
const p3Marker = 'if (fallbackResult) {';

const p2Start = content.indexOf(p2Marker);
const p3End = content.indexOf(p3Marker);

if (p2Start === -1 || p3End === -1) {
    throw new Error(`Could not find markers: p2Start=${p2Start}, p3End=${p3End}`);
}

const replacement = `// ---------- Priority 2B: State / City‑wise Outstation Pricing ----------
    let stateRule = null;
    let matchType = '';

    const cleanPickupCity = (city || sourceCity || '').trim();
    const cityTokens = cleanPickupCity.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    // Fetch all active rules for this rideCategory and carCategory
    const candidateRules = await StatePricing.find({
        rideCategory: { $regex: new RegExp('^' + normalizedRideType + '$', 'i') },
        carCategory: { $regex: new RegExp('^' + normalizedCarCategory.replace('+', '\\+') + '$', 'i') },
        status: 'Active'
    }).sort({ updatedAt: -1, createdAt: -1 });

    const filterSeaterAc = (rules) => {
        return rules.find(r =>
            (seater == null || r.seater === parseInt(seater, 10)) &&
            (acType === 'Any' || r.acType === 'Any' || r.acType === acType)
        ) || rules[0];
    };

    // 1. City Match (e.g. Kolkata, Mumbai, Delhi)
    if (cityTokens.length > 0) {
        const cityMatches = candidateRules.filter(r => {
            if (!r.city) return false;
            const rc = r.city.trim().toLowerCase();
            if (rc === 'default' || rc === 'all cities') return false;
            return cityTokens.some(tok => tok === rc || tok.includes(rc) || rc.includes(tok));
        });
        if (cityMatches.length > 0) {
            stateRule = filterSeaterAc(cityMatches);
            matchType = \`City (\${stateRule.city})\`;
        }
    }

    // 2. State Match (e.g. West Bengal, Maharashtra)
    if (!stateRule && resolvedState) {
        const stLower = resolvedState.trim().toLowerCase();
        const stateMatches = candidateRules.filter(r => {
            if (!r.state) return false;
            const rs = r.state.trim().toLowerCase();
            if (rs === 'default' || rs === 'all cities') return false;
            return rs === stLower || rs.includes(stLower) || stLower.includes(rs);
        });
        if (stateMatches.length > 0) {
            stateRule = filterSeaterAc(stateMatches);
            matchType = \`State (\${stateRule.state})\`;
        }
    }

    // 3. Default Outstation Match
    if (!stateRule) {
        const defaultMatches = candidateRules.filter(r => {
            const rc = (r.city || '').trim().toLowerCase();
            const rs = (r.state || '').trim().toLowerCase();
            return rc === 'default' || rs === 'default';
        });
        if (defaultMatches.length > 0) {
            stateRule = filterSeaterAc(defaultMatches);
            matchType = \`Default (\${stateRule.carCategory})\`;
        }
    }

    if (stateRule) {
        console.log(\`[Pricing Engine] Priority 2 Match: StatePricing ID=\${stateRule._id || stateRule.id} [\${matchType}]\`);

        const ratePerKm = safeNumber(stateRule.ratePerKm, 0);
        const extraKmRate = safePositive(stateRule.extraKmRate, ratePerKm);
        const minKms = safeNumber(stateRule.minKms, 0);
        const driverBata = safeNumber(stateRule.driverBata, 0);
        const nightAllowance = safeNumber(stateRule.nightAllowance, 0);
        const toll = safeNumber(stateRule.toll, 0);
        const parking = safeNumber(stateRule.parking, 0);
        const permit = safeNumber(stateRule.permit, 0);
        const stateTax = safeNumber(stateRule.stateTax, 0);
        const airportEntry = safeNumber(stateRule.airportEntry, 0);
        const waitingCharge = safeNumber(stateRule.waitingCharge, 0);
        const otherCharges = safeNumber(stateRule.otherCharges, 0);
        const hourlyRate = safeNumber(stateRule.hourlyRate, 0);
        const threshold = safeNumber(stateRule.threshold, 500);
        const waitingChargePerHour = safeNumber(stateRule.waitingChargePerHour, 150);
        const waitingFreeMins = safeNumber(stateRule.waitingFreeMins, 60);

        let baseFareTotal = 0;
        const details = {
            type: \`Outstation Pricing [\${matchType}]\`,
            city: stateRule.city || cleanPickupCity || 'Default',
            state: stateRule.state || resolvedState || 'Default',
            ratePerKm,
            extraKmRate,
            minKms,
            driverBata,
            nightAllowance,
            waitingChargePerHour,
            waitingFreeMins,
            threshold,
            extraHourRate: safeNumber(stateRule.extraHourRate, 0),
            waitingCharge,
            toll,
            parking,
            permit,
            stateTax,
            airportEntry,
            otherCharges
        };

        if (normalizedRideType === 'Oneway') {
            // Outstation OneWay Slabs:
            // 0 to 50 km -> Billable 50 km
            // 51 to 100 km -> Billable 100 km
            // 101 to 150 km -> Billable 150 km
            // 151 to 200 km (Upto 200 kms) -> Billable 200 km
            // > 200 km (Upto 4000 kms) -> Base 200 km + Extra kms @ extraKmRate
            let slab = '0-50 km';
            let billableKms = 50;
            let extraKms = 0;
            let extraKmCharges = 0;
            let distanceFare = 0;

            if (resolvedDistance <= 50) {
                slab = '0-50 km';
                billableKms = 50;
                distanceFare = billableKms * ratePerKm;
            } else if (resolvedDistance <= 100) {
                slab = '51-100 km';
                billableKms = 100;
                distanceFare = billableKms * ratePerKm;
            } else if (resolvedDistance <= 150) {
                slab = '101-150 km';
                billableKms = 150;
                distanceFare = billableKms * ratePerKm;
            } else if (resolvedDistance <= 200) {
                slab = '151-200 km';
                billableKms = 200;
                distanceFare = billableKms * ratePerKm;
            } else {
                slab = 'Upto 4000 km';
                billableKms = resolvedDistance;
                extraKms = Math.max(0, Math.round((resolvedDistance - 200) * 10) / 10);
                extraKmCharges = extraKms * extraKmRate;
                distanceFare = (200 * ratePerKm) + extraKmCharges;
            }

            // Decimal rates (e.g. 10.2) supported, price calculated round
            distanceFare = Math.round(distanceFare);

            // Night driving allowances: Rs (Applicable once if ride time falls between 11 pm till 6 am)
            const isNight = isNightTime(pickupTime, stateRule.nightStartHour ?? 23, stateRule.nightEndHour ?? 6);
            const appliedNightAllowance = isNight ? nightAllowance : 0;

            const calculatedTotal = Math.round(
                distanceFare + driverBata + appliedNightAllowance + toll + parking +
                permit + stateTax + airportEntry + waitingCharge + otherCharges
            );

            // Threshold comparison: 'which value is more will show in price now set threshold value 500'
            baseFareTotal = Math.max(calculatedTotal, Math.round(threshold));

            Object.assign(details, {
                slab,
                billableKms,
                actualDistance: resolvedDistance,
                extraKms,
                extraKmCharges,
                distanceFare,
                driverBata,
                nightAllowance: appliedNightAllowance,
                isNight,
                rawCalculatedTotal: calculatedTotal,
                threshold,
                isThresholdApplied: calculatedTotal < threshold,
                toll,
                parking,
                permit,
                stateTax,
                airportEntry,
                waitingCharge,
                otherCharges
            });
        }
        else if (normalizedRideType === 'Roundtrip') {
            const rtDays = Math.max(resolvedDays, 1);
            const minKmsTotal = minKms * rtDays;
            const billableKms = Math.max(resolvedDistance, minKmsTotal);
            const distanceFare = billableKms * ratePerKm;

            let totalHours = 24 * rtDays;
            if (pickupDate && pickupTime && returnDate && returnTime) {
                const pickup = new Date(\`\${pickupDate} \${pickupTime}\`);
                const returnDt = new Date(\`\${returnDate} \${returnTime}\`);
                if (!isNaN(pickup.getTime()) && !isNaN(returnDt.getTime())) {
                    const diffMs = returnDt - pickup;
                    if (diffMs > 0) totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
                }
            }

            const hourlyFare = totalHours * hourlyRate;
            const baseFare = Math.max(distanceFare, hourlyFare);

            const totalDriverBata = driverBata * rtDays;
            const totalNight = nightAllowance * rtDays;

            const calculatedTotal = Math.round(
                baseFare + totalDriverBata + totalNight + toll + parking +
                permit + stateTax + airportEntry + waitingCharge + otherCharges
            );

            baseFareTotal = Math.max(calculatedTotal, Math.round(threshold));

            Object.assign(details, {
                rtDays,
                totalHours,
                billableKms,
                minKmsTotal,
                distance: resolvedDistance,
                oneWayDistance: mapRouteInfo?.distanceKm || Math.round((resolvedDistance / 2) * 10) / 10,
                distanceFare: Math.round(distanceFare),
                hourlyFare: Math.round(hourlyFare),
                baseFareChosen: Math.round(baseFare),
                driverBata: totalDriverBata,
                nightAllowance: totalNight,
                rawCalculatedTotal: calculatedTotal,
                threshold,
                isThresholdApplied: calculatedTotal < threshold,
                toll,
                parking,
                permit,
                stateTax,
                airportEntry,
                waitingCharge,
                otherCharges
            });
        }
        else {
            const billableKms = Math.max(resolvedDistance, minKms);
            const distanceFare = Math.round(billableKms * ratePerKm);

            const isNight = isNightTime(pickupTime, stateRule.nightStartHour ?? 23, stateRule.nightEndHour ?? 6);
            const appliedNightAllowance = isNight ? nightAllowance : 0;

            const calculatedTotal = Math.round(
                distanceFare + driverBata + appliedNightAllowance + toll + parking +
                permit + stateTax + airportEntry + waitingCharge + otherCharges
            );

            baseFareTotal = Math.max(calculatedTotal, Math.round(threshold));

            Object.assign(details, {
                billableKms,
                distanceFare,
                driverBata,
                nightAllowance: appliedNightAllowance,
                isNight,
                rawCalculatedTotal: calculatedTotal,
                threshold,
                isThresholdApplied: calculatedTotal < threshold,
                toll,
                parking,
                permit,
                stateTax,
                airportEntry,
                waitingCharge,
                otherCharges
            });
        }

        const result = buildFareResult({
            rawFare: baseFareTotal,
            addonTotal,
            appliedAddons,
            multiplier,
            details: { ...details, distance: resolvedDistance, durationMinutes: mapRouteInfo?.durationMinutes },
            advanceType: stateRule.advanceType || 'Fixed',
            advanceValue: stateRule.advanceValue != null ? stateRule.advanceValue : (stateRule.advanceAmount || 500),
            appliedRule: stateRule._id || stateRule.id,
            ruleType: 'StateGeneral',
            distance: resolvedDistance,
            durationMinutes: mapRouteInfo?.durationMinutes
        });

        if (result) return returnFare(result);
    }

    // ---------- Priority 3: Fallback (Standard CarCategory Rate) ----------
    console.log(\`[Pricing Engine] Priority 3 Match: Standard Category Fallback (\${normalizedCarCategory})\`);

    let carCat = await CarCategory.findOne({
        name: { $regex: new RegExp('^' + normalizedCarCategory.replace('+', '\\+') + '$', 'i') }
    });

    if (!carCat) {
        carCat = await CarCategory.findOne({
            displayName: { $regex: new RegExp(normalizedCarCategory.replace('+', '\\+'), 'i') }
        });
    }

    const defaultRates = {
        'Sedan': { perKmRate: 10.2, extraKmRate: 12, seater: 4, driverBata: 0, nightAllowance: 250, threshold: 500 },
        'Hatchback': { perKmRate: 9.5, extraKmRate: 11, seater: 4, driverBata: 0, nightAllowance: 200, threshold: 500 },
        'SUV': { perKmRate: 14.5, extraKmRate: 16, seater: 6, driverBata: 0, nightAllowance: 300, threshold: 700 },
        'SUV+': { perKmRate: 18.0, extraKmRate: 20, seater: 7, driverBata: 0, nightAllowance: 350, threshold: 800 },
        '13 Seater Traveller': { perKmRate: 28.0, extraKmRate: 30, seater: 13, driverBata: 0, nightAllowance: 450, threshold: 1200 },
        '17 Seater Traveller': { perKmRate: 34.0, extraKmRate: 36, seater: 17, driverBata: 0, nightAllowance: 500, threshold: 1500 },
        '25 Seater Traveller': { perKmRate: 42.0, extraKmRate: 45, seater: 25, driverBata: 0, nightAllowance: 600, threshold: 2000 }
    };

    const def = defaultRates[normalizedCarCategory] || defaultRates['Sedan'];
    const perKmRate = safePositive(carCat ? carCat.perKmRate : def.perKmRate, def.perKmRate);
    const extraKmRate = def.extraKmRate || perKmRate;
    const threshold = def.threshold || 500;
    const waitingChargePerHour = 150;
    const waitingFreeMins = 60;
    const driverBata = def.driverBata || 0;

    let baseFareTotal = 0;
    let slab = '0-50 km';
    let billableKms = 50;
    let extraKms = 0;
    let extraKmCharges = 0;
    let distanceFare = 0;

    if (normalizedRideType === 'Oneway') {
        if (resolvedDistance <= 50) {
            slab = '0-50 km';
            billableKms = 50;
            distanceFare = billableKms * perKmRate;
        } else if (resolvedDistance <= 100) {
            slab = '51-100 km';
            billableKms = 100;
            distanceFare = billableKms * perKmRate;
        } else if (resolvedDistance <= 150) {
            slab = '101-150 km';
            billableKms = 150;
            distanceFare = billableKms * perKmRate;
        } else if (resolvedDistance <= 200) {
            slab = '151-200 km';
            billableKms = 200;
            distanceFare = billableKms * perKmRate;
        } else {
            slab = 'Upto 4000 km';
            billableKms = resolvedDistance;
            extraKms = Math.max(0, Math.round((resolvedDistance - 200) * 10) / 10);
            extraKmCharges = extraKms * extraKmRate;
            distanceFare = (200 * perKmRate) + extraKmCharges;
        }

        distanceFare = Math.round(distanceFare);

        const isNight = isNightTime(pickupTime, 23, 6);
        const nightAllowance = isNight ? def.nightAllowance : 0;

        const calculatedTotal = Math.round(distanceFare + driverBata + nightAllowance);
        baseFareTotal = Math.max(calculatedTotal, threshold);
    } else if (normalizedRideType === 'Roundtrip') {
        const rtDays = Math.max(resolvedDays, 1);
        const minRtKms = Math.max(resolvedDistance, 250 * rtDays);
        baseFareTotal = Math.max(Math.round((minRtKms * perKmRate) + (driverBata * rtDays)), threshold);
        billableKms = minRtKms;
        distanceFare = Math.round(minRtKms * perKmRate);
    } else {
        billableKms = Math.max(resolvedDistance, 50);
        distanceFare = Math.round(billableKms * perKmRate);
        baseFareTotal = Math.max(distanceFare + driverBata, threshold);
    }

    const details = {
        type: \`Standard Rate (\${carCat ? carCat.displayName : normalizedCarCategory})\`,
        ratePerKm: perKmRate,
        extraKmRate,
        slab,
        minKms: billableKms,
        billableKms,
        extraKms,
        extraKmCharges,
        distanceFare,
        driverBata,
        threshold,
        waitingChargePerHour,
        waitingFreeMins,
        nightAllowance: def.nightAllowance,
        distance: resolvedDistance,
        durationMinutes: mapRouteInfo?.durationMinutes
    };

    const fallbackResult = buildFareResult({
        rawFare: baseFareTotal,
        addonTotal,
        appliedAddons,
        multiplier,
        details,
        advanceType: 'Fixed',
        advanceValue: 500,
        appliedRule: carCat ? carCat.id : 'standard-category-rate',
        ruleType: 'CategoryFallback',
        distance: resolvedDistance,
        durationMinutes: mapRouteInfo?.durationMinutes
    });`;

const newContent = content.slice(0, p2Start) + replacement + '\n\n    ' + content.slice(p3End);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully updated services/pricingService.js');

