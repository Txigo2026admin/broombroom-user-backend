const RoutePricing = require('../models/RoutePricing');
const StatePricing = require('../models/StatePricing');
const RentalPackage = require('../models/RentalPackage');
const City = require('../models/City');
const CarCategory = require('../models/CarCategory');
const GlobalSetting = require('../models/GlobalSetting');

/**
 * Calculates distance using Haversine formula
 */
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined ||
        lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
        return Infinity;
    }
    const R = 6371; // Radius of earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Normalizes ride types to standard enum
 */
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

/**
 * Normalizes car categories
 */
function normalizeCarCategory(cat) {
    if (!cat) return 'Sedan';
    const c = cat.toLowerCase().trim();
    if (c === 'hatchback' || c === 'mini') return 'Hatchback';
    if (c === 'sedan') return 'Sedan';
    if (c === 'suv' || c === 'ertiga') return 'SUV';
    if (c === 'suv+' || c === 'crysta' || c === 'luxury') return 'SUV+';
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
}

/**
 * Calculates ride fare based on configured pricing engines
 */
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
    days = 1,
    state,
    acType = 'Any',
    seater,
    pickupDate,
    pickupTime,
    returnDate,
    returnTime,
    packageHours,
    includedKms
}) {
    // 1. Get Global Multiplier
    const settings = await GlobalSetting.find();
    const multiplier = settings.find(s => s.key === 'globalMultiplier')?.value || 1.0;

    // Normalize inputs
    const normalizedRideType = normalizeRideType(rideType);
    const normalizedCarCategory = normalizeCarCategory(category);
    const resolvedDistance = distance ? parseFloat(distance) : 0;
    const resolvedDays = days ? parseInt(days) : 1;

    // Resolve missing coordinates using City collection if available
    let pLat = pickupLat ? parseFloat(pickupLat) : null;
    let pLng = pickupLng ? parseFloat(pickupLng) : null;
    let dLat = dropLat ? parseFloat(dropLat) : null;
    let dLng = dropLng ? parseFloat(dropLng) : null;

    if ((pLat === null || pLng === null) && sourceCity) {
        const cityData = await City.findOne({ name: { $regex: new RegExp('^' + sourceCity.trim() + '$', 'i') } });
        if (cityData) {
            pLat = parseFloat(cityData.lat);
            pLng = parseFloat(cityData.lon);
        }
    }
    if ((dLat === null || dLng === null) && destinationCity) {
        const cityData = await City.findOne({ name: { $regex: new RegExp('^' + destinationCity.trim() + '$', 'i') } });
        if (cityData) {
            dLat = parseFloat(cityData.lat);
            dLng = parseFloat(cityData.lon);
        }
    }

    // Try to resolve state from source city if not provided
    let resolvedState = state;
    if (!resolvedState && sourceCity) {
        const cityData = await City.findOne({ name: { $regex: new RegExp('^' + sourceCity.trim() + '$', 'i') } });
        if (cityData && cityData.state) {
            resolvedState = cityData.state;
        }
    }

    console.log(`[Pricing Engine] Calculating price for Category=${normalizedCarCategory}, RideType=${normalizedRideType}, Dist=${resolvedDistance}, State=${resolvedState}`);

    // Priority 1: Route-Specific Pricing
    let routeRule = null;

    // Try exact text match first
    if (sourceCity && destinationCity) {
        routeRule = await RoutePricing.findOne({
            rideCategory: normalizedRideType,
            carCategory: normalizedCarCategory,
            pickupLocation: { $regex: new RegExp('^' + sourceCity.trim() + '$', 'i') },
            dropLocation: { $regex: new RegExp('^' + destinationCity.trim() + '$', 'i') },
            status: 'Active'
        });
    }

    // If no exact match and we have coordinates, check radius
    if (!routeRule && pLat !== null && pLng !== null && dLat !== null && dLng !== null) {
        const activeRouteRules = await RoutePricing.find({
            rideCategory: normalizedRideType,
            carCategory: normalizedCarCategory,
            status: 'Active'
        });

        for (const rule of activeRouteRules) {
            if (rule.pickupLat !== undefined && rule.pickupLng !== undefined && rule.dropLat !== undefined && rule.dropLng !== undefined &&
                rule.pickupLat !== null && rule.pickupLng !== null && rule.dropLat !== null && rule.dropLng !== null) {
                const distPickup = getHaversineDistance(pLat, pLng, rule.pickupLat, rule.pickupLng);
                const distDrop = getHaversineDistance(dLat, dLng, rule.dropLat, rule.dropLng);
                if (distPickup <= rule.nearbyRadiusKm && distDrop <= rule.nearbyRadiusKm) {
                    routeRule = rule;
                    break;
                }
            }
        }
    }

    if (routeRule) {
        console.log(`[Pricing Engine] Priority 1 Match: RoutePricing ID=${routeRule._id}`);
        let baseFare = routeRule.fixedPrice;
        let details = {
            type: 'Route-specific Fixed Price',
            pickup: routeRule.pickupLocation,
            drop: routeRule.dropLocation,
            baseFare
        };

        // Add toll, parking, night allowance if set to true in rule
        if (routeRule.includeToll) details.tollTax = 'Included';
        if (routeRule.includeParking) details.parking = 'Included';
        if (routeRule.includeNightAllowance) details.nightAllowance = 'Included';

        // Get advance payment logic
        let advance = 0;
        const finalFare = Math.round(baseFare * multiplier);

        if (routeRule.advanceType === 'Percentage') {
            advance = Math.round(finalFare * (routeRule.advanceValue / 100));
        } else {
            advance = routeRule.advanceValue;
        }

        const dueFare = Math.max(0, finalFare - advance);

        return {
            success: true,
            fare: finalFare,
            advance,
            dueFare,
            details,
            multiplier,
            appliedRule: routeRule._id,
            ruleType: 'RouteSpecific'
        };
    }

    // Priority 2: State-wise General Pricing / Rental Packages
    if (resolvedState) {
        if (normalizedRideType === 'Rental') {
            // Rental package logic
            let pkgHours = packageHours ? parseInt(packageHours) : 8;
            let pkgKms = includedKms ? parseInt(includedKms) : 80;

            const pkg = await RentalPackage.findOne({
                state: { $regex: new RegExp('^' + resolvedState.trim() + '$', 'i') },
                carCategory: normalizedCarCategory,
                packageHours: pkgHours,
                includedKms: pkgKms,
                status: 'Active'
            });

            if (pkg) {
                console.log(`[Pricing Engine] Priority 2 Match: RentalPackage ID=${pkg._id}`);
                let finalFare = pkg.baseFare;
                let details = {
                    type: `Rental Package (${pkgHours} hrs / ${pkgKms} km)`,
                    baseFare: pkg.baseFare,
                    extraKmRate: pkg.extraKmRate,
                    extraHourRate: pkg.extraHourRate
                };

                let extraKms = Math.max(0, resolvedDistance - pkgKms);
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
                    const extraCharges = (extraKms * pkg.extraKmRate) + (extraHours * pkg.extraHourRate);
                    finalFare += extraCharges;
                    details.extraKms = extraKms;
                    details.extraHours = extraHours;
                    details.extraCharges = extraCharges;
                }

                // Apply global multiplier
                const finalFareMultiplied = Math.round(finalFare * multiplier);

                let advance = 0;
                if (pkg.advanceType === 'Percentage') {
                    advance = Math.round(finalFareMultiplied * (pkg.advanceValue / 100));
                } else {
                    advance = pkg.advanceValue;
                }

                const dueFare = Math.max(0, finalFareMultiplied - advance);

                return {
                    success: true,
                    fare: finalFareMultiplied,
                    advance,
                    dueFare,
                    details,
                    multiplier,
                    appliedRule: pkg._id,
                    ruleType: 'RentalPackage'
                };
            }
        }

        // For other ride types, lookup StatePricing fallback rates
        const stateQuery = {
            state: { $regex: new RegExp('^' + resolvedState.trim() + '$', 'i') },
            rideCategory: normalizedRideType,
            carCategory: normalizedCarCategory,
            status: 'Active'
        };

        let stateRules = await StatePricing.find(stateQuery);
        
        // Find closest match by seater or acType if matching rule exists
        let stateRule = stateRules.find(r => 
            (seater === undefined || seater === null || r.seater === parseInt(seater)) && 
            (acType === 'Any' || r.acType === 'Any' || r.acType === acType)
        ) || stateRules[0]; // fallback to first state rule if none match exactly

        if (stateRule) {
            console.log(`[Pricing Engine] Priority 2 Match: StatePricing ID=${stateRule._id}`);
            let finalFare = 0;
            let details = {
                type: `State-wise General Pricing (${resolvedState})`,
                ratePerKm: stateRule.ratePerKm,
                minKms: stateRule.minKms,
                driverBata: stateRule.driverBata,
                nightAllowance: stateRule.nightAllowance,
                extraKmRate: stateRule.extraKmRate,
                extraHourRate: stateRule.extraHourRate,
                waitingCharge: stateRule.waitingCharge
            };

            let advance = 0;

            if (normalizedRideType === 'Oneway') {
                // Formula: Fare = Distance * Rate per KM
                const billableKms = Math.max(resolvedDistance, stateRule.minKms);
                let base = billableKms * stateRule.ratePerKm;
                let bata = stateRule.driverBata || 0;
                let night = 0;

                // Night allowance checking (if time is between 10 PM and 6 AM)
                if (pickupTime) {
                    const hour = parseInt(pickupTime.split(':')[0]);
                    if (hour >= 22 || hour < 6) {
                        night = stateRule.nightAllowance || 0;
                    }
                }

                finalFare = base + bata + night;
                details.billableKms = billableKms;
                details.baseDistanceFare = base;
                details.driverAllowanceApplied = bata;
                details.nightAllowanceApplied = night;
            } 
            else if (normalizedRideType === 'Roundtrip') {
                // Compare Distance Fare (Distance * Rate/km) vs Hourly Fare (Hours * Hourly Rate)
                const rtDays = Math.max(resolvedDays, 1);
                const minKmsTotal = stateRule.minKms * rtDays;
                const billableKms = Math.max(resolvedDistance, minKmsTotal);
                const distanceFare = billableKms * stateRule.ratePerKm;

                // Calculate Total Hours
                let totalHours = 24 * rtDays;
                if (pickupDate && pickupTime && returnDate && returnTime) {
                    const pickup = new Date(`${pickupDate} ${pickupTime}`);
                    const returnDt = new Date(`${returnDate} ${returnTime}`);
                    if (!isNaN(pickup.getTime()) && !isNaN(returnDt.getTime())) {
                        const diffMs = returnDt - pickup;
                        if (diffMs > 0) {
                            totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
                        }
                    }
                }

                const hourlyFare = totalHours * (stateRule.hourlyRate || 0);
                const baseFare = Math.max(distanceFare, hourlyFare);
                
                const totalBata = (stateRule.driverBata || 0) * rtDays;
                const totalNight = (stateRule.nightAllowance || 0) * rtDays;

                finalFare = baseFare + totalBata + totalNight;

                details.rtDays = rtDays;
                details.totalHours = totalHours;
                details.distanceFare = distanceFare;
                details.hourlyFare = hourlyFare;
                details.baseFareChosen = baseFare;
                details.driverAllowanceApplied = totalBata;
                details.nightAllowanceApplied = totalNight;
            } else {
                // Default fallback for other types (Airport/Station transfers mapped to general distance if no route matches)
                finalFare = Math.max(resolvedDistance, stateRule.minKms) * stateRule.ratePerKm + (stateRule.driverBata || 0);
            }

            // Apply global multiplier
            const finalFareMultiplied = Math.round(finalFare * multiplier);

            if (stateRule.advanceType === 'Percentage') {
                advance = Math.round(finalFareMultiplied * (stateRule.advanceValue / 100));
            } else {
                advance = stateRule.advanceValue;
            }

            const dueFare = Math.max(0, finalFareMultiplied - advance);

            return {
                success: true,
                fare: finalFareMultiplied,
                advance,
                dueFare,
                details,
                multiplier,
                appliedRule: stateRule._id,
                ruleType: 'StateGeneral'
            };
        }
    }

    // Priority 3: Fallback Pricing Logic
    console.log(`[Pricing Engine] No Match (Priority 3 fallback reached)`);
    return {
        success: false,
        message: 'Currently pricing unavailable for this route. Please contact support team.',
        fare: 0,
        advance: 0,
        dueFare: 0
    };
}

module.exports = {
    calculatePrice,
    normalizeRideType,
    normalizeCarCategory
};
