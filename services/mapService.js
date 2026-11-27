const City = require('../models/City');
const redisService = require('./redisService');

const getOsrmUrl = () => process.env.OSRM_API_URL || 'https://router.project-osrm.org';
const getNominatimUrl = () => process.env.NOMINATIM_URL || process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org';
const getGoogleApiKey = () => process.env.GOOGLE_MAPS_API_KEY;

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

// ---------- Haversine formula (straight-line fallback) ----------
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

// ---------- Helper to auto-store / cache place in Database ----------
async function saveOrUpdateCity({ name, displayName, lat, lon, state, country, placeId }) {
    if (!name || lat == null || lon == null) return null;
    try {
        const cleanName = String(name).trim();
        const cleanDisplayName = String(displayName || cleanName).trim();
        const strLat = String(lat).trim();
        const strLon = String(lon).trim();
        const strPlaceId = placeId ? String(placeId).trim() : null;

        let existing = null;
        if (strPlaceId) {
            existing = await City.findOne({ placeId: strPlaceId });
        }
        if (!existing && cleanName) {
            existing = await City.findOne({
                name: { $regex: new RegExp('^' + cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
            });
        }
        if (!existing && cleanDisplayName && cleanDisplayName !== cleanName) {
            existing = await City.findOne({
                displayName: { $regex: new RegExp('^' + cleanDisplayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
            });
        }

        if (existing) {
            let updated = false;
            if (!existing.lat || !existing.lon) {
                existing.lat = strLat;
                existing.lon = strLon;
                updated = true;
            }
            if (!existing.displayName && cleanDisplayName) {
                existing.displayName = cleanDisplayName;
                updated = true;
            }
            if (!existing.state && state) {
                existing.state = state;
                updated = true;
            }
            if (updated) {
                await existing.save();
            }
            return existing;
        }

        return await City.create({
            name: cleanName,
            displayName: cleanDisplayName,
            lat: strLat,
            lon: strLon,
            state: state || '',
            country: country || 'India',
            placeId: strPlaceId || undefined
        });
    } catch (err) {
        return null;
    }
}

// ---------- Helper to parse address components from Google Places API ----------
function extractStateAndCountry(components = []) {
    let state = '';
    let country = 'India';
    if (!Array.isArray(components)) return { state, country };
    for (const comp of components) {
        if (Array.isArray(comp.types)) {
            if (comp.types.includes('administrative_area_level_1')) {
                state = comp.longText || comp.shortText || '';
            }
            if (comp.types.includes('country')) {
                country = comp.longText || comp.shortText || 'India';
            }
        }
    }
    return { state, country };
}

// ---------- Driving route and distance via Google Routes API ----------
async function getGoogleDrivingDistance(pLat, pLng, dLat, dLng, originAddress, destAddress) {
    const apiKey = getGoogleApiKey();
    if (!apiKey) return null;

    let origin = null;
    let destination = null;

    if (pLat != null && pLng != null && !isNaN(parseFloat(pLat)) && !isNaN(parseFloat(pLng))) {
        origin = {
            location: {
                latLng: {
                    latitude: parseFloat(pLat),
                    longitude: parseFloat(pLng)
                }
            }
        };
    } else if (originAddress && typeof originAddress === 'string') {
        origin = { address: originAddress.trim() };
    }

    if (dLat != null && dLng != null && !isNaN(parseFloat(dLat)) && !isNaN(parseFloat(dLng))) {
        destination = {
            location: {
                latLng: {
                    latitude: parseFloat(dLat),
                    longitude: parseFloat(dLng)
                }
            }
        };
    } else if (destAddress && typeof destAddress === 'string') {
        destination = { address: destAddress.trim() };
    }

    if (!origin || !destination) return null;

    try {
        const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
        const body = {
            origin,
            destination,
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_UNAWARE'
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration'
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.routes) && data.routes.length > 0) {
                const route = data.routes[0];
                const meters = parseFloat(route.distanceMeters) || 0;
                const distanceKm = Math.round((meters / 1000.0) * 10) / 10;

                let durationMinutes = 0;
                if (typeof route.duration === 'string') {
                    const sec = parseInt(route.duration.replace('s', ''), 10) || 0;
                    durationMinutes = Math.round(sec / 60);
                }

                return {
                    distanceKm,
                    durationMinutes,
                    source: 'GoogleMaps'
                };
            }
        } else {
            const errText = await res.text();
            console.warn('[MapService] Google Routes API error response:', res.status, errText);
        }
    } catch (gErr) {
        console.warn('[MapService] Google Routes API request failed:', gErr.message);
    }

    return null;
}

// ---------- Google Places API Text Search (Single Result) ----------
async function searchGooglePlacesText(query) {
    const apiKey = getGoogleApiKey();
    if (!apiKey || !query) return null;
    try {
        const url = 'https://places.googleapis.com/v1/places:searchText';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents'
            },
            body: JSON.stringify({
                textQuery: query,
                regionCode: 'IN',
                pageSize: 1
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.places) && data.places.length > 0) {
                const place = data.places[0];
                const lat = place.location?.latitude;
                const lng = place.location?.longitude;
                if (lat != null && lng != null) {
                    const { state, country } = extractStateAndCountry(place.addressComponents);
                    const displayName = place.formattedAddress || place.displayName?.text || query;
                    const name = place.displayName?.text || query.split(',')[0].trim();

                    // Save to DB so future lookups resolve from DB/Redis instead of Google
                    saveOrUpdateCity({
                        name,
                        displayName,
                        lat,
                        lon: lng,
                        state,
                        country,
                        placeId: place.id
                    }).catch(() => {});

                    return {
                        lat: parseFloat(lat),
                        lng: parseFloat(lng),
                        displayName,
                        state,
                        country,
                        source: 'GooglePlaces'
                    };
                }
            }
        }
    } catch (err) {
        console.warn(`[MapService] Google Places textSearch failed for "${query}":`, err.message);
    }
    return null;
}

// ---------- Google Places API Multi-Result Search (Fallback only when Cache, DB & OSM fail/return nothing) ----------
async function searchGooglePlaces(query, limit = 10) {
    const apiKey = getGoogleApiKey();
    if (!apiKey || !query) return [];
    try {
        const url = 'https://places.googleapis.com/v1/places:autocomplete';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
            },
            body: JSON.stringify({
                input: query,
                includedRegionCodes: ['IN']
            }),
            signal: AbortSignal.timeout(4000)
        });

        if (!res.ok) {
            console.warn('[MapService] Google Places Autocomplete HTTP', res.status);
            return [];
        }

        const data = await res.json();
        const suggestions = (data.suggestions || []).slice(0, limit);
        if (suggestions.length === 0) return [];

        const results = [];
        const detailPromises = suggestions.map(async (s) => {
            const p = s.placePrediction;
            if (!p || !p.placeId) return null;
            const fullText = p.text?.text || '';

            try {
                const detailRes = await fetch(
                    `https://places.googleapis.com/v1/places/${encodeURIComponent(p.placeId)}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': apiKey,
                            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents'
                        },
                        signal: AbortSignal.timeout(3000)
                    }
                );
                if (detailRes.ok) {
                    const place = await detailRes.json();
                    const lat = place.location?.latitude;
                    const lon = place.location?.longitude;
                    if (lat != null && lon != null) {
                        const { state, country } = extractStateAndCountry(place.addressComponents);
                        const displayName = place.formattedAddress || fullText;
                        const item = {
                            name: displayName,
                            displayName: displayName,
                            lat: String(lat),
                            lon: String(lon),
                            state: state || '',
                            country: country || 'India',
                            placeId: place.id,
                            source: 'GoogleMaps'
                        };
                        // Save to DB so future searches resolve from DB/Redis without hitting Google
                        saveOrUpdateCity(item).catch(() => {});
                        return item;
                    }
                }
            } catch (dErr) {}

            return {
                name: fullText,
                displayName: fullText,
                lat: '22.5726',
                lon: '88.3639',
                state: 'India',
                country: 'India',
                placeId: p.placeId,
                source: 'GoogleMaps'
            };
        });

        const resolved = await Promise.all(detailPromises);
        for (const r of resolved) {
            if (r) results.push(r);
        }
        return results;
    } catch (err) {
        console.warn(`[MapService] Google Places Autocomplete failed for "${query}":`, err.message);
        return [];
    }
}

// Legacy alias maintained for existing callers
async function searchGooglePlacesAutocomplete(query, limit = 10) {
    return await searchGooglePlaces(query, limit);
}

// ---------- Geocode address/city via Redis -> DB -> OSM -> Google (only if Cache/DB/OSM fail or miss) ----------
async function getCoordinates(query) {
    if (!query || typeof query !== 'string') return null;
    const cleanQuery = normalizeQuery(query);
    if (!cleanQuery) return null;

    // 0. Check Redis / Memory cache first (< 1ms)
    const geoCacheKey = `bb:map:geo:${cleanQuery.toLowerCase()}`;
    const cachedGeo = await redisService.get(geoCacheKey);
    if (cachedGeo && cachedGeo.lat != null && cachedGeo.lng != null) {
        return {
            ...cachedGeo,
            source: `${cachedGeo.source} (RedisCached)`
        };
    }

    const geoResult = await _resolveCoordinates(cleanQuery);
    if (geoResult && geoResult.lat != null && geoResult.lng != null) {
        // Cache in Redis for 7 days (604800s)
        redisService.set(geoCacheKey, geoResult, 604800).catch(() => {});
    }
    return geoResult;
}

async function _resolveCoordinates(cleanQuery) {
    const aliased = resolveAlias(cleanQuery);
    const effectiveQuery = aliased || cleanQuery;

    // Stage 1: Database lookup first
    try {
        const primaryName = effectiveQuery.split(',')[0].trim();
        const escapedFull = effectiveQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedPrimary = primaryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

        if (!cityInDb && primaryName.length > 1) {
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

    // Stage 2: OpenStreetMap (Nominatim API)
    const queriesToTry = [effectiveQuery];
    if (aliased && aliased !== cleanQuery) {
        queriesToTry.push(cleanQuery);
    }

    const pinMatch = cleanQuery.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) {
        queriesToTry.push(pinMatch[1]);
    }

    for (const q of queriesToTry) {
        try {
            const isPin = /^[1-9][0-9]{5}$/.test(q.trim());
            const nomUrl = getNominatimUrl();
            const url = isPin
                ? `${nomUrl}/search?postalcode=${encodeURIComponent(q.trim())}&country=in&format=json&addressdetails=1&limit=3`
                : `${nomUrl}/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=3&countrycodes=in`;

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
                    let item = data[0];
                    if (/^new\s*town/i.test(cleanQuery)) {
                        const kolkataItem = data.find(d => /kolkata|rajarhat|24 parganas/i.test(d.display_name));
                        if (kolkataItem) item = kolkataItem;
                    }

                    const lat = parseFloat(item.lat);
                    const lng = parseFloat(item.lon);
                    const detectedState = item.address?.state || '';

                    try {
                        const primaryName = q.split(',')[0].trim();
                        saveOrUpdateCity({
                            name: primaryName,
                            displayName: item.display_name,
                            lat,
                            lon: lng,
                            state: detectedState,
                            country: item.address?.country || 'India',
                            placeId: item.place_id ? String(item.place_id) : undefined
                        }).catch(() => {});
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
            console.warn(`[MapService] Nominatim fallback failed for "${q}":`, apiErr.message);
        }
    }

    // Stage 3: Google Maps - ONLY called if Cache, DB, and OSM all failed or returned nothing
    try {
        const googleGeo = await searchGooglePlacesText(effectiveQuery) || (aliased ? await searchGooglePlacesText(cleanQuery) : null);
        if (googleGeo && googleGeo.lat != null && googleGeo.lng != null) {
            return googleGeo;
        }

        const autoResults = await searchGooglePlaces(effectiveQuery, 1);
        if (Array.isArray(autoResults) && autoResults.length > 0 && autoResults[0].lat && autoResults[0].lon) {
            return {
                lat: parseFloat(autoResults[0].lat),
                lng: parseFloat(autoResults[0].lon),
                displayName: autoResults[0].displayName || effectiveQuery,
                state: autoResults[0].state || '',
                source: 'GoogleMaps'
            };
        }
    } catch (gErr) {
        console.warn(`[MapService] Google Places geocoding failed for "${effectiveQuery}":`, gErr.message);
    }

    // Stage 4: Progressive Hierarchical Fallback for Detailed Addresses
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

// ---------- Location Search: All matches from Cache -> DB + OSM (NO Google unless Cache/DB/OSM fail or return 0) ----------
async function searchLocations(query) {
    if (!query || typeof query !== 'string') return [];
    const cleanQuery = normalizeQuery(query);
    if (cleanQuery.length < 2) return [];

    // 0. Check Redis / in-memory cache first (< 1ms) — skips DB, OSM, and Google completely
    const searchCacheKey = `bb:map:search:${cleanQuery.toLowerCase()}`;
    const cachedResults = await redisService.get(searchCacheKey);
    if (Array.isArray(cachedResults) && cachedResults.length > 0) {
        return cachedResults;
    }

    const results = [];
    const seenIds = new Set();
    const seenNames = new Set();

    const aliased = resolveAlias(cleanQuery);
    const searchQuery = aliased || cleanQuery;

    let dbFailed = false;
    let osmFailed = false;

    // Helper to merge DB & OSM locations while avoiding exact duplicates
    function addResult(item) {
        if (!item || !item.lat || !item.lon) return false;
        const latNum = parseFloat(item.lat);
        const lonNum = parseFloat(item.lon);
        if (isNaN(latNum) || isNaN(lonNum)) return false;

        if (item.placeId && seenIds.has(String(item.placeId))) return false;

        const normName = String(item.name || '').trim().toLowerCase();
        const primaryName = normName.split(',')[0].trim();

        if (normName && seenNames.has(normName)) {
            for (const r of results) {
                const d = calculateHaversineDistance(latNum, lonNum, parseFloat(r.lat), parseFloat(r.lon));
                if (d < 1.5) return false;
            }
        }

        for (const r of results) {
            const rPrimary = String(r.name || '').trim().toLowerCase().split(',')[0].trim();
            const d = calculateHaversineDistance(latNum, lonNum, parseFloat(r.lat), parseFloat(r.lon));
            // Deduplicate identical place names at the same spot (e.g. "Kolkata" vs "Kolkata, West Bengal, India")
            if (primaryName && rPrimary === primaryName && d < 1.5) return false;
            // Deduplicate exact same coordinates (< 50m)
            if (d < 0.05) return false;
        }

        if (item.placeId) seenIds.add(String(item.placeId));
        if (normName) seenNames.add(normName);
        results.push(item);
        return true;
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 1: Collect all matching places from Local Database
    // ─────────────────────────────────────────────────────────────
    try {
        const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const dbCities = await City.find({
            $or: [
                { name: { $regex: new RegExp(escaped, 'i') } },
                { displayName: { $regex: new RegExp(escaped, 'i') } }
            ]
        }).limit(30);

        for (const c of dbCities) {
            addResult({
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
    } catch (e) {
        dbFailed = true;
        console.warn('[MapService] DB search error:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 2: Always query OpenStreetMap (Nominatim) so ALL possible
    //          locations from DB + OSM are shown together
    // ─────────────────────────────────────────────────────────────
    try {
        const isPin = /^[1-9][0-9]{5}$/.test(cleanQuery.trim());
        const queries = [searchQuery];
        if (searchQuery !== cleanQuery) queries.push(cleanQuery);

        for (const q of queries) {
            const nomUrl = getNominatimUrl();
            const url = isPin
                ? `${nomUrl}/search?postalcode=${encodeURIComponent(q.trim())}&country=in&format=json&addressdetails=1&limit=15`
                : `${nomUrl}/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=15&countrycodes=in`;

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
                        if (/^new\s*town/i.test(cleanQuery) && /islampur|dinajpur/i.test(item.display_name)) {
                            continue;
                        }

                        const added = addResult({
                            name: item.display_name,
                            displayName: item.display_name,
                            lat: String(item.lat),
                            lon: String(item.lon),
                            state: item.address?.state || '',
                            country: item.address?.country || 'India',
                            placeId: item.place_id ? String(item.place_id) : undefined,
                            source: 'OpenStreetMap'
                        });

                        if (added) {
                            saveOrUpdateCity({
                                name: item.display_name,
                                displayName: item.display_name,
                                lat: item.lat,
                                lon: item.lon,
                                state: item.address?.state || '',
                                country: item.address?.country || 'India',
                                placeId: item.place_id ? String(item.place_id) : undefined
                            }).catch(() => {});
                        }
                    }
                }
            } else {
                osmFailed = true;
                console.warn('[MapService] Nominatim HTTP error:', res.status);
            }
        }
    } catch (e) {
        osmFailed = true;
        console.warn('[MapService] Nominatim search error:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 3: Google Maps — ONLY called if Cache, DB & OSM returned
    //          0 results OR if DB/OSM failed and yielded no results
    // ─────────────────────────────────────────────────────────────
    if (results.length === 0 || (dbFailed && osmFailed)) {
        try {
            const googleResults = await searchGooglePlaces(searchQuery, 10);
            for (const place of googleResults) {
                addResult(place);
            }
        } catch (gErr) {
            console.warn('[MapService] Google Places stage error:', gErr.message);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 4: Hierarchical fallback for detailed multi-part home addresses
    // ─────────────────────────────────────────────────────────────
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
                        addResult({
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

    if (results.length > 0) {
        // Cache in Redis for 24 hours (86400s)
        redisService.set(searchCacheKey, results, 86400).catch(() => {});
    }
    return results;
}

// ---------- Driving route and distance via Google Routes with OSRM & Haversine fallback ----------
async function getDrivingDistanceByCoords(lat1, lon1, lat2, lon2) {
    const pLat = parseFloat(lat1);
    const pLng = parseFloat(lon1);
    const dLat = parseFloat(lat2);
    const dLng = parseFloat(lon2);

    if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
        return null;
    }

    if (Math.abs(pLat - dLat) < 0.0001 && Math.abs(pLng - dLng) < 0.0001) {
        return {
            distanceKm: 0,
            durationMinutes: 0,
            source: 'SamePoint'
        };
    }

    // Check Redis / Memory cache for driving route (< 1ms)
    const distCacheKey = `bb:map:dist:${pLat.toFixed(4)},${pLng.toFixed(4)}:${dLat.toFixed(4)},${dLng.toFixed(4)}`;
    const cachedDist = await redisService.get(distCacheKey);
    if (cachedDist && cachedDist.distanceKm !== undefined) {
        return {
            ...cachedDist,
            source: `${cachedDist.source} (RedisCached)`
        };
    }

    // 1. Google Maps Routes API directly
    try {
        const googleRoute = await getGoogleDrivingDistance(pLat, pLng, dLat, dLng);
        if (googleRoute && googleRoute.distanceKm > 0) {
            // Cache in Redis for 14 days (1209600s)
            redisService.set(distCacheKey, googleRoute, 1209600).catch(() => {});
            return googleRoute;
        }
    } catch (e) {
        console.warn('[MapService] Google Routes lookup error:', e.message);
    }

    // 2. OSRM fallback
    try {
        const osrmUrl = getOsrmUrl();
        const url = `${osrmUrl}/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=false`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
                const route = data.routes[0];
                const distanceKm = Math.round(((route.distance || 0) / 1000.0) * 10) / 10;
                const durationMinutes = Math.round((route.duration || 0) / 60);
                if (distanceKm > 0) {
                    const osrmResult = {
                        distanceKm,
                        durationMinutes,
                        source: 'OSRM'
                    };
                    redisService.set(distCacheKey, osrmResult, 1209600).catch(() => {});
                    return osrmResult;
                }
            }
        }
    } catch (osrmErr) {
        console.warn('[MapService] OSRM routing fallback failed:', osrmErr.message);
    }

    // 3. Haversine straight-line fallback
    const haversineKm = calculateHaversineDistance(pLat, pLng, dLat, dLng);
    return {
        distanceKm: haversineKm,
        durationMinutes: Math.round((haversineKm / 40) * 60),
        source: 'Haversine'
    };
}

// ---------- Unified Distance Calculator (supports single object, 2 endpoints, or 4 coords) ----------
async function calculateDistanceBetween(origin, destination, arg3, arg4) {
    const emptyFallback = (p1 = null, p2 = null, reason = 'UnresolvedFallback') => ({
        distanceKm: 0,
        distance: 0,
        durationMinutes: 0,
        source: reason,
        origin: p1,
        destination: p2
    });

    // Signature A: Single payload object -> calculateDistanceBetween({ pickup, drop, pLat, pLng, dLat, dLng, ... })
    if (destination === undefined && origin && typeof origin === 'object' && !Array.isArray(origin)) {
        const obj = origin;

        const rawOrigin =
            obj.origin ??
            obj.pickup ??
            obj.pickupCity ??
            obj.pickupLocation ??
            obj.pickupAddress ??
            obj.from ??
            obj.fromCity ??
            obj.fromLocation ??
            obj.source ??
            obj.sourceCity ??
            obj.sourceLocation ??
            obj.start ??
            obj.startLocation ??
            obj.originCity ??
            obj.originAddress;

        const rawDest =
            obj.destination ??
            obj.drop ??
            obj.dropoff ??
            obj.dropCity ??
            obj.dropoffCity ??
            obj.dropLocation ??
            obj.dropoffLocation ??
            obj.dropAddress ??
            obj.dropoffAddress ??
            obj.to ??
            obj.toCity ??
            obj.toLocation ??
            obj.dest ??
            obj.destCity ??
            obj.destAddress ??
            obj.destinationCity ??
            obj.destinationAddress ??
            obj.end ??
            obj.endLocation;

        const pCoords = obj.pickupCoords || obj.pickupCoordinates || obj.originCoords || obj.originCoordinates || obj.fromCoords;
        const dCoords = obj.dropCoords || obj.dropoffCoords || obj.dropCoordinates || obj.dropoffCoordinates || obj.destCoords || obj.destinationCoords || obj.toCoords;

        const pLat =
            obj.pLat ?? obj.pickupLat ?? obj.originLat ?? obj.fromLat ?? obj.sourceLat ?? obj.startLat ?? obj.lat1 ??
            (Array.isArray(pCoords) ? pCoords[0] : (pCoords?.lat ?? pCoords?.latitude));
        const pLng =
            obj.pLng ?? obj.pLon ?? obj.pickupLng ?? obj.pickupLon ?? obj.originLng ?? obj.originLon ?? obj.fromLng ?? obj.fromLon ?? obj.sourceLng ?? obj.sourceLon ?? obj.startLng ?? obj.startLon ?? obj.lng1 ?? obj.lon1 ??
            (Array.isArray(pCoords) ? pCoords[1] : (pCoords?.lng ?? pCoords?.lon ?? pCoords?.longitude));

        const dLat =
            obj.dLat ?? obj.dropLat ?? obj.dropoffLat ?? obj.destLat ?? obj.destinationLat ?? obj.toLat ?? obj.endLat ?? obj.lat2 ??
            (Array.isArray(dCoords) ? dCoords[0] : (dCoords?.lat ?? dCoords?.latitude));
        const dLng =
            obj.dLng ?? obj.dLon ?? obj.dropLng ?? obj.dropLon ?? obj.dropoffLng ?? obj.dropoffLon ?? obj.destLng ?? obj.destLon ?? obj.destinationLng ?? obj.destinationLon ?? obj.toLng ?? obj.toLon ?? obj.endLng ?? obj.endLon ?? obj.lng2 ?? obj.lon2 ??
            (Array.isArray(dCoords) ? dCoords[1] : (dCoords?.lng ?? dCoords?.lon ?? dCoords?.longitude));

        if (pLat != null && pLng != null) {
            origin = {
                ...(typeof rawOrigin === 'object' && rawOrigin !== null ? rawOrigin : {}),
                lat: pLat,
                lng: pLng,
                address: typeof rawOrigin === 'string' ? rawOrigin : (rawOrigin?.address || rawOrigin?.displayName || rawOrigin?.name || '')
            };
        } else {
            origin = rawOrigin;
        }

        if (dLat != null && dLng != null) {
            destination = {
                ...(typeof rawDest === 'object' && rawDest !== null ? rawDest : {}),
                lat: dLat,
                lng: dLng,
                address: typeof rawDest === 'string' ? rawDest : (rawDest?.address || rawDest?.displayName || rawDest?.name || '')
            };
        } else {
            destination = rawDest;
        }
    }

    // Signature B: 4 primitive coordinate args -> calculateDistanceBetween(lat1, lon1, lat2, lon2)
    if (
        arguments.length >= 4 &&
        (arg3 == null || typeof arg3 !== 'object') &&
        (arg4 == null || typeof arg4 !== 'object')
    ) {
        const route = await getDrivingDistanceByCoords(origin, destination, arg3, arg4);
        return route ? { ...route, distance: route.distanceKm } : emptyFallback(null, null, 'InvalidCoords');
    }

    // Signature C: 4 args with coord objects -> calculateDistanceBetween(origin, destination, originCoords, destCoords)
    if (arguments.length >= 4 && (typeof arg3 === 'object' || typeof arg4 === 'object')) {
        origin = { ...(typeof arg3 === 'object' && arg3 !== null ? arg3 : {}), address: typeof origin === 'string' ? origin : origin?.address };
        destination = { ...(typeof arg4 === 'object' && arg4 !== null ? arg4 : {}), address: typeof destination === 'string' ? destination : destination?.address };
    }

    // Signature D: 3 args with options/coords object -> calculateDistanceBetween(origin, destination, options)
    if (arguments.length === 3 && arg3 && typeof arg3 === 'object') {
        const pLat = arg3.pLat ?? arg3.pickupLat ?? arg3.originLat ?? arg3.lat1;
        const pLng = arg3.pLng ?? arg3.pLon ?? arg3.pickupLng ?? arg3.originLng ?? arg3.lon1 ?? arg3.lng1;
        const dLat = arg3.dLat ?? arg3.dropLat ?? arg3.destLat ?? arg3.lat2;
        const dLng = arg3.dLng ?? arg3.dLon ?? arg3.dropLng ?? arg3.destLng ?? arg3.lon2 ?? arg3.lng2;
        if (pLat != null && pLng != null) {
            origin = { lat: pLat, lng: pLng, address: typeof origin === 'string' ? origin : origin?.address };
        }
        if (dLat != null && dLng != null) {
            destination = { lat: dLat, lng: dLng, address: typeof destination === 'string' ? destination : destination?.address };
        }
    }

    if (!origin || !destination) {
        return emptyFallback(null, null, 'MissingEndpoints');
    }

    const resolvePoint = async (point) => {
        if (!point) return null;

        if (Array.isArray(point) && point.length >= 2) {
            const lat = parseFloat(point[0]);
            const lng = parseFloat(point[1]);
            if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) return { lat, lng, address: '' };
        }

        if (typeof point === 'string') {
            const trimmed = normalizeQuery(point);
            if (!trimmed) return null;

            // Handle "lat, lng" coordinate strings directly
            const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
            if (coordMatch) {
                return {
                    lat: parseFloat(coordMatch[1]),
                    lng: parseFloat(coordMatch[2]),
                    address: trimmed
                };
            }

            const coords = await getCoordinates(trimmed);
            return coords
                ? { lat: coords.lat, lng: coords.lng, address: coords.displayName || trimmed }
                : { lat: null, lng: null, address: trimmed };
        }

        if (typeof point === 'object') {
            const nested = point.location || point.coords || {};
            const rawLat = point.lat ?? point.latitude ?? nested.lat ?? nested.latitude;
            const rawLng = point.lng ?? point.lon ?? point.longitude ?? nested.lng ?? nested.lon ?? nested.longitude;
            const address =
                point.address ||
                point.displayName ||
                point.name ||
                point.city ||
                point.label ||
                point.place ||
                point.text ||
                point.value ||
                '';

            const parsedLat = parseFloat(rawLat);
            const parsedLng = parseFloat(rawLng);
            if (rawLat != null && rawLng != null && !isNaN(parsedLat) && !isNaN(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
                return {
                    lat: parsedLat,
                    lng: parsedLng,
                    address: address ? normalizeQuery(String(address)) : ''
                };
            }

            if (address) {
                const cleanAddr = normalizeQuery(String(address));
                const coords = await getCoordinates(cleanAddr);
                return coords
                    ? { lat: coords.lat, lng: coords.lng, address: coords.displayName || cleanAddr }
                    : { lat: null, lng: null, address: cleanAddr };
            }
        }

        return null;
    };

    const [p1, p2] = await Promise.all([resolvePoint(origin), resolvePoint(destination)]);
    if (!p1 || !p2) {
        return emptyFallback(p1, p2, 'InvalidEndpoints');
    }

    // Primary path: Redis -> Google Routes -> OSRM -> Haversine
    if (p1.lat != null && p1.lng != null && p2.lat != null && p2.lng != null) {
        const result = await getDrivingDistanceByCoords(p1.lat, p1.lng, p2.lat, p2.lng);
        if (result) {
            return {
                ...result,
                distance: result.distanceKm,
                origin: p1,
                destination: p2
            };
        }
    }

    // Fallback path: let Google Routes geocode and route raw addresses directly
    if (p1.address && p2.address) {
        const directGoogle = await getGoogleDrivingDistance(p1.lat, p1.lng, p2.lat, p2.lng, p1.address, p2.address);
        if (directGoogle) {
            return {
                ...directGoogle,
                distance: directGoogle.distanceKm,
                origin: p1,
                destination: p2
            };
        }
    }

    return emptyFallback(p1, p2, 'UnresolvedFallback');
}

module.exports = {
    normalizeQuery,
    resolveAlias,
    expandStateAbbreviations,
    calculateHaversineDistance,
    saveOrUpdateCity,
    getGoogleDrivingDistance,
    searchGooglePlacesText,
    searchGooglePlaces,
    searchGooglePlacesAutocomplete,
    getCoordinates,
    searchLocations,
    getDrivingDistanceByCoords,
    calculateDistanceBetween
};