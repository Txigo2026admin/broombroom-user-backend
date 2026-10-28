const RoutePricing = require('../models/RoutePricing');
const StatePricing = require('../models/StatePricing');
const RentalPackage = require('../models/RentalPackage');
const AirportPricing = require('../models/AirportPricing');
const Airport = require('../models/Airport');
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

// Default Airport Transfer Fallback (0-15 km base, extra kms, waiting, night allowance, threshold)
const AIRPORT_FALLBACK_TABLE = {
    'Sedan': { baseKms: 15, baseFare: 750, extraKmRate: 16, advanceAmount: 500, waitingChargePerHour: 150, nightAllowance: 250, threshold: 500 },
    'Hatchback': { baseKms: 15, baseFare: 650, extraKmRate: 14, advanceAmount: 500, waitingChargePerHour: 150, nightAllowance: 200, threshold: 500 },
    'SUV': { baseKms: 15, baseFare: 1050, extraKmRate: 20, advanceAmount: 500, waitingChargePerHour: 200, nightAllowance: 300, threshold: 500 },
    'SUV+': { baseKms: 15, baseFare: 1350, extraKmRate: 24, advanceAmount: 500, waitingChargePerHour: 250, nightAllowance: 350, threshold: 500 },
    '13 Seater Traveller': { baseKms: 15, baseFare: 2500, extraKmRate: 35, advanceAmount: 1000, waitingChargePerHour: 350, nightAllowance: 450, threshold: 1000 },
    '17 Seater Traveller': { baseKms: 15, baseFare: 3000, extraKmRate: 40, advanceAmount: 1000, waitingChargePerHour: 400, nightAllowance: 500, threshold: 1000 },
    '25 Seater Traveller': { baseKms: 15, baseFare: 3800, extraKmRate: 48, advanceAmount: 1500, waitingChargePerHour: 500, nightAllowance: 600, threshold: 1500 },
};

function isNightTime(timeStr, startHour = 23, endHour = 6) {
    if (!timeStr) return false;
    try {
        const s = String(timeStr).trim().toLowerCase();
        const isPM = s.includes('pm');
        const isAM = s.includes('am');
        const match = s.match(/(\d+)(?::(\d+))?/);
        if (!match) return false;

        let hour = parseInt(match[1], 10);
        if (isPM && hour < 12) hour += 12;
        if (isAM && hour === 12) hour = 0;

        if (startHour > endHour) {
            return hour >= startHour || hour < endHour;
        } else {
            return hour >= startHour && hour < endHour;
        }
    } catch (_) {
        return false;
    }
}

function parseDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    try {
        let y, m, d;
        const dClean = String(dateStr).trim();
        if (dClean.includes('-')) {
            const parts = dClean.split('-');
            if (parts[0].length === 4) {
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                d = parseInt(parts[2], 10);
            } else {
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                y = parseInt(parts[2], 10);
            }
        } else if (dClean.includes('/')) {
            const parts = dClean.split('/');
            if (parts[2].length === 4) {
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                y = parseInt(parts[2], 10);
            } else {
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                d = parseInt(parts[2], 10);
            }
        }

        let hour = 0, minute = 0;
        if (timeStr) {
            const tClean = String(timeStr).trim().toLowerCase();
            const isPM = tClean.includes('pm');
            const isAM = tClean.includes('am');
            const match = tClean.match(/(\d+)(?::(\d+))?/);
            if (match) {
                hour = parseInt(match[1], 10);
                minute = match[2] ? parseInt(match[2], 10) : 0;
                if (isPM && hour < 12) hour += 12;
                if (isAM && hour === 12) hour = 0;
            }
        }

        if (y && m != null && d) {
            const dt = new Date(y, m, d, hour, minute);
            if (!isNaN(dt.getTime())) return dt;
        }
        const fallback = new Date(`${dateStr} ${timeStr || ''}`);
        return isNaN(fallback.getTime()) ? null : fallback;
    } catch (_) {
        return null;
    }
}

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

function attachAirportNotice(result, shiftedFromAirport, distance) {
    if (!result || !shiftedFromAirport) return result;
    result.shiftedFromAirport = true;
    result.redirectedToOutstation = true;
    result.exceededAirportLimit = true;
    result.maxAirportKms = 25;
    result.originalRideType = 'Airport';
    result.rideCategory = 'Oneway';
    result.airportNotice = `Trip distance (${distance} km) exceeds the 25 km airport limit. Automatically switched to Outstation one-way pricing.`;
    if (result.details) {
        result.details.shiftedFromAirport = true;
        result.details.redirectedToOutstation = true;
        result.details.airportNotice = result.airportNotice;
        result.details.type = `Outstation Oneway (Airport Distance > 25 km)`;
    }
    return result;
}

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
    const originalFare = Math.round(finalFare * 1.12);
    const discountPercent = 11;

    // Hard guard — never emit a 0 / NaN / Infinity fare.
    if (!Number.isFinite(finalFare) || finalFare <= 0) {
        console.warn(
            `[Pricing Engine] Rejected zero/invalid fare (${finalFare}) ` +
            `for rule ${appliedRule} (${ruleType})`
        );
        return null;
    }

    let advance = advanceType === 'Percentage'
        ? Math.round(finalFare * (safeNumber(advanceValue, 20) / 100))
        : Math.round(safeNumber(advanceValue, 0));

    advance = Math.min(Math.max(advance, 0), finalFare);
    const dueFare = Math.max(0, finalFare - advance);

    const resolvedDist = safeNumber(distance ?? details?.distance, 0);
    const resolvedDur = safeNumber(durationMinutes ?? details?.durationMinutes, 0);

    const resolvedAdvancePct = advanceType === 'Percentage'
        ? safeNumber(advanceValue, 20)
        : (finalFare > 0 ? Math.round((advance / finalFare) * 100) : 0);

    return {
        success: true,
        fare: finalFare,
        originalFare,
        discountPercent,
        advance,
        dueFare,
        advanceType: advanceType || 'Percentage',
        advanceValue: safeNumber(advanceValue, resolvedAdvancePct),
        advancePercentage: resolvedAdvancePct,
        distance: resolvedDist,
        durationMinutes: resolvedDur,
        details: {
            ...details,
            originalFare,
            discountPercent,
            distance: resolvedDist,
            durationMinutes: resolvedDur,
            addons: appliedAddons,
            addonTotal: safeAddon,
            advanceType: advanceType || 'Percentage',
            advanceValue: safeNumber(advanceValue, resolvedAdvancePct),
            advancePercentage: resolvedAdvancePct
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
    bookingDuration,
    durationHours,
    hours,
    state,
    city,
    airportName,
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
    // 1. Global multiplier & Advance percentage — never 0 or NaN
    const settings = await GlobalSetting.find();
    const multiplier = safePositive(
        settings.find(s => s.key === 'globalMultiplier')?.value,
        1.0
    );
    const globalAdvancePct = safePositive(
        settings.find(s => s.key === 'advancePercentage')?.value,
        20
    );

    // 2. Normalize inputs
    let normalizedRideType = normalizeRideType(rideType);
    let shiftedFromAirport = false;
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

    const returnFare = (res) => {
        if (!res) return res;
        if (shiftedFromAirport) {
            res.shiftedFromAirport = true;
            res.redirectedToOutstation = true;
            res.exceededAirportLimit = true;
            res.maxAirportKms = 25;
            res.originalRideType = 'Airport';
            res.rideCategory = 'Oneway';
            res.airportNotice = `Trip distance (${res.distance || resolvedDistance} km) exceeds the 25 km airport limit. Automatically switched to Outstation one-way pricing.`;
            if (res.details) {
                res.details.shiftedFromAirport = true;
                res.details.redirectedToOutstation = true;
                res.details.airportNotice = res.airportNotice;
                res.details.type = `Outstation Oneway (Airport Distance > 25 km)`;
            }
        }
        return res;
    };

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
            if (mapRouteInfo.distanceKm > 0 && resolvedDistance <= 0) {
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

    // ---------- Priority 1 (for Airport): Airport Transfer Pricing (City-wise, 0-15 km fixed, 15-25 km tier, >25 km outstation redirect) ----------
    if (normalizedRideType === 'Airport') {
        const allAirportRules = await AirportPricing.find({
            carCategory: { $regex: new RegExp('^' + normalizedCarCategory.replace('+', '\\+') + '$', 'i') },
            status: 'Active'
        }).sort({ updatedAt: -1, createdAt: -1 });

        const allAirports = await Airport.findAll();
        const combinedAirportText = `${sourceCity || ''} ${destinationCity || ''} ${airportName || ''} ${city || ''}`.trim();
        const lowerAirportText = combinedAirportText.toLowerCase();

        let airportObj = null;

        // 1. By 3-letter IATA code (e.g. BOM, CCU, DEL, BLR, HYD, MAA, PNQ, etc.)
        const iataMatches = combinedAirportText.match(/\b([A-Za-z]{3})\b/g);
        if (iataMatches) {
            for (const code of iataMatches) {
                const found = allAirports.find(a => a.code && a.code.toUpperCase() === code.toUpperCase());
                if (found) {
                    airportObj = found;
                    break;
                }
            }
        }

        // 2. By airport full name or code contained in the input
        if (!airportObj) {
            airportObj = allAirports.find(a => {
                const aName = (a.name || '').toLowerCase();
                const aCode = (a.code || '').toLowerCase();
                return (aName && lowerAirportText.includes(aName)) || (aCode && lowerAirportText.includes(aCode));
            });
        }

        // 3. By airport geographic coordinates (pickup or drop within 15 km)
        if (!airportObj && ((pLat != null && pLng != null) || (dLat != null && dLng != null))) {
            let closestDist = Infinity;
            for (const a of allAirports) {
                if (a.lat != null && a.lon != null) {
                    const distP = (pLat != null && pLng != null) ? getHaversineDistance(pLat, pLng, a.lat, a.lon) : Infinity;
                    const distD = (dLat != null && dLng != null) ? getHaversineDistance(dLat, dLng, a.lat, a.lon) : Infinity;
                    const minDist = Math.min(distP, distD);
                    if (minDist <= 15 && minDist < closestDist) {
                        closestDist = minDist;
                        airportObj = a;
                    }
                }
            }
        }

        // 4. By airport city in the input
        if (!airportObj) {
            airportObj = allAirports.find(a => {
                const aCity = (a.city || '').toLowerCase();
                return aCity && lowerAirportText.includes(aCity);
            });
        }

        const airportCity = airportObj ? (airportObj.city || '').trim() : (city ? String(city).trim() : null);
        const airportState = airportObj ? (airportObj.state || '').trim() : null;
        if (!resolvedState && airportState) {
            resolvedState = airportState;
        }

        const locationTokens = [
            sourceCity,
            destinationCity,
            airportCity,
            airportState,
            resolvedState
        ].filter(Boolean).flatMap(s => s.split(',').map(p => p.trim().toLowerCase()));

        let airportRule = null;

        // Priority A: Exact / Specific City Match (e.g. "Mumbai", "Kolkata", "Delhi")
        if (airportCity) {
            const acLower = airportCity.toLowerCase();
            airportRule = allAirportRules.find(r => {
                const rc = (r.city || '').trim().toLowerCase();
                return rc === acLower || rc.includes(acLower) || acLower.includes(rc);
            });
            if (airportRule) {
                console.log(`[Pricing Engine] Priority 1 Match: Airport Transfer specific city '${airportRule.city}' (ID=${airportRule.id}) for ${airportCity}`);
            }
        }

        // Priority B: City or token in pickup/drop location
        if (!airportRule) {
            for (const rule of allAirportRules) {
                if (!rule.city) continue;
                const rc = rule.city.trim().toLowerCase();
                if (rc === 'default' || rc === 'all cities') continue;

                const inSource = sourceCity && sourceCity.toLowerCase().includes(rc);
                const inDest = destinationCity && destinationCity.toLowerCase().includes(rc);
                const inTokens = locationTokens.some(t => t === rc || t.includes(rc) || rc.includes(t));

                if (inSource || inDest || inTokens) {
                    airportRule = rule;
                    console.log(`[Pricing Engine] Priority 1 Match: Airport Transfer matched token city '${rule.city}' (ID=${rule.id})`);
                    break;
                }
            }
        }

        // Priority C: State-level match (e.g. "Maharashtra", "West Bengal")
        if (!airportRule && (airportState || resolvedState)) {
            const stLower = (airportState || resolvedState).toLowerCase();
            airportRule = allAirportRules.find(r => {
                const rc = (r.city || '').trim().toLowerCase();
                return rc === stLower || rc.includes(stLower) || stLower.includes(rc);
            });
            if (airportRule) {
                console.log(`[Pricing Engine] Priority 1 Match: Airport Transfer state-level '${airportRule.city}' (ID=${airportRule.id}) for ${airportState || resolvedState}`);
            }
        }

        // Priority D: Fallback to latest 'Default' / 'All Cities' rule
        if (!airportRule) {
            airportRule = allAirportRules.find(r => {
                const rc = (r.city || '').trim().toLowerCase();
                return rc === 'default' || rc === 'all cities';
            });
            if (airportRule) {
                console.log(`[Pricing Engine] Priority 1 Match: Airport Transfer Default rule (ID=${airportRule.id})`);
            }
        }

        const fallback = AIRPORT_FALLBACK_TABLE[normalizedCarCategory] || AIRPORT_FALLBACK_TABLE['Sedan'];

        const baseKms = 15;
        const maxAirportKms = safePositive(airportRule?.maxAirportKms, 25);
        const baseFare = safePositive(airportRule?.baseFare, fallback.baseFare);
        const fare15to25 = safePositive(airportRule?.fare15to25, fallback.fare15to25 || 1050);
        const extraKmRate = safePositive(airportRule?.extraKmRate, fallback.extraKmRate);
        const waitingCharge = safeNumber(airportRule?.waitingChargePerHour, fallback.waitingChargePerHour);
        const nightAllowance = safeNumber(airportRule?.nightAllowance, fallback.nightAllowance);
        const threshold = safeNumber(airportRule?.threshold, fallback.threshold);
        const advanceType = airportRule?.advanceType || 'Percentage';
        const advanceValue = safePositive(airportRule?.advanceValue, (airportRule?.advanceAmount || globalAdvancePct || 20));
        const advanceAmount = advanceType === 'Percentage'
            ? Math.round(calculatedBaseFare * (advanceValue / 100))
            : safePositive(airportRule?.advanceAmount, fallback.advanceAmount);

        const currentDistance = resolvedDistance > 0 ? resolvedDistance : baseKms;

        // Condition 3: Distance exceeds 25 km limit -> Cannot book directly as Airport transfer; shift to Outstation Oneway pricing
        if (currentDistance > maxAirportKms) {
            console.log(
                `[Pricing Engine] Airport transfer distance (${currentDistance} km) exceeds maximum ${maxAirportKms} km range. ` +
                `Switching directly to Outstation (Oneway) pricing as per airport policy.`
            );
            normalizedRideType = 'Oneway';
            shiftedFromAirport = true;
            // Falls through to RoutePricing and StatePricing for Oneway
        } else {
            // Distance is within 0 - 25 km limit
            // Condition 1: 0 - 15 km fixed charge set by admin
            // Condition 2: 15 - 25 km tier fixed charge set by admin
            const isTier1 = currentDistance <= baseKms;
            const activeTier = isTier1 ? '0-15 km' : '15-25 km';
            const activeFare = isTier1 ? baseFare : fare15to25;

            let calculatedBaseFare = activeFare;

            // Night driving allowance: Applicable once if ride time falls between 11 pm till 6 am
            const isNight = isNightTime(pickupTime, airportRule?.nightStartHour ?? 23, airportRule?.nightEndHour ?? 6);
            if (isNight) {
                calculatedBaseFare += nightAllowance;
            }

            const ruleCityName = airportRule?.city || airportCity || 'Default';

            console.log(
                `[Pricing Engine] Priority 1 Match: Airport Transfer (${ruleCityName}, ` +
                `${normalizedCarCategory}, Dist=${currentDistance}km, Tier=${activeTier}, BaseFare=₹${activeFare}, ` +
                `Night=+₹${isNight ? nightAllowance : 0}, Total=₹${calculatedBaseFare}, Advance=₹${advanceAmount}, Threshold=₹${threshold})`
            );

            const details = {
                type: `Airport Transfer (${ruleCityName})`,
                city: ruleCityName,
                airportCity: airportCity || ruleCityName,
                airportName: airportObj?.name || 'Airport',
                carCategory: normalizedCarCategory,
                tier: activeTier,
                baseFare: activeFare,
                fare0to15: baseFare,
                fare15to25: fare15to25,
                baseKms,
                maxAirportKms,
                distance: currentDistance,
                durationMinutes: mapRouteInfo?.durationMinutes,
                extraKms: isTier1 ? 0 : Math.round((currentDistance - baseKms) * 10) / 10,
                extraKmRate,
                waitingCharge,
                waitingChargePerHour: waitingCharge,
                waitingFreeMins: airportRule?.waitingFreeMins || 60,
                nightAllowance,
                isNightApplicable: isNight,
                nightWindow: '11 pm till 6 am',
                threshold,
                advanceAmount,
                advance: advanceAmount,
                inclusions: [
                    `Fixed Airport Transfer Charges (${activeTier})`,
                    'Driver Allowance',
                    'Airport Assistance'
                ],
                exclusions: [
                    'Toll / State Tax',
                    'Parking Charges (as per actuals)',
                    'GST (5%)',
                    `Waiting charges (after 60 mins of pickup time): ₹${waitingCharge}/hour`,
                    `Night driving allowances: ₹${nightAllowance}/- (Applicable once if ride time falls between 11 pm till 6 am)`
                ],
                termsAndConditions: [
                    `0-${baseKms} km: fixed charges of ₹${baseFare}`,
                    `15-${maxAirportKms} km: fixed charges of ₹${fare15to25}`,
                    `Beyond ${maxAirportKms} km: Airport flat transfer not applicable. Redirected to Outstation one-way rates.`,
                    `Waiting charges (after 60 mins of pickup time): ₹${waitingCharge}/hour`,
                    `Night driving allowances: ₹${nightAllowance}/- (Applicable once if ride time falls between 11 pm till 6 am)`,
                    `Threshold value: ₹${threshold} to confirm booking`
                ]
            };

            const result = buildFareResult({
                rawFare: calculatedBaseFare,
                addonTotal,
                appliedAddons,
                multiplier,
                details,
                advanceType,
                advanceValue,
                appliedRule: airportRule?.id || airportRule?._id || `airport-${normalizedCarCategory}`,
                ruleType: 'AirportPricing',
                distance: currentDistance,
                durationMinutes: mapRouteInfo?.durationMinutes
            });

            if (result) return result;
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
                // Do not match Airport-specific route rule via radius if the user search is not an airport pickup
                const isRuleAirport = /airport/i.test(rule.pickupLocation || '');
                const isUserAirport = /airport/i.test(sourceCity || '') || normalizedRideType === 'Airport';
                if (isRuleAirport && !isUserAirport) {
                    continue;
                }
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
        const adminSetPrice = fixedPrice;
        const ratePerKm = safeNumber(routeRule.extraKmRate || routeRule.ratePerKm, 0);
        const distanceFare = ratePerKm > 0 ? Math.round(resolvedDistance * ratePerKm) : 0;
        const selectedBaseFare = distanceFare > 0 ? Math.max(distanceFare, adminSetPrice) : adminSetPrice;

        const details = {
            type: 'Route-specific Fixed Price',
            pickup: routeRule.pickupLocation,
            drop: routeRule.dropLocation,
            baseFare: selectedBaseFare,
            adminSetPrice,
            distanceFare: distanceFare > 0 ? distanceFare : undefined,
            selectedBaseFare
        };

        if (routeRule.includeToll) details.tollTax = 'Included';
        if (routeRule.includeParking) details.parking = 'Included';
        if (routeRule.includeNightAllowance) details.nightAllowance = 'Included';

        const result = buildFareResult({
            rawFare: selectedBaseFare,
            addonTotal,
            appliedAddons,
            multiplier,
            details: { ...details, distance: resolvedDistance, durationMinutes: mapRouteInfo?.durationMinutes },
            advanceType: routeRule.advanceType || 'Percentage',
            advanceValue: safePositive(routeRule.advanceValue, (routeRule.advanceAmount || globalAdvancePct || 20)),
            appliedRule: routeRule._id,
            ruleType: 'RouteSpecific',
            distance: resolvedDistance,
            durationMinutes: mapRouteInfo?.durationMinutes
        });

        if (result) return returnFare(result);
        // else fall through to Priority 2
    }

    
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

            if (result) return returnFare(result);
        }
    }

    // ---------- Priority 2B: State / City‑wise Outstation Pricing ----------
    let stateRule = null;
    let matchType = '';

    const cleanPickupCity = (city || sourceCity || '').trim();
    const cityTokens = cleanPickupCity.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    // Fetch all active rules for this rideCategory and carCategory
    const candidateRules = await StatePricing.find({
        rideCategory: { $regex: new RegExp('^' + normalizedRideType + '$', 'i') },
        carCategory: { $regex: new RegExp('^' + normalizedCarCategory.replace(/\+/g, '\\+') + '$', 'i') },
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
            matchType = `City (${stateRule.city})`;
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
            matchType = `State (${stateRule.state})`;
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
            matchType = `Default (${stateRule.carCategory})`;
        }
    }

    if (stateRule) {
        console.log(`[Pricing Engine] Priority 2 Match: StatePricing ID=${stateRule._id || stateRule.id} [${matchType}]`);

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
        const waitingChargePerHour = safePositive(stateRule.waitingChargePerHour, safePositive(stateRule.waitingCharge, 150));
        const waitingFreeMins = safeNumber(stateRule.waitingFreeMins, 60);

        let baseFareTotal = 0;
        const details = {
            type: `Outstation Pricing [${matchType}]`,
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
            // Outstation OneWay Slabs: 0-50 km, 51-100 km, 101-150 km, 151-200 km, 201-4000 km
            let slab = '0-50 km';
            let slabRate = ratePerKm;

            if (resolvedDistance <= 50) {
                slab = '0-50 km';
                if (stateRule.rate0to50 != null) slabRate = safeNumber(stateRule.rate0to50, ratePerKm);
                else if (stateRule.slabRates?.['0-50 km'] != null) slabRate = safeNumber(stateRule.slabRates['0-50 km'], ratePerKm);
            } else if (resolvedDistance <= 100) {
                slab = '51-100 km';
                if (stateRule.rate51to100 != null) slabRate = safeNumber(stateRule.rate51to100, ratePerKm);
                else if (stateRule.slabRates?.['51-100 km'] != null) slabRate = safeNumber(stateRule.slabRates['51-100 km'], ratePerKm);
            } else if (resolvedDistance <= 150) {
                slab = '101-150 km';
                if (stateRule.rate101to150 != null) slabRate = safeNumber(stateRule.rate101to150, ratePerKm);
                else if (stateRule.slabRates?.['101-150 km'] != null) slabRate = safeNumber(stateRule.slabRates['101-150 km'], ratePerKm);
            } else if (resolvedDistance <= 200) {
                slab = '151-200 km';
                if (stateRule.rate151to200 != null) slabRate = safeNumber(stateRule.rate151to200, ratePerKm);
                else if (stateRule.slabRates?.['151-200 km'] != null) slabRate = safeNumber(stateRule.slabRates['151-200 km'], ratePerKm);
            } else {
                slab = '201-4000 km';
                if (stateRule.rate201to4000 != null) slabRate = safeNumber(stateRule.rate201to4000, ratePerKm);
                else if (stateRule.slabRates?.['201-4000 km'] != null) slabRate = safeNumber(stateRule.slabRates['201-4000 km'], ratePerKm);
                else if (stateRule.slabRates?.['Upto 4000 km'] != null) slabRate = safeNumber(stateRule.slabRates['Upto 4000 km'], ratePerKm);
            }

            // Price 1: Distance fare = Total one-way distance × per-km rate from matching slab
            const distanceFare = Math.round(resolvedDistance * slabRate);

            // Price 2: Admin-set price = applicable fixed or minimum price configured in admin panel
            const adminSetPrice = safePositive(
                stateRule.threshold ?? stateRule.adminSetPrice ?? stateRule.minPrice ?? stateRule.fixedFare ?? stateRule.baseFare,
                500
            );

            // Compare these two prices and select the higher one as base fare:
            // Formula: selectedBaseFare = Math.max(distanceFare, adminSetPrice)
            const selectedBaseFare = Math.max(distanceFare, adminSetPrice);

            // Night driving allowances: Rs (Applicable once if ride time falls between 11 pm till 6 am)
            const isNight = isNightTime(pickupTime, stateRule.nightStartHour ?? 23, stateRule.nightEndHour ?? 6);
            const appliedNightAllowance = isNight ? nightAllowance : 0;

            baseFareTotal = Math.round(selectedBaseFare + appliedNightAllowance);

            Object.assign(details, {
                slab,
                billableKms: resolvedDistance,
                actualDistance: resolvedDistance,
                extraKms: 0,
                extraKmCharges: 0,
                distanceFare,
                ratePerKm: slabRate,
                extraKmRate: slabRate,
                adminSetPrice,
                threshold: adminSetPrice,
                selectedBaseFare,
                chosenBaseFare: selectedBaseFare,
                comparison: {
                    distanceFare,
                    adminSetPrice,
                    threshold: adminSetPrice,
                    selected: selectedBaseFare === distanceFare ? 'distanceFare' : 'adminSetPrice'
                },
                driverBata,
                nightAllowance: appliedNightAllowance,
                isNight,
                rawCalculatedTotal: baseFareTotal,
                isThresholdApplied: selectedBaseFare === adminSetPrice,
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
            // Roundtrip Slabs (0-50 km, 51-100 km, 101-150 km, 151-200 km, 201-4000 km)
            let slab = '0-50 km';
            let slabRate = ratePerKm;

            if (resolvedDistance <= 50) {
                slab = '0-50 km';
                if (stateRule.rate0to50 != null) slabRate = safeNumber(stateRule.rate0to50, ratePerKm);
                else if (stateRule.slabRates?.['0-50 km'] != null) slabRate = safeNumber(stateRule.slabRates['0-50 km'], ratePerKm);
            } else if (resolvedDistance <= 100) {
                slab = '51-100 km';
                if (stateRule.rate51to100 != null) slabRate = safeNumber(stateRule.rate51to100, ratePerKm);
                else if (stateRule.slabRates?.['51-100 km'] != null) slabRate = safeNumber(stateRule.slabRates['51-100 km'], ratePerKm);
            } else if (resolvedDistance <= 150) {
                slab = '101-150 km';
                if (stateRule.rate101to150 != null) slabRate = safeNumber(stateRule.rate101to150, ratePerKm);
                else if (stateRule.slabRates?.['101-150 km'] != null) slabRate = safeNumber(stateRule.slabRates['101-150 km'], ratePerKm);
            } else if (resolvedDistance <= 200) {
                slab = '151-200 km';
                if (stateRule.rate151to200 != null) slabRate = safeNumber(stateRule.rate151to200, ratePerKm);
                else if (stateRule.slabRates?.['151-200 km'] != null) slabRate = safeNumber(stateRule.slabRates['151-200 km'], ratePerKm);
            } else {
                slab = '201-4000 km';
                if (stateRule.rate201to4000 != null) slabRate = safeNumber(stateRule.rate201to4000, ratePerKm);
                else if (stateRule.slabRates?.['201-4000 km'] != null) slabRate = safeNumber(stateRule.slabRates['201-4000 km'], ratePerKm);
                else if (stateRule.slabRates?.['Upto 4000 km'] != null) slabRate = safeNumber(stateRule.slabRates['Upto 4000 km'], ratePerKm);
            }

            // Price 1: Distance fare = Total round-trip distance × rate for slab containing total round-trip distance
            const distanceFare = Math.round(resolvedDistance * slabRate);

            // Price 2: Hourly fare = Total billable booking hours × applicable admin hourly rate
            let totalHours = 0;
            const explicitHours = safeNumber(bookingDuration ?? durationHours ?? hours, 0);
            if (explicitHours > 0) {
                totalHours = explicitHours;
            } else {
                const startDt = parseDateTime(pickupDate, pickupTime);
                const endDt = parseDateTime(returnDate, returnTime);

                if (startDt && endDt && endDt > startDt) {
                    const diffMs = endDt - startDt;
                    totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
                } else {
                    const rtDays = Math.max(1, parseInt(safeNumber(resolvedDays, 1), 10) || 1);
                    totalHours = rtDays > 1 ? rtDays * 24 : 4;
                }
            }

            const activeHourlyRate = safePositive(stateRule.hourlyRate, 100);
            const hourlyFare = Math.round(totalHours * activeHourlyRate);

            // Price 3: Admin-set price = applicable minimum or fixed base price configured in admin panel
            const adminSetPrice = safePositive(
                stateRule.threshold ?? stateRule.adminSetPrice ?? stateRule.minPrice ?? stateRule.fixedFare ?? stateRule.baseFare,
                1000
            );

            // Compare all three prices and select highest one:
            // Formula: selectedBaseFare = Math.max(distanceFare, hourlyFare, adminSetPrice)
            const selectedBaseFare = Math.max(distanceFare, hourlyFare, adminSetPrice);

            // Night driving allowance if applicable (11 PM - 6 AM)
            const isNight = isNightTime(pickupTime, stateRule.nightStartHour ?? 23, stateRule.nightEndHour ?? 6);
            const appliedNightAllowance = isNight ? nightAllowance : 0;

            baseFareTotal = Math.round(selectedBaseFare + appliedNightAllowance);

            const oneWayDist = oneWayDistance != null && safeNumber(oneWayDistance, 0) > 0
                ? safeNumber(oneWayDistance, 0)
                : Math.round((resolvedDistance / 2) * 10) / 10;

            Object.assign(details, {
                slab,
                actualDistance: resolvedDistance,
                oneWayDistance: oneWayDist,
                distanceFare,
                ratePerKm: slabRate,
                extraKmRate: slabRate,
                extraKms: 0,
                extraKmCharges: 0,
                totalHours,
                hourlyRate: activeHourlyRate,
                hourlyFare,
                adminSetPrice,
                threshold: adminSetPrice,
                selectedBaseFare,
                chosenBaseFare: selectedBaseFare,
                comparison: {
                    distanceFare,
                    hourlyFare,
                    adminSetPrice,
                    threshold: adminSetPrice,
                    selected: selectedBaseFare === distanceFare
                        ? 'distanceFare'
                        : (selectedBaseFare === hourlyFare ? 'hourlyFare' : 'adminSetPrice')
                },
                driverBata,
                nightAllowance: appliedNightAllowance,
                isNight,
                rawCalculatedTotal: baseFareTotal,
                isThresholdApplied: selectedBaseFare === adminSetPrice,
                toll,
                parking,
                permit,
                stateTax,
                airportEntry,
                waitingChargePerHour,
                waitingFreeMins,
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
                permit + stateTax + airportEntry + otherCharges
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
            advanceType: stateRule.advanceType || 'Percentage',
            advanceValue: safePositive(stateRule.advanceValue, (stateRule.advanceAmount || globalAdvancePct || 20)),
            appliedRule: stateRule._id || stateRule.id,
            ruleType: 'StateGeneral',
            distance: resolvedDistance,
            durationMinutes: mapRouteInfo?.durationMinutes
        });

        if (result) return returnFare(result);
    }

    // ---------- Priority 3: Fallback (Standard CarCategory Rate) ----------
    console.log(`[Pricing Engine] Priority 3 Match: Standard Category Fallback (${normalizedCarCategory})`);

    let carCat = await CarCategory.findOne({
        name: { $regex: new RegExp('^' + normalizedCarCategory.replace(/\+/g, '\\+') + '$', 'i') }
    });

    if (!carCat) {
        carCat = await CarCategory.findOne({
            displayName: { $regex: new RegExp(normalizedCarCategory.replace(/\+/g, '\\+'), 'i') }
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
    let billableKms = resolvedDistance;
    let extraKms = 0;
    let extraKmCharges = 0;
    let distanceFare = 0;

    const details = {
        type: `Standard Rate (${carCat ? carCat.displayName : normalizedCarCategory})`,
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
        adminSetPrice: threshold,
        waitingChargePerHour,
        waitingFreeMins,
        nightAllowance: def.nightAllowance,
        distance: resolvedDistance,
        durationMinutes: mapRouteInfo?.durationMinutes
    };

    if (normalizedRideType === 'Oneway') {
        if (resolvedDistance <= 50) {
            slab = '0-50 km';
        } else if (resolvedDistance <= 100) {
            slab = '51-100 km';
        } else if (resolvedDistance <= 150) {
            slab = '101-150 km';
        } else if (resolvedDistance <= 200) {
            slab = '151-200 km';
        } else {
            slab = '201-4000 km';
        }

        billableKms = resolvedDistance;
        distanceFare = Math.round(resolvedDistance * perKmRate);

        const adminSetPrice = threshold;
        const selectedBaseFare = Math.max(distanceFare, adminSetPrice);

        const isNight = isNightTime(pickupTime, 23, 6);
        const nightAllowance = isNight ? def.nightAllowance : 0;

        baseFareTotal = Math.round(selectedBaseFare + nightAllowance);

        Object.assign(details, {
            slab,
            billableKms: resolvedDistance,
            actualDistance: resolvedDistance,
            extraKms: 0,
            extraKmCharges: 0,
            distanceFare,
            adminSetPrice,
            threshold: adminSetPrice,
            selectedBaseFare,
            chosenBaseFare: selectedBaseFare,
            comparison: {
                distanceFare,
                adminSetPrice,
                threshold: adminSetPrice,
                selected: selectedBaseFare === distanceFare ? 'distanceFare' : 'adminSetPrice'
            }
        });
    } else if (normalizedRideType === 'Roundtrip') {
        let slab = '0-50 km';
        if (resolvedDistance <= 50) {
            slab = '0-50 km';
        } else if (resolvedDistance <= 100) {
            slab = '51-100 km';
        } else if (resolvedDistance <= 150) {
            slab = '101-150 km';
        } else if (resolvedDistance <= 200) {
            slab = '151-200 km';
        } else {
            slab = '201-4000 km';
        }

        distanceFare = Math.round(resolvedDistance * perKmRate);

        let totalHours = 0;
        const explicitHours = safeNumber(bookingDuration ?? durationHours ?? hours, 0);
        if (explicitHours > 0) {
            totalHours = explicitHours;
        } else {
            const startDt = parseDateTime(pickupDate, pickupTime);
            const endDt = parseDateTime(returnDate, returnTime);
            if (startDt && endDt && endDt > startDt) {
                const diffMs = endDt - startDt;
                totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
            } else {
                const rtDays = Math.max(1, parseInt(safeNumber(resolvedDays, 1), 10) || 1);
                totalHours = rtDays > 1 ? rtDays * 24 : 4;
            }
        }

        const activeHourlyRate = 100;
        const hourlyFare = Math.round(totalHours * activeHourlyRate);
        const adminSetPrice = 1000;

        const selectedBaseFare = Math.max(distanceFare, hourlyFare, adminSetPrice);
        baseFareTotal = selectedBaseFare;
        billableKms = resolvedDistance;

        Object.assign(details, {
            slab,
            actualDistance: resolvedDistance,
            billableKms: resolvedDistance,
            distanceFare,
            totalHours,
            hourlyRate: activeHourlyRate,
            hourlyFare,
            adminSetPrice,
            threshold: adminSetPrice,
            selectedBaseFare,
            chosenBaseFare: selectedBaseFare,
            comparison: {
                distanceFare,
                hourlyFare,
                adminSetPrice,
                threshold: adminSetPrice,
                selected: selectedBaseFare === distanceFare
                    ? 'distanceFare'
                    : (selectedBaseFare === hourlyFare ? 'hourlyFare' : 'adminSetPrice')
            }
        });
    } else {
        billableKms = Math.max(resolvedDistance, 50);
        distanceFare = Math.round(billableKms * perKmRate);
        baseFareTotal = Math.max(distanceFare + driverBata, threshold);
    }

    Object.assign(details, {
        slab,
        minKms: billableKms,
        billableKms,
        distanceFare,
        threshold: details.adminSetPrice || threshold
    });

    const fallbackResult = buildFareResult({
        rawFare: baseFareTotal,
        addonTotal,
        appliedAddons,
        multiplier,
        details,
        advanceType: 'Percentage',
        advanceValue: globalAdvancePct || 20,
        appliedRule: carCat ? carCat.id : 'standard-category-rate',
        ruleType: 'CategoryFallback',
        distance: resolvedDistance,
        durationMinutes: mapRouteInfo?.durationMinutes
    });

    if (fallbackResult) {
        return returnFare(fallbackResult);
    }

    return { ...UNAVAILABLE };
}

module.exports = {
    calculatePrice,
    normalizeRideType,
    normalizeCarCategory,
    ADDON_PRICES
};
