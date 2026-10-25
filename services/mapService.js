const City = require('../models/City');

const OSRM_API_URL = process.env.OSRM_API_URL || 'https://router.project-osrm.org';
const NOMINATIM_API_URL = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org';

// Known aliases & common typos mapped to accurate canonical places
const KNOWN_ALIASES = {
    'newtown': 'New Town, Kolkata',
    'new town': 'New Town, Kolkata',
    'new town kolkata': 'New Town, Kolkata',
    'newtown kolkata': 'New Town, Kolkata',
    'rajarhat': 'Rajarhat, Kolkata',
    'rajarhat newtown': 'New Town, Kolkata',
    'cahndan nagar': 'Chandannagar, Hooghly',
    'cahndannagar': 'Chandannagar, Hooghly',
    'cahndan': 'Chandannagar, Hooghly',
    'chandan nagar': 'Chandannagar, Hooghly',
    'chandannagar': 'Chandannagar, Hooghly',
    'chandannagore': 'Chandannagar, Hooghly',
    'salt lake': 'Salt Lake, Kolkata',
    'saltlake': 'Salt Lake, Kolkata',
    'sector 5': 'Sector V, Salt Lake, Kolkata',
    'sector v': 'Sector V, Salt Lake, Kolkata',
    'kolkata airport': 'Netaji Subhash Chandra Bose Intl Airport, Kolkata',
    'dum dum airport': 'Netaji Subhash Chandra Bose Intl Airport, Kolkata',
    'howrah station': 'Howrah Railway Station, Howrah',
    'howrah': 'Howrah, West Bengal'
};

function normalizeQuery(query) {
    if (!query || typeof query !== 'string') return '';
    return query.trim();
}

function resolveAlias(query) {
    const clean = normalizeQuery(query).toLowerCase().replace(/\s+/g, ' ');
    if (KNOWN_ALIASES[clean]) {
        return KNOWN_ALIASES[clean];
    }
    // Check without spaces
    const noSpaces = clean.replace(/\s+/g, '');
    if (KNOWN_ALIASES[noSpaces]) {
        return KNOWN_ALIASES[noSpaces];
    }
    return null;
}

const STATE_ABBR = {
    'wb': 'West Bengal',
    'w.b.': 'West Bengal',
    'w.b': 'West Bengal',
    'up': 'Uttar Pradesh',
    'u.p.': 'Uttar Pradesh',
    'mp': 'Madhya Pradesh',
    'm.p.': 'Madhya Pradesh',
    'mh': 'Maharashtra',
    'dl': 'Delhi',
    'delhi ncr': 'Delhi',
    'ka': 'Karnataka',
    'tn': 'Tamil Nadu',
    'ts': 'Telangana',
    'ap': 'Andhra Pradesh',
    'kol': 'Kolkata',
    'cal': 'Kolkata'
};

function expandStateAbbreviations(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str;
    for (const [abbr, full] of Object.entries(STATE_ABBR)) {
        const reg = new RegExp('\\b' + abbr.replace(/\./g, '\\.') + '\\b', 'gi');
        s = s.replace(reg, full);
    }
    return s;
}

// ---------- Haversine formula (curved road fallback) ----------
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const roadFactor = parseFloat(process.env.ROAD_WINDING_FACTOR) || 1.0;
    return Math.round(R * c * roadFactor * 10) / 10;
}

// ---------- Geocode address/city via DB or Nominatim ----------
async function getCoordinates(query) {
    if (!query || typeof query !== 'string') return null;
    const cleanQuery = normalizeQuery(query);
    if (!cleanQuery) return null;

    // Check alias first (e.g. "newtown" -> "New Town, Kolkata", "cahndan nagar" -> "Chandannagar")
    const aliased = resolveAlias(cleanQuery);
    const effectiveQuery = aliased || cleanQuery;

    // 1. Try DB lookup
    try {
        const primaryName = effectiveQuery.split(',')[0].trim();
        const escapedFull = effectiveQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedPrimary = primaryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Check if query is "newtown" specifically - make sure it returns New Town Kolkata
        if (/^new\s*town$/i.test(cleanQuery) || /^new\s*town$/i.test(effectiveQuery)) {
            const kolkataNewTown = await City.findOne({
                name: { $regex: /^new town$/i },
                lat: { $regex: /^22\./ }
            });
            if (kolkataNewTown && kolkataNewTown.lat && kolkataNewTown.lon) {
                return {
                    lat: parseFloat(kolkataNewTown.lat),
                    lng: parseFloat(kolkataNewTown.lon),
                    displayName: kolkataNewTown.displayName || kolkataNewTown.name,
                    state: kolkataNewTown.state || 'West Bengal',
                    source: 'Database'
                };
            }
        }

        let cityInDb = await City.findOne({
            name: { $regex: new RegExp('^' + escapedFull + '$', 'i') }
        });

        if (!cityInDb && primaryName.length > 1) {
            cityInDb = await City.findOne({
                name: { $regex: new RegExp('^' + escapedPrimary + '$', 'i') }
            });
        }

        if (!cityInDb) {
            cityInDb = await City.findOne({
                displayName: { $regex: new RegExp(escapedPrimary, 'i') }
            });
        }

        if (cityInDb && cityInDb.lat && cityInDb.lon) {
            return {
                lat: parseFloat(cityInDb.lat),
                lng: parseFloat(cityInDb.lon),
                displayName: cityInDb.displayName || cityInDb.name,
                state: cityInDb.state,
                source: 'Database'
            };
        }
    } catch (dbErr) {
        console.warn('[MapService] DB city lookup warning:', dbErr.message);
    }

    // 2. Query Nominatim OpenStreetMap API
    const queriesToTry = [effectiveQuery];
    if (aliased && aliased !== cleanQuery) {
        queriesToTry.push(cleanQuery);
    }

    // Check if query is a 6-digit Indian PIN code
    const pinMatch = cleanQuery.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) {
        queriesToTry.push(pinMatch[1]);
    }

    for (const q of queriesToTry) {
        try {
            const isPin = /^[1-9][0-9]{5}$/.test(q.trim());
            const url = isPin
                ? `${NOMINATIM_API_URL}/search?postalcode=${encodeURIComponent(q.trim())}&country=in&format=json&addressdetails=1&limit=3`
                : `${NOMINATIM_API_URL}/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=3&countrycodes=in`;

            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'BroomBoomCabs/1.0 (contact@broomboom.com)',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(5000)
            });

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    // Pick the most relevant result (filter out distant Islampur if user asked for newtown)
                    let item = data[0];
                    if (/^new\s*town/i.test(cleanQuery)) {
                        const kolkataItem = data.find(d => /kolkata|rajarhat|24 parganas/i.test(d.display_name));
                        if (kolkataItem) item = kolkataItem;
                    }

                    const lat = parseFloat(item.lat);
                    const lng = parseFloat(item.lon);
                    const detectedState = item.address?.state || '';

                    // Cache in City table only if not a duplicate
                    try {
                        const primaryName = q.split(',')[0].trim();
                        const existing = await City.findOne({
                            name: { $regex: new RegExp('^' + primaryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
                        });

                        if (!existing && primaryName.length > 1) {
                            await City.create({
                                name: primaryName,
                                displayName: item.display_name,
                                lat: String(lat),
                                lon: String(lng),
                                state: detectedState,
                                country: item.address?.country || 'India',
                                placeId: item.place_id ? String(item.place_id) : undefined
                            });
                        }
                    } catch (_) {}

                    return {
                        lat,
                        lng,
                        displayName: item.display_name,
                        state: detectedState,
                        source: 'Nominatim'
                    };
                }
            }
        } catch (apiErr) {
            console.warn(`[MapService] Nominatim geocoding failed for "${q}":`, apiErr.message);
        }
    }

    // 3. Progressive Hierarchical Fallback for Detailed Home Addresses (e.g. "nanda,singur,hooghly,wb")
    const expandedAddress = expandStateAbbreviations(cleanQuery);
    const addressTokens = expandedAddress.split(',').map(p => p.trim()).filter(Boolean);

    if (addressTokens.length > 1) {
        for (let i = 1; i < addressTokens.length; i++) {
            const subQuery = addressTokens.slice(i).join(', ');
            if (/^(west bengal|india|wb|up|mp|maharashtra|delhi)$/i.test(subQuery.trim())) continue;

            const subGeo = await getCoordinates(subQuery);
            if (subGeo && subGeo.lat && subGeo.lng) {
                const prefix = addressTokens.slice(0, i).join(', ');
                return {
                    lat: subGeo.lat,
                    lng: subGeo.lng,
                    displayName: prefix ? `${prefix}, ${subGeo.displayName}` : subGeo.displayName,
                    state: subGeo.state || '',
                    source: `Hierarchical(${subGeo.source})`
                };
            }
        }
    }

    return null;
}

// ---------- Autocomplete / Place Search for Search Bar ----------
async function searchLocations(query) {
    if (!query || typeof query !== 'string') return [];
    const cleanQuery = normalizeQuery(query);
    if (cleanQuery.length < 2) return [];

    const results = [];
    const seenIds = new Set();

    // 1. Check alias (e.g., "cahndan nagar" -> "Chandannagar, Hooghly")
    const aliased = resolveAlias(cleanQuery);
    const searchQuery = aliased || cleanQuery;

    // 2. Search Database first (local, instantaneous)
    try {
        const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const dbCities = await City.find({
            $or: [
                { name: { $regex: new RegExp(escaped, 'i') } },
                { displayName: { $regex: new RegExp(escaped, 'i') } }
            ]
        }).limit(5);

        for (const c of dbCities) {
            const key = `${c.name}_${c.lat}_${c.lon}`;
            if (!seenIds.has(key)) {
                seenIds.add(key);
                results.push({
                    name: c.name,
                    displayName: c.displayName || c.name,
                    lat: String(c.lat),
                    lon: String(c.lon),
                    state: c.state || '',
                    country: c.country || 'India',
                    placeId: c.placeId || c.id,
                    source: 'Database'
                });
            }
        }
    } catch (e) {
        console.warn('[MapService] DB search error:', e.message);
    }

    // 3. Search Nominatim OpenStreetMap (supports addresses, pincodes, small areas)
    try {
        const isPin = /^[1-9][0-9]{5}$/.test(cleanQuery.trim());
        const queries = [searchQuery];
        if (searchQuery !== cleanQuery) queries.push(cleanQuery);

        for (const q of queries) {
            const url = isPin
                ? `${NOMINATIM_API_URL}/search?postalcode=${encodeURIComponent(q.trim())}&country=in&format=json&addressdetails=1&limit=6`
                : `${NOMINATIM_API_URL}/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=in`;

            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'BroomBoomCabs/1.0 (contact@broomboom.com)',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(4000)
            });

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    for (const item of data) {
                        // Skip Islampur if user searched for newtown
                        if (/^new\s*town/i.test(cleanQuery) && /islampur|dinajpur/i.test(item.display_name)) {
                            continue;
                        }

                        const key = `${item.place_id || item.lat + '_' + item.lon}`;
                        if (!seenIds.has(key)) {
                            seenIds.add(key);

                            // Format clean title
                            const parts = (item.display_name || '').split(',');
                            const primary = (parts[0] || '').trim();
                            const secondary = parts.length > 1 ? parts[1].trim() : '';
                            const cleanTitle = secondary && secondary.length < 25
                                ? `${primary}, ${secondary}`
                                : primary;

                            results.push({
                                name: cleanTitle,
                                displayName: item.display_name,
                                lat: String(item.lat),
                                lon: String(item.lon),
                                state: item.address?.state || '',
                                country: item.address?.country || 'India',
                                placeId: item.place_id ? String(item.place_id) : undefined,
                                source: 'Nominatim'
                            });
                        }
                    }
                }
            }
            if (results.length >= 6) break;
        }
    } catch (e) {
        console.warn('[MapService] Nominatim search error:', e.message);
    }

    // 4. Hierarchical fallback for detailed home addresses if no direct match
    if (results.length === 0) {
        const expandedAddress = expandStateAbbreviations(cleanQuery);
        const addressTokens = expandedAddress.split(',').map(p => p.trim()).filter(Boolean);

        if (addressTokens.length > 1) {
            for (let i = 1; i < addressTokens.length; i++) {
                const subQuery = addressTokens.slice(i).join(', ');
                if (/^(west bengal|india|wb|up|mp|maharashtra|delhi)$/i.test(subQuery.trim())) continue;

                const subResults = await searchLocations(subQuery);
                if (subResults && subResults.length > 0) {
                    const prefix = addressTokens.slice(0, i).join(', ');
                    for (const item of subResults) {
                        results.push({
                            name: `${prefix}, ${item.name}`,
                            displayName: `${prefix}, ${item.displayName}`,
                            lat: item.lat,
                            lon: item.lon,
                            state: item.state,
                            country: item.country,
                            placeId: item.placeId ? `hier_${item.placeId}` : undefined,
                            source: item.source
                        });
                    }
                    break;
                }
            }
        }
    }

    return results;
}

// ---------- Driving route and distance via OSRM ----------
async function getDrivingDistanceByCoords(lat1, lon1, lat2, lon2) {
    const pLat = parseFloat(lat1);
    const pLng = parseFloat(lon1);
    const dLat = parseFloat(lat2);
    const dLng = parseFloat(lon2);

    if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
        return null;
    }

    // Same location check
    if (Math.abs(pLat - dLat) < 0.0001 && Math.abs(pLng - dLng) < 0.0001) {
        return {
            distanceKm: 0,
            durationMinutes: 0,
            source: 'SamePoint'
        };
    }

    // Call OSRM API
    try {
        const url = `${OSRM_API_URL}/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=false`;
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
                const route = data.routes[0];
                const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
                const durationMinutes = Math.round(route.duration / 60);

                return {
                    distanceKm,
                    durationMinutes,
                    source: 'OSRM'
                };
            }
        }
    } catch (osrmErr) {
        console.warn('[MapService] OSRM route calculation warning:', osrmErr.message);
    }

    return null;
}

// ---------- Combined: Get distance between two points (cities or coords) ----------
async function calculateDistanceBetween({
    from,
    to,
    pickupLat,
    pickupLng,
    dropLat,
    dropLng
}) {
    let pLat = pickupLat != null ? parseFloat(pickupLat) : null;
    let pLng = pickupLng != null ? parseFloat(pickupLng) : null;
    let dLat = dropLat != null ? parseFloat(dropLat) : null;
    let dLng = dropLng != null ? parseFloat(dropLng) : null;

    let pickupAddress = null;
    let dropAddress = null;

    // Resolve pickup coords and address if coordinates are missing
    if ((pLat === null || pLng === null || isNaN(pLat) || isNaN(pLng)) && from) {
        const geo = await getCoordinates(from);
        if (geo) {
            pLat = geo.lat;
            pLng = geo.lng;
            pickupAddress = geo.displayName;
        }
    }

    // Resolve drop coords and address if coordinates are missing
    if ((dLat === null || dLng === null || isNaN(dLat) || isNaN(dLng)) && to) {
        const geo = await getCoordinates(to);
        if (geo) {
            dLat = geo.lat;
            dLng = geo.lng;
            dropAddress = geo.displayName;
        }
    }

    if (pLat != null && pLng != null && dLat != null && dLng != null) {
        const routeData = await getDrivingDistanceByCoords(pLat, pLng, dLat, dLng);
        if (routeData) {
            return {
                distanceKm: routeData.distanceKm,
                durationMinutes: routeData.durationMinutes,
                source: routeData.source,
                pickupCoords: { lat: pLat, lng: pLng },
                dropCoords: { lat: dLat, lng: dLng },
                pickupAddress,
                dropAddress
            };
        }
        // OSRM failed – use Haversine fallback
        const fallbackKm = calculateHaversineDistance(pLat, pLng, dLat, dLng);
        return {
            distanceKm: fallbackKm,
            durationMinutes: Math.round(fallbackKm * 1.5),
            source: 'HaversineFallback',
            pickupCoords: { lat: pLat, lng: pLng },
            dropCoords: { lat: dLat, lng: dLng },
            pickupAddress,
            dropAddress
        };
    }

    return {
        distanceKm: 0,
        durationMinutes: 0,
        source: 'NotFound',
        pickupCoords: { lat: pLat, lng: pLng },
        dropCoords: { lat: dLat, lng: dLng },
        pickupAddress,
        dropAddress
    };
}

module.exports = {
    getCoordinates,
    searchLocations,
    getDrivingDistanceByCoords,
    calculateDistanceBetween,
    calculateHaversineDistance,
    resolveAlias
};
