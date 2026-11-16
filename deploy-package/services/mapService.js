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

                    // Asynchronously save to DB
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

// ---------- Google Places API Multi-Result Search for Micro & Small Locations ----------
async function searchGooglePlaces(query, limit = 5) {
    const apiKey = getGoogleApiKey();
    if (!apiKey || !query) return [];
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
                pageSize: limit
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (!res.ok) return [];

        const data = await res.json();
        const results = [];
        for (const p of (data.places || [])) {
            const lat = p.location?.latitude;
            const lon = p.location?.longitude;
            if (lat != null && lon != null) {
                const { state, country } = extractStateAndCountry(p.addressComponents);
                const name = p.displayName?.text || (p.formattedAddress || query).split(',')[0].trim();
                const displayName = p.formattedAddress || name;
                const placeId = p.id;

                const item = {
                    name,
                    displayName,
                    lat: String(lat),
                    lon: String(lon),
                    state,
                    country,
                    placeId,
                    source: 'GoogleMaps'
                };

                // Auto-cache to DB in background
                saveOrUpdateCity(item).catch(() => {});
                results.push(item);
            }
        }
        return results;
    } catch (err) {
        console.warn(`[MapService] Google Places search failed for "${query}":`, err.message);
        return [];
    }
}

// Legacy alias maintained for existing callers
async function searchGooglePlacesAutocomplete(query, limit = 5) {
    return await searchGooglePlaces(query, limit);
}

// ---------- Geocode address/city via Redis -> DB (Stage 1) -> OSM (Stage 2) -> Google Places (Stage 3) ----------
async function getCoordinates(query) {
    if (!query || typeof query !== 'string') return null;
    const cleanQuery = normalizeQuery(query);
    if (!cleanQuery) return null;

    // Check Redis / Memory cache first (< 1ms)
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

    // Stage 1: Try Database lookup first
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

    // Stage 3: Google Maps (Google Places Text Search - if DB and OSM fail)
    try {
        const googleGeo = await searchGooglePlacesText(effectiveQuery) || (aliased ? await searchGooglePlacesText(cleanQuery) : null);
        if (googleGeo && googleGeo.lat != null && googleGeo.lng != null) {
            return googleGeo;
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

// ---------- 3-Stage Autocomplete / Location Search (Redis -> DB -> OSM -> Google Maps) ----------
async function searchLocations(query) {
    if (!query || typeof query !== 'string') return [];
    const cleanQuery = normalizeQuery(query);
    if (cleanQuery.length < 2) return [];

    // 0. Check Redis / in-memory cache first (< 1ms)
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

    // Helper to safely add results and avoid duplicates
    function addResult(item) {
        if (!item || !item.lat || !item.lon) return false;
        const latNum = parseFloat(item.lat);
        const lonNum = parseFloat(item.lon);
        if (isNaN(latNum) || isNaN(lonNum)) return false;

        // Check duplicate by placeId
        if (item.placeId && seenIds.has(String(item.placeId))) return false;

        // Check duplicate by normalized name
        const normName = String(item.name || '').trim().toLowerCase();
        if (normName && seenNames.has(normName)) {
            // Check if coordinates are also close (< 500m)
            for (const r of results) {
                const d = calculateHaversineDistance(latNum, lonNum, parseFloat(r.lat), parseFloat(r.lon));
                if (d < 0.5) return false;
            }
        }

        // Check proximity with existing results (within 100 meters)
        for (const r of results) {
            const d = calculateHaversineDistance(latNum, lonNum, parseFloat(r.lat), parseFloat(r.lon));
            if (d < 0.1) return false;
        }

        if (item.placeId) seenIds.add(String(item.placeId));
        if (normName) seenNames.add(normName);
        results.push(item);
        return true;
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 1: Search Local Database (City collection / cached places)
    // ─────────────────────────────────────────────────────────────
    try {
        const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const dbCities = await City.find({
            $or: [
                { name: { $regex: new RegExp(escaped, 'i') } },
                { displayName: { $regex: new RegExp(escaped, 'i') } }
            ]
        }).limit(6);

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
        console.warn('[MapService] DB search error:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 2: OpenStreetMap (Nominatim API)
    // ─────────────────────────────────────────────────────────────
    let osmResultsCount = 0;
    try {
        const isPin = /^[1-9][0-9]{5}$/.test(cleanQuery.trim());
        const queries = [searchQuery];
        if (searchQuery !== cleanQuery) queries.push(cleanQuery);

        for (const q of queries) {
            const nomUrl = getNominatimUrl();
            const url = isPin
                ? `${nomUrl}/search?postalcode=${encodeURIComponent(q.trim())}&country=in&format=json&addressdetails=1&limit=6`
                : `${nomUrl}/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=in`;

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

                        const parts = (item.display_name || '').split(',');
                        const primary = (parts[0] || '').trim();
                        const secondary = parts.length > 1 ? parts[1].trim() : '';
                        const cleanTitle = secondary && secondary.length < 25
                            ? `${primary}, ${secondary}`
                            : primary;

                        const added = addResult({
                            name: cleanTitle,
                            displayName: item.display_name,
                            lat: String(item.lat),
                            lon: String(item.lon),
                            state: item.address?.state || '',
                            country: item.address?.country || 'India',
                            placeId: item.place_id ? String(item.place_id) : undefined,
                            source: 'OpenStreetMap'
                        });

                        if (added) {
                            osmResultsCount++;
                            // Asynchronously cache in DB
                            saveOrUpdateCity({
                                name: cleanTitle,
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
            }
            if (results.length >= 8) break;
        }
    } catch (e) {
        console.warn('[MapService] Nominatim stage error:', e.message);
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 3: Google Maps (Google Places API - Micro & Small Locations)
    // Runs if:
    // 1) Results are sparse (< 4 results), OR
    // 2) OpenStreetMap returned 0 results, OR
    // 3) Query contains keywords typical of micro-localities, societies,
    //    commercial complexes, restaurants, clinics, gates, or street landmarks.
    // ─────────────────────────────────────────────────────────────
    const isMicroLocationQuery = /(society|complex|apartment|tower|heights|enclave|vihar|nagar|colony|road|rd|street|lane|gali|block|sector|sec|gate|terminal|airport|station|railway|mall|bazar|market|hospital|clinic|hotel|restaurant|cafe|dhaba|bhavan|bhawan|building|residency|resort|park|garden|cross|stand|bridge|chowk|para)/i.test(cleanQuery);

    if (results.length < 5 || osmResultsCount === 0 || isMicroLocationQuery) {
        try {
            const googleResults = await searchGooglePlaces(searchQuery, 5);
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

    const finalResults = results.slice(0, 8);
    if (finalResults.length > 0) {
        // Cache in Redis for 24 hours (86400s)
        redisService.set(searchCacheKey, finalResults, 86400).catch(() => {});
    }
    return finalResults;
}

// ---------- Driving route and distance via Google Routes directly with OSRM fallback & Redis ----------
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
    } catch (gErr) {
        console.warn('[MapService] Google Routes API failed, attempting OSRM fallback:', gErr.message);
    }

    // 2. OpenStreetMap (OSRM) Fallback only if Google Routes fails
    try {
        const url = `${getOsrmUrl()}/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=false`;
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });

        if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
                const route = data.routes[0];
                const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
                const durationMinutes = Math.round(route.duration / 60);

                if (distanceKm > 0) {
                    const routeData = {
                        distanceKm,
                        durationMinutes,
                        source: 'OSRM'
                    };
                    // Cache in Redis for 14 days (1209600s)
                    redisService.set(distCacheKey, routeData, 1209600).catch(() => {});
                    return routeData;
                }
            }
        }
    } catch (osrmErr) {
        console.warn('[MapService] OSRM fallback failed:', osrmErr.message);
    }

    return null;
}

// ---------- Combined: Get distance between two points ----------
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

    if ((pLat === null || pLng === null || isNaN(pLat) || isNaN(pLng)) && from) {
        const geo = await getCoordinates(from);
        if (geo) {
            pLat = geo.lat;
            pLng = geo.lng;
            pickupAddress = geo.displayName;
        }
    }

    if ((dLat === null || dLng === null || isNaN(dLat) || isNaN(dLng)) && to) {
        const geo = await getCoordinates(to);
        if (geo) {
            dLat = geo.lat;
            dLng = geo.lng;
            dropAddress = geo.displayName;
        }
    }

    // 1. Driving route calculation (Google Routes first)
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

    // 2. If coordinates could not be resolved from text, fallback to Google Routes with address strings
    if (from && to) {
        const googleRoute = await getGoogleDrivingDistance(null, null, null, null, from, to);
        if (googleRoute && googleRoute.distanceKm > 0) {
            return {
                distanceKm: googleRoute.distanceKm,
                durationMinutes: googleRoute.durationMinutes,
                source: 'GoogleMaps',
                pickupCoords: { lat: pLat, lng: pLng },
                dropCoords: { lat: dLat, lng: dLng },
                pickupAddress: pickupAddress || from,
                dropAddress: dropAddress || to
            };
        }
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
    resolveAlias,
    saveOrUpdateCity,
    getGoogleDrivingDistance,
    searchGooglePlacesAutocomplete,
    redisService
};