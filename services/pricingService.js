const RoutePricing = require('../models/RoutePricing');
const StatePricing = require('../models/StatePricing');
const RentalPackage = require('../models/RentalPackage');
const City = require('../models/City');
const CarCategory = require('../models/CarCategory');
const GlobalSetting = require('../models/GlobalSetting');
const mapService = require('./mapService');

// ---------- Add‑on prices ----------
const ADDON_PRICES = {
    assuredLuggageSpace: 1001,
    confirmCarModel2022: 751,
    petAllowance: 1001,
    refundableBooking: 751
};

const RENTAL_FALLBACK_TABLE = {
    'Sedan': {
        5: { kms: 50, fare: 3551, extraKm: 20, extraHr: 200 },
        8: { kms: 80, fare: 4551, extraKm: 20, extraHr: 200 },
        10: { kms: 100, fare: 5051, extraKm: 20, extraHr: 200 },
        12: { kms: 120, fare: 6051, extraKm: 20, extraHr: 200 },
    },
    'SUV': {
        5: { kms: 50, fare: 4551, extraKm: 25, extraHr: 250 },
        8: { kms: 80, fare: 5551, extraKm: 25, extraHr: 250 },
        10: { kms: 100, fare: 7051, extraKm: 25, extraHr: 250 },
        12: { kms: 120, fare: 8051, extraKm: 25, extraHr: 250 },
    },
    'SUV+': {
        5: { kms: 50, fare: 6051, extraKm: 30, extraHr: 300 },
        8: { kms: 80, fare: 7551, extraKm: 30, extraHr: 300 },
        10: { kms: 100, fare: 8051, extraKm: 30, extraHr: 300 },
        12: { kms: 120, fare: 9051, extraKm: 30, extraHr: 300 },
    },
    '13 Seater Traveller': {
        5: { kms: 50, fare: 9051, extraKm: 40, extraHr: 400 },
        8: { kms: 80, fare: 10051, extraKm: 40, extraHr: 400 },
        10: { kms: 100, fare: 11051, extraKm: 40, extraHr: 400 },
        12: { kms: 120, fare: 12051, extraKm: 40, extraHr: 400 },
    },
    '17 Seater Traveller': {
        5: { kms: 50, fare: 10051, extraKm: 45, extraHr: 450 },
        8: { kms: 80, fare: 11051, extraKm: 45, extraHr: 450 },
        10: { kms: 100, fare: 12051, extraKm: 45, extraHr: 450 },
        12: { kms: 120, fare: 13051, extraKm: 45, extraHr: 450 },
    },
    '25 Seater Traveller': {
        5: { kms: 50, fare: 12051, extraKm: 50, extraHr: 500 },
        8: { kms: 80, fare: 13051, extraKm: 50, extraHr: 500 },
        10: { kms: 100, fare: 14051, extraKm: 50, extraHr: 500 },
        12: { kms: 120, fare: 15051, extraKm: 50, extraHr: 500 },
    },
    'Hatchback': {
        5: { kms: 50, fare: 3551, extraKm: 20, extraHr: 200 },
        8: { kms: 80, fare: 4551, extraKm: 20, extraHr: 200 },
        10: { kms: 100, fare: 5051, extraKm: 20, extraHr: 200 },
        12: { kms: 120, fare: 6051, extraKm: 20, extraHr: 200 },
    }
};

// ---------- Numeric safety helpers ----------
// Guarantees we never end up with NaN / undefined / 0 where a real value is expected.
function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

// Same, but for values that MUST be > 0 (e.g. multiplier). Falls back if <= 0.
function safePositive(value, fallback = 1) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------- Haversine distance ----------
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ---------- Normalization ----------
function normalizeRideType(type) {
    if (!type) return 'Oneway';
    const t = type.toLowerCase().replace(/[\s_-]/g, '');
    if (t.includes('oneway')) return 'Oneway';
    if (t.includes('roundtrip')) return 'Roundtrip';
    if (t.includes('rental') || t.includes('local')) return 'Rental';
    if (t.includes('airport')) return 'Airport';
    if (t.includes('station')) return 'Station';
    return 'Oneway';
}

function normalizeCarCategory(cat) {
    if (!cat) return 'Sedan';
    const c = cat.toLowerCase().trim();
    if (c.includes('13') && (c.includes('traveller') || c.includes('tempo') || c.includes('seater'))) return '13 Seater Traveller';
    if (c.includes('17') && (c.includes('traveller') || c.includes('tempo') || c.includes('seater'))) return '17 Seater Traveller';
    if ((c.includes('25') || c.includes('24')) && (c.includes('traveller') || c.includes('tempo') || c.includes('seater'))) return '25 Seater Traveller';
    if (c.includes('traveller') || c.includes('tempo')) return '13 Seater Traveller';
    if (c.includes('hatchback') || c.includes('mini') || c.includes('wagon')) return 'Hatchback';
    if (c.includes('sedan') || c.includes('dzire') || c.includes('etios')) return 'Sedan';
    if (c.includes('suv+') || c.includes('luxury') || c.includes('crysta')) return 'SUV+';
    if (c.includes('suv') || c.includes('ertiga') || c.includes('innova')) return 'SUV';
    return cat.trim();
}

// ---------- Fare builder (single source of truth) ----------
// Returns a fully-formed result ONLY when the fare is a valid positive number.
// Returns null otherwise, so the caller can fall through to the next priority.
function buildFareResult({
    rawFare,
    addonTotal,
    appliedAddons,
    multiplier,
    details,
    advanceType,
    advanceValue,
    appliedRule,
    ruleType,
    distance,
    durationMinutes
}) {
    const safeRaw = safeNumber(rawFare, 0);
    const safeAddon = safeNumber(addonTotal, 0);
    const safeMultiplier = safePositive(multiplier, 1);

    const baseFareWithMultiplier = Math.round(safeRaw * safeMultiplier);
    const finalFare = baseFareWithMultiplier + safeAddon;

    // Hard guard — never emit a 0 / NaN / Infinity fare.
    if (!Number.isFinite(finalFare) || finalFare <= 0) {
        console.warn(
            `[Pricing Engine] Rejected zero/invalid fare (${finalFare}) ` +
            `for rule ${appliedRule} (${ruleType})`
        );
        return null;
    }

    let advance = advanceType === 'Percentage'
        ? Math.round(finalFare * (safeNumber(advanceValue, 0) / 100))
        : Math.round(safeNumber(advanceValue, 0));

    advance = Math.min(Math.max(advance, 0), finalFare);
    const dueFare = Math.max(0, finalFare - advance);

    const resolvedDist = safeNumber(distance ?? details?.distance, 0);
    const resolvedDur = safeNumber(durationMinutes ?? details?.durationMinutes, 0);

    return {
        success: true,
        fare: finalFare,
        advance,
        dueFare,
        distance: resolvedDist,
        durationMinutes: resolvedDur,
        details: {
            ...details,
            distance: resolvedDist,
            durationMinutes: resolvedDur,
            addons: appliedAddons,
            addonTotal: safeAddon
        },
        multiplier: safeMultiplier,
        appliedRule,
        ruleType
    };
}

const UNAVAILABLE = {
    success: false,
    message: 'Currently pricing unavailable for this route. Please contact support team.',
    fare: 0,
    advance: 0,
    dueFare: 0
};

// ---------- Main pricing function ----------
async function calculatePrice({
    rideType,
    sourceCity,
    destinationCity,
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
    category,
    distance,
    oneWayDistance,
    days = 1,
    state,
    acType = 'Any',
    seater,
    pickupDate,
    pickupTime,
    returnDate,
    returnTime,
    packageHours,
    includedKms,
    addons = {}
}) {
    // 1. Global multiplier — never 0 or NaN
    const settings = await GlobalSetting.find();
    const multiplier = safePositive(
        settings.find(s => s.key === 'globalMultiplier')?.value,
        1.0
    );

    // 2. Normalize inputs
    const normalizedRideType = normalizeRideType(rideType);
    const normalizedCarCategory = normalizeCarCategory(category);
    const resolvedDays = Math.max(1, parseInt(safeNumber(days, 1), 10) || 1);

    // If explicit oneWayDistance was passed, derive resolvedDistance based on ride type
    let resolvedDistance = 0;
    if (oneWayDistance != null && safeNumber(oneWayDistance, 0) > 0) {
        const oneWay = safeNumber(oneWayDistance, 0);
        resolvedDistance = normalizedRideType === 'Roundtrip' ? Math.round(oneWay * 2 * 10) / 10 : oneWay;
    } else {
        resolvedDistance = Math.max(0, safeNumber(distance, 0));
    }

    // 3. Resolve coordinates & driving road distance using Map API (OSRM / Nominatim)
    let pLat = pickupLat != null ? safeNumber(pickupLat, null) : null;
    let pLng = pickupLng != null ? safeNumber(pickupLng, null) : null;
    let dLat = dropLat != null ? safeNumber(dropLat, null) : null;
    let dLng = dropLng != null ? safeNumber(dropLng, null) : null;

    let mapRouteInfo = null;

    // If distance is missing, or 0, or if coordinates need to be resolved
    if (resolvedDistance <= 0 || pLat === null || dLat === null) {
        mapRouteInfo = await mapService.calculateDistanceBetween({
            from: sourceCity,
            to: destinationCity,
            pickupLat: pLat,
            pickupLng: pLng,
            dropLat: dLat,
            dropLng: dLng
        });

        if (mapRouteInfo) {
            if (mapRouteInfo.distanceKm > 0 && (resolvedDistance <= 0 || !oneWayDistance)) {
                // For Roundtrip, the driving road distance is doubled for the return journey
                resolvedDistance = normalizedRideType === 'Roundtrip'
                    ? Math.round(mapRouteInfo.distanceKm * 2 * 10) / 10
                    : mapRouteInfo.distanceKm;
                console.log(`[Pricing Engine] Distance resolved via ${mapRouteInfo.source}: ${resolvedDistance} km (${mapRouteInfo.durationMinutes} mins, ${normalizedRideType})`);
            }
            if ((pLat === null || pLng === null) && mapRouteInfo.pickupCoords?.lat != null) {
                pLat = mapRouteInfo.pickupCoords.lat;
                pLng = mapRouteInfo.pickupCoords.lng;
            }
            if ((dLat === null || dLng === null) && mapRouteInfo.dropCoords?.lat != null) {
                dLat = mapRouteInfo.dropCoords.lat;
                dLng = mapRouteInfo.dropCoords.lng;
            }
        }
    }

    // 4. Resolve state from source city if not provided
    let resolvedState = state;
    if (!resolvedState && sourceCity) {
        const cityData = await City.findOne({
            name: { $regex: new RegExp('^' + sourceCity.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
        });
        if (cityData && cityData.state) resolvedState = cityData.state;
    }

    console.log(
        `[Pricing Engine] Category=${normalizedCarCategory}, RideType=${normalizedRideType}, ` +
        `Dist=${resolvedDistance}, State=${resolvedState}`
    );

    // 5. Calculate add‑on total
    let addonTotal = 0;
    const appliedAddons = {};
    for (const [key, price] of Object.entries(ADDON_PRICES)) {
        if (addons[key]) {
            addonTotal += safeNumber(price, 0);
            appliedAddons[key] = safeNumber(price, 0);
        }
    }

    // ---------- Priority 1: Route‑Specific Pricing ----------
    let routeRule = null;

    // Exact text match
    if (sourceCity && destinationCity) {
        routeRule = await RoutePricing.findOne({
            rideCategory: normalizedRideType,
            carCategory: normalizedCarCategory,
            pickupLocation: { $regex: new RegExp('^' + sourceCity.trim() + '$', 'i') },
            dropLocation: { $regex: new RegExp('^' + destinationCity.trim() + '$', 'i') },
            status: 'Active'
        });
    }

    // Radius match if no exact match
    if (!routeRule && pLat !== null && pLng !== null && dLat !== null && dLng !== null) {
        const activeRouteRules = await RoutePricing.find({
            rideCategory: normalizedRideType,
            carCategory: normalizedCarCategory,
            status: 'Active'
        });

        for (const rule of activeRouteRules) {
            if (rule.pickupLat != null && rule.pickupLng != null &&
                rule.dropLat != null && rule.dropLng != null) {
                const distPickup = getHaversineDistance(
                    pLat, pLng,
                    safeNumber(rule.pickupLat, null), safeNumber(rule.pickupLng, null)
                );
                const distDrop = getHaversineDistance(
                    dLat, dLng,
                    safeNumber(rule.dropLat, null), safeNumber(rule.dropLng, null)
                );
                const radius = safeNumber(rule.nearbyRadiusKm, 0);
                if (distPickup <= radius && distDrop <= radius) {
                    routeRule = rule;
                    break;
                }
            }
        }
    }

    // Reject a matched route rule whose fixedPrice is missing / zero — fall through instead.
    if (routeRule && safeNumber(routeRule.fixedPrice, 0) <= 0) {
        console.warn(
            `[Pricing Engine] RoutePricing ${routeRule._id} has invalid fixedPrice ` +
            `(${routeRule.fixedPrice}) — skipping`
        );
        routeRule = null;
    }

    if (routeRule) {
        console.log(`[Pricing Engine] Priority 1 Match: RoutePricing ID=${routeRule._id}`);

        const fixedPrice = safeNumber(routeRule.fixedPrice, 0);
        const details = {
            type: 'Route-specific Fixed Price',
            pickup: routeRule.pickupLocation,
            drop: routeRule.dropLocation,
            baseFare: fixedPrice
        };

        if (routeRule.includeToll) details.tollTax = 'Included';
        if (routeRule.includeParking) details.parking = 'Included';
        if (routeRule.includeNightAllowance) details.nightAllowance = 'Included';

        const result = buildFareResult({
            rawFare: fixedPrice,
            addonTotal,
            appliedAddons,
            multiplier,
            details: { ...details, distance: resolvedDistance, durationMinutes: mapRouteInfo?.durationMinutes },
            advanceType: routeRule.advanceType,
            advanceValue: routeRule.advanceValue,
            appliedRule: routeRule._id,
            ruleType: 'RouteSpecific',
            distance: resolvedDistance,
            durationMinutes: mapRouteInfo?.durationMinutes
        });

        if (result) return result;
        // else fall through to Priority 2
    }

    // ---------- Priority 2A: Rental Package Pricing ----------
    if (normalizedRideType === 'Rental') {
        const pkgHours = packageHours ? parseInt(safeNumber(packageHours, 8), 10) || 8 : 8;
        const pkgKms = includedKms ? parseInt(safeNumber(includedKms, 80), 10) || 80 : 80;

        let pkg = null;
        if (resolvedState) {
            pkg = await RentalPackage.findOne({
                state: { $regex: new RegExp('^' + resolvedState.trim() + '$', 'i') },
                carCategory: normalizedCarCategory,
                packageHours: pkgHours,
                includedKms: pkgKms,
                status: 'Active'
            });
        }
        if (!pkg) {
            pkg = await RentalPackage.findOne({
                state: 'Default',
                carCategory: normalizedCarCategory,
                packageHours: pkgHours,
                includedKms: pkgKms,
                status: 'Active'
            });
        }

        const fallbackPkg = RENTAL_FALLBACK_TABLE[normalizedCarCategory]?.[pkgHours];
        const baseFareVal = pkg && safeNumber(pkg.baseFare, 0) > 0
            ? safeNumber(pkg.baseFare, 0)
            : (fallbackPkg?.fare || 0);

        if (baseFareVal > 0) {
            console.log(`[Pricing Engine] Priority 2A Match: Rental Package (${normalizedCarCategory}, ${pkgHours}h/${pkgKms}km, fare=${baseFareVal})`);

            const extraKmRate = pkg ? safeNumber(pkg.extraKmRate, 0) : (fallbackPkg?.extraKm || 0);
            const extraHourRate = pkg ? safeNumber(pkg.extraHourRate, 0) : (fallbackPkg?.extraHr || 0);

            let baseFare = baseFareVal;
            const details = {
                type: `Rental Package (${pkgHours} hrs / ${pkgKms} km)`,
                baseFare: baseFareVal,
                extraKmRate,
                extraHourRate,
                includedKms: pkgKms,
                packageHours: pkgHours
            };

            const extraKms = Math.max(0, resolvedDistance - pkgKms);
            let extraHours = 0;

            if (pickupDate && pickupTime && returnDate && returnTime) {
                const pickup = new Date(`${pickupDate} ${pickupTime}`);
                const returnDt = new Date(`${returnDate} ${returnTime}`);
                if (!isNaN(pickup.getTime()) && !isNaN(returnDt.getTime())) {
                    const diffMs = returnDt - pickup;
                    if (diffMs > 0) {
                        const actualHours = Math.ceil(diffMs / (1000 * 60 * 60));
                        extraHours = Math.max(0, actualHours - pkgHours);
                    }
                }
            }

            if (extraKms > 0 || extraHours > 0) {
                const extraCharges = (extraKms * extraKmRate) + (extraHours * extraHourRate);
                baseFare += safeNumber(extraCharges, 0);
                details.extraKms = extraKms;
                details.extraHours = extraHours;
                details.extraCharges = safeNumber(extraCharges, 0);
            }

            const rentalDist = resolvedDistance > 0 ? resolvedDistance : pkgKms;
            const rentalDuration = (mapRouteInfo?.durationMinutes && mapRouteInfo.durationMinutes > 0)
                ? mapRouteInfo.durationMinutes
                : (pkgHours * 60);

            const result = buildFareResult({
                rawFare: baseFare,
                addonTotal,
                appliedAddons,
                multiplier,
                details: { ...details, distance: rentalDist, durationMinutes: rentalDuration },
                advanceType: pkg?.advanceType || 'Percentage',
                advanceValue: pkg?.advanceValue != null ? pkg.advanceValue : 20,
                appliedRule: pkg?._id || `rental-${normalizedCarCategory}-${pkgHours}h`,
                ruleType: 'RentalPackage',
                distance: rentalDist,
                durationMinutes: rentalDuration
            });

            if (result) return result;
        }
    }

    // ---------- Priority 2B: State‑wise General Pricing ----------
    if (resolvedState) {
        const stateQuery = {
            state: { $regex: new RegExp('^' + resolvedState.trim() + '$', 'i') },
            rideCategory: normalizedRideType,
            carCategory: normalizedCarCategory,
            status: 'Active'
        };

        const stateRules = await StatePricing.find(stateQuery);

        // Filter by seater / acType if provided
        const stateRule = stateRules.find(r =>
            (seater == null || r.seater === parseInt(seater, 10)) &&
            (acType === 'Any' || r.acType === 'Any' || r.acType === acType)
        ) || stateRules[0];

        if (stateRule) {
            console.log(`[Pricing Engine] Priority 2 Match: StatePricing ID=${stateRule._id}`);

            const ratePerKm = safeNumber(stateRule.ratePerKm, 0);
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

            let baseFareTotal = 0;
            const details = {
                type: `State-wise General Pricing (${resolvedState})`,
                ratePerKm,
                minKms,
                driverBata,
                nightAllowance,
                extraKmRate: safeNumber(stateRule.extraKmRate, 0),
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
                const billableKms = Math.max(resolvedDistance, minKms);
                const distanceFare = billableKms * ratePerKm;

                let night = 0;
                if (pickupTime) {
                    const hour = parseInt(String(pickupTime).split(':')[0], 10);
                    if (!isNaN(hour) && (hour >= 22 || hour < 6)) night = nightAllowance;
                }

                baseFareTotal = distanceFare + driverBata + night + toll + parking +
                    permit + stateTax + airportEntry + waitingCharge + otherCharges;

                Object.assign(details, {
                    billableKms,
                    distanceFare,
                    driverBata,
                    nightAllowance: night,
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
                    const pickup = new Date(`${pickupDate} ${pickupTime}`);
                    const returnDt = new Date(`${returnDate} ${returnTime}`);
                    if (!isNaN(pickup.getTime()) && !isNaN(returnDt.getTime())) {
                        const diffMs = returnDt - pickup;
                        if (diffMs > 0) totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
                    }
                }

                const hourlyFare = totalHours * hourlyRate;
                const baseFare = Math.max(distanceFare, hourlyFare);

                const totalDriverBata = driverBata * rtDays;
                const totalNight = nightAllowance * rtDays;

                baseFareTotal = baseFare + totalDriverBata + totalNight + toll + parking +
                    permit + stateTax + airportEntry + waitingCharge + otherCharges;

                Object.assign(details, {
                    rtDays,
                    totalHours,
                    billableKms,
                    minKmsTotal,
                    distance: resolvedDistance,
                    oneWayDistance: mapRouteInfo?.distanceKm || Math.round((resolvedDistance / 2) * 10) / 10,
                    distanceFare,
                    hourlyFare,
                    baseFareChosen: baseFare,
                    driverBata: totalDriverBata,
                    nightAllowance: totalNight,
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
                // Airport, Station, or any other fallback
                const billableKms = Math.max(resolvedDistance, minKms);
                const distanceFare = billableKms * ratePerKm;

                let night = 0;
                if (pickupTime) {
                    const hour = parseInt(String(pickupTime).split(':')[0], 10);
                    if (!isNaN(hour) && (hour >= 22 || hour < 6)) night = nightAllowance;
                }

                baseFareTotal = distanceFare + driverBata + night + toll + parking +
                    permit + stateTax + airportEntry + waitingCharge + otherCharges;

                Object.assign(details, {
                    billableKms,
                    distanceFare,
                    driverBata,
                    nightAllowance: night,
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
                advanceType: stateRule.advanceType,
                advanceValue: stateRule.advanceValue,
                appliedRule: stateRule._id,
                ruleType: 'StateGeneral',
                distance: resolvedDistance,
                durationMinutes: mapRouteInfo?.durationMinutes
            });

            if (result) return result;
            // else fall through to Priority 3
        }
    }

    // ---------- Priority 3: Fallback (Standard CarCategory Rate) ----------
    console.log(`[Pricing Engine] Priority 3 Match: Standard Category Fallback (${normalizedCarCategory})`);

    let carCat = await CarCategory.findOne({
        name: { $regex: new RegExp('^' + normalizedCarCategory.replace('+', '\\+') + '$', 'i') }
    });

    if (!carCat) {
        carCat = await CarCategory.findOne({
            displayName: { $regex: new RegExp(normalizedCarCategory.replace('+', '\\+'), 'i') }
        });
    }

    const defaultRates = {
        'Sedan': { perKmRate: 15, seater: 4, driverBata: 250, nightAllowance: 250 },
        'SUV': { perKmRate: 20, seater: 6, driverBata: 300, nightAllowance: 300 },
        'SUV+': { perKmRate: 25, seater: 7, driverBata: 350, nightAllowance: 350 },
        '13 Seater Traveller': { perKmRate: 40, seater: 13, driverBata: 450, nightAllowance: 450 },
        '17 Seater Traveller': { perKmRate: 45, seater: 17, driverBata: 500, nightAllowance: 500 },
        '25 Seater Traveller': { perKmRate: 50, seater: 25, driverBata: 600, nightAllowance: 600 },
        'Hatchback': { perKmRate: 15, seater: 4, driverBata: 200, nightAllowance: 200 }
    };

    const def = defaultRates[normalizedCarCategory] || defaultRates['Sedan'];
    const perKmRate = safePositive(carCat ? carCat.perKmRate : def.perKmRate, def.perKmRate);
    const minKms = 100;
    const billableKms = Math.max(resolvedDistance, minKms);
    const driverBata = (carCat ? carCat.seater : def.seater) > 4 ? def.driverBata : 250;

    let baseFareTotal = (billableKms * perKmRate) + driverBata;

    if (normalizedRideType === 'Roundtrip') {
        const rtDays = Math.max(resolvedDays, 1);
        const minRtKms = Math.max(resolvedDistance, 250 * rtDays);
        baseFareTotal = (minRtKms * perKmRate) + (driverBata * rtDays);
    }

    const details = {
        type: `Standard Rate (${carCat ? carCat.displayName : normalizedCarCategory})`,
        ratePerKm: perKmRate,
        minKms,
        billableKms,
        distanceFare: billableKms * perKmRate,
        driverBata,
        distance: resolvedDistance,
        durationMinutes: mapRouteInfo?.durationMinutes
    };

    const fallbackResult = buildFareResult({
        rawFare: baseFareTotal,
        addonTotal,
        appliedAddons,
        multiplier,
        details,
        advanceType: 'Percentage',
        advanceValue: 20,
        appliedRule: carCat ? carCat.id : 'standard-category-rate',
        ruleType: 'CategoryFallback',
        distance: resolvedDistance,
        durationMinutes: mapRouteInfo?.durationMinutes
    });

    if (fallbackResult) {
        return fallbackResult;
    }

    return { ...UNAVAILABLE };
}

module.exports = {
    calculatePrice,
    normalizeRideType,
    normalizeCarCategory,
    ADDON_PRICES
};