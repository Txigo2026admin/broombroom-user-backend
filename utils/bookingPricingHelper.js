/**
 * Booking Commercials & Pricing Helper
 * Handles advance, rideAdvance (advance + 5% + 3% GST charges),
 * addon totals, company share, driver share, and text exclusions.
 */

const GlobalSetting = require('../models/GlobalSetting');

const DEFAULT_ADDON_PRICES = {
    petAllowance: 1001,
    roofCarrier: 157,
    assuredLuggageSpace: 157,
    language: 209,
    newVehicle: 262,
    confirmCarModel2022: 262,
    sightseeing: 787,
    refundable: 751,
    refundableBooking: 751
};

/**
 * Calculates total addon amount from addons object or array
 */
function calculateAddonTotal(addons, explicitAddonAmount) {
    if (explicitAddonAmount !== undefined && explicitAddonAmount !== null && !isNaN(Number(explicitAddonAmount)) && Number(explicitAddonAmount) > 0) {
        return Number(explicitAddonAmount);
    }

    if (!addons) return 0;

    let total = 0;

    // Array format: [{ key: 'roofCarrier', price: 157 }, ...] or ['roofCarrier']
    if (Array.isArray(addons)) {
        for (const item of addons) {
            if (!item) continue;
            if (typeof item === 'object') {
                if (item.price !== undefined && !isNaN(Number(item.price)) && Number(item.price) > 0) {
                    total += Number(item.price);
                } else {
                    const key = (item.key || item.name || item.id || '').toLowerCase();
                    total += resolveAddonKeyPrice(key);
                }
            } else if (typeof item === 'string') {
                total += resolveAddonKeyPrice(item.toLowerCase());
            }
        }
        return total;
    }

    // Object format: { petAllowance: 1001, roofCarrier: true, ... }
    if (typeof addons === 'object') {
        for (const [key, val] of Object.entries(addons)) {
            if (!val) continue;
            if (typeof val === 'number') {
                if (val > 10) {
                    total += val;
                } else if (val > 0) {
                    total += resolveAddonKeyPrice(key.toLowerCase()) * val;
                }
            } else if (val === true || val === 'true') {
                total += resolveAddonKeyPrice(key.toLowerCase());
            }
        }
    }

    return total;
}

function resolveAddonKeyPrice(key) {
    if (!key) return 0;
    const lk = key.toLowerCase();
    if (lk.includes('pet')) return DEFAULT_ADDON_PRICES.petAllowance;
    if (lk.includes('roof') || lk.includes('carrier') || lk.includes('luggage')) return DEFAULT_ADDON_PRICES.roofCarrier;
    if (lk.includes('lang')) return DEFAULT_ADDON_PRICES.language;
    if (lk.includes('vehicle') || lk.includes('car')) return DEFAULT_ADDON_PRICES.newVehicle;
    if (lk.includes('sight')) return DEFAULT_ADDON_PRICES.sightseeing;
    if (lk.includes('refund')) return DEFAULT_ADDON_PRICES.refundable;
    return DEFAULT_ADDON_PRICES[key] || 0;
}

/**
 * Returns default extra km/hour/waiting/night exclusions based on vehicle category
 * Note: These are informational exclusion texts and are NOT added to the ride fare.
 */
function getDefaultExclusions(vehicleCategory = '', serviceType = '') {
    const cat = String(vehicleCategory || '').trim().toLowerCase();

    let extraKm = '₹16/km';
    let extraHour = '₹200/hr';
    let waitingCharges = '₹150/hr (after 60 mins free)';
    let nightAllowance = '₹250 (11:00 PM to 6:00 AM)';
    const tollTax = 'Excluded (Toll, State Tax, Parking as per actuals)';

    if (cat.includes('suv+')) {
        extraKm = '₹24/km';
        extraHour = '₹300/hr';
        waitingCharges = '₹250/hr (after 60 mins free)';
        nightAllowance = '₹350 (11:00 PM to 6:00 AM)';
    } else if (cat.includes('suv')) {
        extraKm = '₹20/km';
        extraHour = '₹250/hr';
        waitingCharges = '₹200/hr (after 60 mins free)';
        nightAllowance = '₹300 (11:00 PM to 6:00 AM)';
    } else if (cat.includes('13') || cat.includes('traveller')) {
        extraKm = '₹35/km';
        extraHour = '₹400/hr';
        waitingCharges = '₹350/hr (after 60 mins free)';
        nightAllowance = '₹450 (11:00 PM to 6:00 AM)';
    } else if (cat.includes('17')) {
        extraKm = '₹40/km';
        extraHour = '₹450/hr';
        waitingCharges = '₹400/hr (after 60 mins free)';
        nightAllowance = '₹500 (11:00 PM to 6:00 AM)';
    } else if (cat.includes('25')) {
        extraKm = '₹48/km';
        extraHour = '₹500/hr';
        waitingCharges = '₹500/hr (after 60 mins free)';
        nightAllowance = '₹600 (11:00 PM to 6:00 AM)';
    }

    const exclusions = [
        `Extra km charges: ${extraKm}`,
        `Extra hour charges: ${extraHour}`,
        `Waiting charges: ${waitingCharges}`,
        `Night driving allowance: ${nightAllowance}`,
        'Toll & State Tax: Excluded (payable directly on actuals)',
        'Parking charges: Excluded (payable on actuals)',
        'Airport parking / entry: Excluded (payable on actuals)',
        'GST: 5% extra on base fare if applicable'
    ];

    return {
        extraKm,
        extraHour,
        waitingCharges,
        nightAllowance,
        tollTax,
        exclusions
    };
}

/**
 * Calculates and normalizes all commercials for a booking:
 * - fare: Total base ride fare
 * - addonAmount: Total amount for added services
 * - advance: Base advance amount
 * - rideAdvance: Advance + 5% service charges + 3% GST charges (paid in Cashfree)
 * - dueFare: Fare minus base advance (collected by driver)
 * - isAdvancedPayment: 'Yes' if advance paid, 'No' otherwise
 * - companyShare: Advance amount (shows advance paid)
 * - driverShare: Due fare amount
 * - extraKm, extraHour, waitingCharges, nightAllowance, tollTax, exclusions:
 *   Informational exclusion texts (NOT added to fare)
 */
function calculateBookingCommercials(data = {}) {
    const rawFare = Number(data.fare || 0);
    const fare = isNaN(rawFare) ? 0 : rawFare;

    // Detect Book At Zero:
    // User selected "Book at ₹0" / Zero advance / Pay at Cab in app
    const isBookAtZero =
        data.bookAtZero === true ||
        String(data.bookAtZero).toLowerCase() === 'true' ||
        String(data.bookAtZero).toLowerCase() === 'yes' ||
        data.zeroAdvance === true ||
        String(data.zeroAdvance).toLowerCase() === 'true' ||
        String(data.zeroAdvance).toLowerCase() === 'yes' ||
        data.isZeroAdvance === true ||
        String(data.isZeroAdvance).toLowerCase() === 'true' ||
        data.isZeroPayment === true ||
        String(data.isZeroPayment).toLowerCase() === 'true' ||
        String(data.bookingType || '').toLowerCase().includes('zero') ||
        String(data.paymentOption || '').toLowerCase().includes('zero') ||
        String(data.paymentOption || '').toLowerCase().includes('pay_at_cab') ||
        String(data.paymentOption || '').toLowerCase().includes('pay_later') ||
        String(data.paymentMethod || '').toLowerCase() === 'cash' ||
        String(data.paymentMethod || '').toLowerCase().includes('pay at cab') ||
        String(data.paymentMethod || '').toLowerCase().includes('driver') ||
        (data.advance !== undefined && data.advance !== null && Number(data.advance) === 0);

    // 1. Addons & Addon Total Amount
    const addonAmount = calculateAddonTotal(data.addons, data.addonAmount);

    // 2. Base Advance:
    let advance = 0;
    if (isBookAtZero) {
        advance = 0;
    } else if (data.advance !== undefined && data.advance !== null && !isNaN(Number(data.advance)) && Number(data.advance) >= 0) {
        advance = Number(data.advance);
    } else if (fare > 0) {
        advance = Math.round(fare * 0.20);
    }

    // 3. Ride Advance: advance + 5% service charges + 3% GST charges
    // Total charges = 8% on advance (5% platform/convenience fee + 3% GST charges)
    const calculatedRideAdvance = advance > 0
        ? Number((advance + (advance * 0.05) + (advance * 0.03)).toFixed(2))
        : 0;
    const rideAdvance = isBookAtZero
        ? 0
        : ((data.rideAdvance !== undefined && data.rideAdvance !== null && !isNaN(Number(data.rideAdvance)) && Number(data.rideAdvance) > 0)
            ? Number(data.rideAdvance)
            : calculatedRideAdvance);

    // 4. Due Fare: remaining fare payable to driver
    let dueFare = 0;
    if (isBookAtZero) {
        dueFare = fare;
    } else if (data.dueFare !== undefined && data.dueFare !== null && !isNaN(Number(data.dueFare))) {
        dueFare = Number(data.dueFare);
    } else {
        dueFare = Math.max(0, fare - advance);
    }

    // 5. Payment check: if advance is paid, isAdvancedPayment = 'Yes', else 'No'
    const isPaid = Number(data.paidAmount || 0) > 0 ||
        String(data.paymentStatus || '').toUpperCase() === 'SUCCESS' ||
        String(data.isAdvancedPayment || '').trim().toLowerCase() === 'yes';
    const isAdvancedPayment = isPaid ? 'Yes' : (data.isAdvancedPayment || 'No');

    // 6. Booking Status & Payment Status:
    // If Book at Zero: booking status is 'Confirmed', payment status is 'PENDING'
    // If Paid: booking status is 'Confirmed', payment status is 'SUCCESS'
    // Otherwise: booking status is 'Pending', payment status is 'PENDING'
    let status = data.status || 'Pending';
    let paymentStatus = data.paymentStatus || 'PENDING';

    if (isPaid) {
        status = 'Confirmed';
        paymentStatus = 'SUCCESS';
    } else if (isBookAtZero) {
        status = 'Confirmed';
        paymentStatus = 'PENDING';
    }

    // 7. Company share & Driver share:
    // Advance pay is company share, due fare is driver share
    let companyShare = 0;
    if (data.companyShare !== undefined && data.companyShare !== null && !isNaN(Number(data.companyShare)) && Number(data.companyShare) > 0) {
        companyShare = Number(data.companyShare);
    } else if (isPaid) {
        companyShare = Number(data.paidAmount || advance);
    } else {
        companyShare = advance;
    }

    let driverShare = 0;
    if (data.driverShare !== undefined && data.driverShare !== null && !isNaN(Number(data.driverShare)) && Number(data.driverShare) > 0) {
        driverShare = Number(data.driverShare);
    } else {
        driverShare = dueFare;
    }

    // 8. Extra km & extra charges: Just text in exclusions, NOT calculated into fare!
    const defaults = getDefaultExclusions(data.vehicleCategory, data.serviceType);
    const extraKm = data.extraKm || defaults.extraKm;
    const extraHour = data.extraHour || defaults.extraHour;
    const waitingCharges = data.waitingCharges || defaults.waitingCharges;
    const nightAllowance = data.nightAllowance || defaults.nightAllowance;
    const tollTax = data.tollTax || defaults.tollTax || 'Excluded';

    let exclusions = defaults.exclusions;
    if (Array.isArray(data.exclusions) && data.exclusions.length > 0) {
        exclusions = data.exclusions;
    }

    return {
        fare,
        addonAmount,
        advance,
        rideAdvance,
        dueFare,
        isAdvancedPayment,
        status,
        paymentStatus,
        isBookAtZero,
        companyShare,
        driverShare,
        extraKm,
        extraHour,
        waitingCharges,
        nightAllowance,
        tollTax,
        exclusions
    };
}

module.exports = {
    DEFAULT_ADDON_PRICES,
    calculateAddonTotal,
    getDefaultExclusions,
    calculateBookingCommercials
};
