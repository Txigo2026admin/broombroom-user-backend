/**
 * BroomBoom Vendor Dispatch Bridge
 * Connects Customer Bookings (from Web, Mobile App & Admin) 
 * to the Vendor PostgreSQL Database (booking_orders) Pincode-Wise & Plan-Wise
 */

const { Pool } = require('pg');

let vendorPgPool = null;

function getVendorPool() {
  if (!vendorPgPool) {
    const connStr =
      process.env.VENDOR_DATABASE_URL ||
      'postgresql://postgres:postgress@127.0.0.1:5432/postgres';
    vendorPgPool = new Pool({
      connectionString: connStr,
      max: 5,
      idleTimeoutMillis: 10000,
    });
  }
  return vendorPgPool;
}

function cleanString(str) {
  return (str || '').trim().toLowerCase();
}

function cleanPincode(pin) {
  if (!pin) return '';
  const match = String(pin).match(/\b[1-9][0-9]{5}\b/);
  return match ? match[0] : String(pin).replace(/\D/g, '').slice(0, 6);
}

function extractPincodeFromAddress(pin, address) {
  if (pin) {
    const cleaned = cleanPincode(pin);
    if (cleaned.length === 6) return cleaned;
  }
  if (address) {
    const match = String(address).match(/\b[1-9][0-9]{5}\b/);
    if (match) return match[0];

    const low = address.toLowerCase();
    if (low.includes('airport') || low.includes('ccu') || low.includes('dum dum') || low.includes('dumdum')) return '700052';
    if (low.includes('howrah')) return '711101';
    if (low.includes('sealdah')) return '700014';
    if (low.includes('singur') || low.includes('hooghly')) return '712124';
    if (low.includes('salt lake') || low.includes('sector v') || low.includes('sector 5')) return '700091';
    if (low.includes('park street')) return '700016';
    if (low.includes('new town') || low.includes('rajarhat')) return '700156';
    if (low.includes('ballygunge')) return '700019';
    if (low.includes('esplanade')) return '700069';
    if (low.includes('garia')) return '700084';
  }
  return '712124'; // Default to BroomBoom central district franchise hub
}

/**
 * Classifies booking strictly according to BroomBoom's 3 Partner Packages:
 * 1. SILVER PARTNER (WARD KIOSK) - 15% commission
 *    - Airport transfer rides
 *    - Station transfer rides
 *    - Short rentals (1h/10km, 3h/30km, 5h/50km)
 * 2. GOLD PARTNER (DISTRICT EXCLUSIVE) - 10% commission
 *    - Outstation (Oneway, roundtrip)
 *    - Long rentals (08h/80km, 10h/100km, 12h/120km)
 * 3. PLATINUM PARTNER (REGIONAL MASTER) - 0% commission
 *    - Tour Packages
 *    - Corporate Rides
 */
function classifyBookingPlan(data) {
  const p = cleanString(data.pickup);
  const d = cleanString(data.drop);
  const rawService = cleanString(data.serviceType || data.bookingType || '');
  const rawPkg = cleanString(data.rentalPackage || '');

  // 1. TOUR PACKAGES & CORPORATE -> PLATINUM PARTNER (0% commission)
  if (
    rawService.includes('tour') ||
    rawService.includes('holiday') ||
    rawService.includes('package') ||
    rawPkg.includes('tour')
  ) {
    return {
      planTier: 'platinum',
      bookingType: 'tour_package',
      commissionRate: 0,
    };
  }

  if (
    rawService.includes('corporate') ||
    rawService.includes('business') ||
    p.includes('it park') ||
    d.includes('it park') ||
    p.includes('tech park') ||
    d.includes('tech park')
  ) {
    return {
      planTier: 'platinum',
      bookingType: 'corporate_ride',
      commissionRate: 0,
    };
  }

  // 2. LONG RENTALS -> GOLD PARTNER (10% commission)
  if (
    rawPkg.includes('8') ||
    rawPkg.includes('80') ||
    rawService.includes('8hr') ||
    rawService.includes('8 hr')
  ) {
    return {
      planTier: 'gold',
      bookingType: 'rental_8hr_80km',
      commissionRate: 10,
    };
  }
  if (
    rawPkg.includes('10') ||
    rawPkg.includes('100') ||
    rawService.includes('10hr') ||
    rawService.includes('10 hr')
  ) {
    return {
      planTier: 'gold',
      bookingType: 'rental_10hr_100km',
      commissionRate: 10,
    };
  }
  if (
    rawPkg.includes('12') ||
    rawPkg.includes('120') ||
    rawService.includes('12hr') ||
    rawService.includes('12 hr')
  ) {
    return {
      planTier: 'gold',
      bookingType: 'rental_12hr_120km',
      commissionRate: 10,
    };
  }

  // 3. OUTSTATION -> GOLD PARTNER (10% commission)
  if (rawService.includes('roundtrip') || rawService.includes('round-trip') || rawService.includes('round trip')) {
    return {
      planTier: 'gold',
      bookingType: 'outstation_roundtrip',
      commissionRate: 10,
    };
  }
  if (rawService.includes('outstation') || rawService.includes('oneway') || rawService.includes('one-way')) {
    return {
      planTier: 'gold',
      bookingType: 'outstation_oneway',
      commissionRate: 10,
    };
  }

  // 4. SHORT RENTALS -> SILVER PARTNER (15% commission)
  if (
    rawPkg.includes('1') ||
    rawPkg.includes('10') ||
    rawService.includes('1hr') ||
    rawService.includes('1 hr')
  ) {
    return {
      planTier: 'silver',
      bookingType: 'rental_1hr_10km',
      commissionRate: 15,
    };
  }
  if (
    rawPkg.includes('3') ||
    rawPkg.includes('30') ||
    rawService.includes('3hr') ||
    rawService.includes('3 hr')
  ) {
    return {
      planTier: 'silver',
      bookingType: 'rental_3hr_30km',
      commissionRate: 15,
    };
  }
  if (
    rawPkg.includes('5') ||
    rawPkg.includes('50') ||
    rawService.includes('5hr') ||
    rawService.includes('5 hr')
  ) {
    return {
      planTier: 'silver',
      bookingType: 'rental_5hr_50km',
      commissionRate: 15,
    };
  }

  // 5. AIRPORT & STATION TRANSFERS -> SILVER PARTNER (15% commission)
  if (
    rawService.includes('airport') ||
    p.includes('airport') ||
    d.includes('airport') ||
    p.includes('terminal') ||
    d.includes('terminal')
  ) {
    return {
      planTier: 'silver',
      bookingType: 'airport_transfer',
      commissionRate: 15,
    };
  }

  if (
    rawService.includes('station') ||
    p.includes('station') ||
    d.includes('station') ||
    p.includes('howrah') ||
    d.includes('howrah') ||
    p.includes('sealdah') ||
    d.includes('sealdah') ||
    p.includes('railway') ||
    d.includes('railway')
  ) {
    return {
      planTier: 'silver',
      bookingType: 'station_transfer',
      commissionRate: 15,
    };
  }

  // Fallback distance based
  const distNum = parseFloat(String(data.distance || '').replace(/[^0-9.]/g, '')) || 0;
  if (distNum > 40) {
    return {
      planTier: 'gold',
      bookingType: 'outstation_oneway',
      commissionRate: 10,
    };
  }

  return {
    planTier: 'silver',
    bookingType: 'rental_1hr_10km',
    commissionRate: 15,
  };
}

/**
 * Syncs incoming booking to the BroomBoom Vendor Dispatch System
 */
async function syncToVendorOrders(bookingBody, headers = {}) {
  const pickup = bookingBody.pickupAddress || bookingBody.pickup || '';
  const drop = bookingBody.dropAddress || bookingBody.drop || '';
  const pickupPincode = extractPincodeFromAddress(
    bookingBody.pincode || bookingBody.pickupPincode,
    pickup
  );
  const dropPincode = extractPincodeFromAddress(
    bookingBody.dropPincode,
    drop
  );

  const classification = classifyBookingPlan({
    pickup,
    drop,
    serviceType: bookingBody.serviceType || bookingBody.bookingType,
    rentalPackage: bookingBody.rentalPackage,
    distance: bookingBody.distance,
  });

  const totalFare = Number(bookingBody.fare) || Number(bookingBody.totalFare) || 500;
  const commissionRate = classification.commissionRate;
  const vendorPayout = Math.round(totalFare * (1 - commissionRate / 100));

  const sourceHeader = headers['user-agent'] || '';
  const isDart = sourceHeader.toLowerCase().includes('dart') || sourceHeader.toLowerCase().includes('flutter');
  const source = bookingBody.source || (isDart ? 'broomboom app' : 'broomboomweb_page');

  const vendorPayload = {
    passengerName: bookingBody.customerName || bookingBody.passengerName || 'Traveller',
    passengerPhone: bookingBody.customerMobile || bookingBody.passengerPhone || '',
    passengerRating: 4.9,
    pickup: pickup.trim(),
    pickupZone: pickup.toLowerCase().includes('airport') ? 'Kolkata Airport' : 'Territory Hub',
    pickupPincode: pickupPincode,
    drop: drop.trim(),
    dropZone: 'Destination Zone',
    dropPincode: dropPincode,
    distance: bookingBody.distance || '14.5 km',
    duration: bookingBody.duration || '28 mins',
    vehicleCategory: bookingBody.vehicleCategory || 'Sedan (Swift Dzire / Etios)',
    planTier: classification.planTier,
    bookingType: classification.bookingType,
    commissionRate: commissionRate,
    totalFare: totalFare,
    vendorPayout: vendorPayout,
    paymentMethod: bookingBody.paymentMethod || 'Online Paid (Cashfree UPI)',
    source: source,
    notes: `Customer booking from ${source} for PIN ${pickupPincode} (${classification.planTier.toUpperCase()} Partner - ${classification.bookingType})`,
  };

  // Step 1: Attempt fast sync to vendor portal API (port 3000)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const vendorApiUrl = process.env.VENDOR_API_URL || 'http://localhost:3000/api/bookings';
    const response = await fetch(vendorApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendorPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      console.log(`[VENDOR DISPATCH SYNC SUCCESS] Booking synced to port 3000 for PIN: ${pickupPincode}, Tier: ${classification.planTier}, Vendor: ${data.booking?.assigned_vendor_name || 'Assigned'}`);
      return { success: true, via: 'api', booking: data.booking };
    }
  } catch (apiErr) {
    console.warn('[VENDOR DISPATCH API UNAVAILABLE - FALLBACK TO DIRECT DB]', apiErr.message);
  }

  // Step 2: Fallback direct write to PostgreSQL `booking_orders`
  try {
    const pool = getVendorPool();

    // Query nearest vendor matching planTier and pincode
    const vendorQuery = `
      SELECT id, vendor_name, vendor_mobile, city,
        CASE 
          WHEN city ILIKE '%singur%' THEN '712124'
          ELSE '700001'
        END AS pincode
      FROM vendor_subscriptions
      WHERE plan_tier = $1 AND status = 'active'
      ORDER BY 
        CASE 
          WHEN city ILIKE '%singur%' AND $2 = '712124' THEN 100
          ELSE 10
        END DESC
      LIMIT 1;
    `;

    const vResult = await pool.query(vendorQuery, [classification.planTier, pickupPincode]);
    const matchedVendor = vResult.rows[0] || null;

    const assignedVendorId = matchedVendor ? (matchedVendor.application_id || matchedVendor.id) : null;
    const assignedVendorName = matchedVendor ? matchedVendor.vendor_name : 'Valued Territory Partner';
    const assignedVendorMobile = matchedVendor ? matchedVendor.vendor_mobile : null;
    const assignedVendorPincode = matchedVendor ? matchedVendor.pincode : pickupPincode;

    const bookingId = `BB-ORD-${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
    const id = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const insertSql = `
      INSERT INTO booking_orders (
        id, booking_id, passenger_name, passenger_phone, passenger_rating,
        pickup, pickup_zone, pickup_pincode, drop_loc, drop_zone, drop_pincode,
        distance, duration, vehicle_category, plan_tier, booking_type, total_fare, vendor_payout,
        commission_rate, payment_method, source, status, assigned_vendor_id,
        assigned_vendor_name, assigned_vendor_mobile, assigned_vendor_pincode,
        rejected_vendor_ids, admin_approved, dispatch_time, notes,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23,
        $24, $25, $26,
        $27, $28, $29, $30,
        NOW(), NOW()
      ) RETURNING *;
    `;

    const values = [
      id,
      bookingId,
      vendorPayload.passengerName,
      vendorPayload.passengerPhone,
      vendorPayload.passengerRating,
      vendorPayload.pickup,
      vendorPayload.pickupZone,
      vendorPayload.pickupPincode,
      vendorPayload.drop,
      vendorPayload.dropZone,
      vendorPayload.dropPincode,
      vendorPayload.distance,
      vendorPayload.duration,
      vendorPayload.vehicleCategory,
      vendorPayload.planTier,
      vendorPayload.bookingType,
      vendorPayload.totalFare,
      vendorPayload.vendorPayout,
      vendorPayload.commissionRate,
      vendorPayload.paymentMethod,
      vendorPayload.source,
      'incoming',
      assignedVendorId,
      assignedVendorName,
      assignedVendorMobile,
      assignedVendorPincode,
      [],
      true,
      'Just now (45s left to accept)',
      vendorPayload.notes,
    ];

    const insertRes = await pool.query(insertSql, values);
    console.log(`[VENDOR DISPATCH DB FALLBACK SUCCESS] Order ${bookingId} inserted into booking_orders directly for PIN ${pickupPincode}!`);
    return { success: true, via: 'db', booking: insertRes.rows[0] };
  } catch (dbErr) {
    console.error('[VENDOR DISPATCH DB FALLBACK ERROR]', dbErr.message);
    return { success: false, error: dbErr.message };
  }
}

module.exports = {
  syncToVendorOrders,
  extractPincodeFromAddress,
  classifyBookingPlan,
};

