/**
 * ROMA TRANSIT EXPRESS - BACKEND UFFICIALE GTFS & GTFS-RT (ZERO MOCK)
 * Decodifica i feed Protocol Buffers (.pb) di Roma Mobilita / ATAC
 * e interroga il database SQLite locale sincronizzato con rome_static_gtfs.zip
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'data', 'roma_gtfs.db');
const OTP_URL = process.env.OTP_URL || 'http://localhost:8080/otp/routers/default/plan';

const URLS = {
  TU: 'https://romamobilita.it/sites/default/files/rome_rtgtfs_trip_updates_feed.pb',
  VP: 'https://romamobilita.it/sites/default/files/rome_rtgtfs_vehicle_positions_feed.pb',
  SA: 'https://romamobilita.it/sites/default/files/rome_rtgtfs_service_alerts_feed.pb'
};

let db = null;
if (!fs.existsSync(DB_PATH)) {
  console.log('[SQLite] Database non trovato. Avvio sincronizzazione automatica GTFS Roma...');
  try {
    const { execSync } = require('child_process');
    execSync('node scripts/sync-gtfs.js', { stdio: 'inherit' });
  } catch (syncErr) {
    console.error('[SQLite] Errore sincronizzazione automatica:', syncErr.message);
  }
}

if (fs.existsSync(DB_PATH)) {
  db = new Database(DB_PATH, { readonly: true });
  console.log('[SQLite] Database GTFS Statico Roma caricato con successo.');
} else {
  console.warn('[SQLite] Database non disponibile. Esegui "npm run sync-gtfs".');
}

// Cache in memoria per i 3 feed GTFS-RT (aggiornata ogni 15 secondi)
let rtCache = {
  lastUpdated: 0,
  tripUpdates: [],
  vehicles: [],
  alerts: []
};

async function fetchProtobufFeed(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RomaTransitExpress/2.0 (ATAC OpenData Client)',
      'Accept': 'application/x-protobuf, application/octet-stream'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} su ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(arrayBuffer));
}

async function refreshRealtimeFeeds() {
  try {
    const [tuRes, vpRes, saRes] = await Promise.allSettled([
      fetchProtobufFeed(URLS.TU),
      fetchProtobufFeed(URLS.VP),
      fetchProtobufFeed(URLS.SA)
    ]);

    if (tuRes.status === 'fulfilled') {
      rtCache.tripUpdates = tuRes.value.entity.filter(e => e.tripUpdate).map(e => e.tripUpdate);
    }
    if (vpRes.status === 'fulfilled') {
      rtCache.vehicles = vpRes.value.entity
        .filter(e => e.vehicle && e.vehicle.position)
        .map(e => {
          const v = e.vehicle;
          return {
            id: v.vehicle?.id || e.id,
            label: v.vehicle?.label || v.vehicle?.id || e.id,
            routeId: v.trip?.routeId || '',
            tripId: v.trip?.tripId || '',
            directionId: v.trip?.directionId ?? 0,
            lat: v.position.latitude,
            lon: v.position.longitude,
            bearing: v.position.bearing || 0,
            speed: v.position.speed || 0,
            stopId: v.stopId || '',
            occupancyStatus: v.occupancyStatus ?? null,
            timestamp: Number(v.timestamp || Math.floor(Date.now() / 1000))
          };
        });
    }
    if (saRes.status === 'fulfilled') {
      rtCache.alerts = saRes.value.entity
        .filter(e => e.alert)
        .map(e => ({
          id: e.id,
          header: e.alert.headerText?.translation?.[0]?.text || 'Avviso ATAC',
          description: e.alert.descriptionText?.translation?.[0]?.text || '',
          informedEntities: e.alert.informedEntity || []
        }));
    }

    rtCache.lastUpdated = Date.now();
    console.log(`[GTFS-RT] Aggiornato: ${rtCache.tripUpdates.length} corse, ${rtCache.vehicles.length} bus GPS, ${rtCache.alerts.length} avvisi.`);
  } catch (err) {
    console.error('[GTFS-RT] Errore aggiornamento feed:', err.message);
  }
}

refreshRealtimeFeeds();
setInterval(refreshRealtimeFeeds, 15000);

// 1. Stato e diagnostica feed reali
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    gtfsStaticLoaded: Boolean(db),
    lastRealtimeUpdate: rtCache.lastUpdated,
    counts: {
      tripUpdates: rtCache.tripUpdates.length,
      vehicles: rtCache.vehicles.length,
      alerts: rtCache.alerts.length
    }
  });
});

// 2. Ricerca fermate per codice palina (es. 70046) o nome
app.get('/api/stops/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  if (!db) return res.status(503).json({ error: 'Database GTFS non ancora inizializzato. Esegui npm run sync-gtfs.' });

  const stmt = db.prepare(`
    SELECT stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon
    FROM stops
    WHERE stop_code = ? OR stop_id = ? OR stop_name LIKE ?
    LIMIT 60
  `);
  const rows = stmt.all(q, q, `%${q}%`);
  res.json(rows);
});

// 3. Fermate vicine a coordinate GPS (Bounding Box + Haversine)
app.get('/api/stops/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radiusMeters = parseFloat(req.query.radius || '650');
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Coordinate lat/lon mancanti' });
  if (!db) return res.status(503).json({ error: 'Database GTFS non inizializzato.' });

  const latDelta = radiusMeters / 111320;
  const lonDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  const stmt = db.prepare(`
    SELECT stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon
    FROM stops
    WHERE stop_lat BETWEEN ? AND ?
      AND stop_lon BETWEEN ? AND ?
  `);
  const candidates = stmt.all(lat - latDelta, lat + latDelta, lon - lonDelta, lon + lonDelta);

  const toRad = d => (d * Math.PI) / 180;
  const results = candidates
    .map(s => {
      const R = 6371000;
      const dLat = toRad(s.stop_lat - lat);
      const dLon = toRad(s.stop_lon - lon);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(s.stop_lat)) * Math.sin(dLon / 2) ** 2;
      const distance = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      return { ...s, distance, distanceMeters: distance };
    })
    .filter(s => s.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance);

  res.json(results);
});

// 3b. Fermate nel viewport / bounding box visibile della mappa
app.get('/api/stops/bounds', (req, res) => {
  const minLat = parseFloat(req.query.minLat);
  const maxLat = parseFloat(req.query.maxLat);
  const minLon = parseFloat(req.query.minLon);
  const maxLon = parseFloat(req.query.maxLon);
  const limit = Math.min(parseInt(req.query.limit || '150', 10), 300);

  if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) {
    return res.status(400).json({ error: 'Coordinate bounding box mancanti o non valide' });
  }
  if (!db) return res.status(503).json({ error: 'Database non disponibile' });

  const rows = db.prepare(`
    SELECT stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon
    FROM stops
    WHERE stop_lat BETWEEN ? AND ?
      AND stop_lon BETWEEN ? AND ?
    LIMIT ?
  `).all(minLat, maxLat, minLon, maxLon, limit);

  res.json(rows);
});

// 4. Arrivi in tempo reale su una specifica palina ATAC
app.get('/api/arrivals/:stopId', (req, res) => {
  const stopId = String(req.params.stopId).trim();
  const nowSec = Math.floor(Date.now() / 1000);
  const arrivals = [];

  // Mappe veloci per veicoli e info trip statiche
  const vehicleByTrip = new Map();
  for (const v of rtCache.vehicles) {
    if (v.tripId) vehicleByTrip.set(v.tripId, v);
  }

  let tripStmt = null;
  if (db) {
    tripStmt = db.prepare(`
      SELECT t.trip_headsign, t.route_id, r.route_short_name, r.route_long_name, r.route_color
      FROM trips t
      LEFT JOIN routes r ON r.route_id = t.route_id
      WHERE t.trip_id = ?
    `);
  }

  for (const tu of rtCache.tripUpdates) {
    const tripId = tu.trip?.tripId || '';
    const routeId = tu.trip?.routeId || '';
    const vehicleId = tu.vehicle?.id || tu.vehicle?.label || vehicleByTrip.get(tripId)?.label || null;
    const liveVehicle = vehicleByTrip.get(tripId) || null;

    for (const stu of tu.stopTimeUpdate || []) {
      if (stu.stopId === stopId) {
        const rawTime = Number(stu.arrival?.time || stu.departure?.time || 0);
        if (rawTime >= nowSec - 90 && rawTime <= nowSec + 5400) {
          let headsign = '';
          let routeShortName = routeId;
          if (tripStmt && tripId) {
            const info = tripStmt.get(tripId);
            if (info) {
              headsign = info.trip_headsign || info.route_long_name || '';
              routeShortName = info.route_short_name || routeId;
            }
          }
          arrivals.push({
            routeId: routeShortName || routeId,
            tripId,
            headsign,
            arrivalEpoch: rawTime,
            minutes: Math.max(0, Math.round((rawTime - nowSec) / 60)),
            delaySeconds: stu.arrival?.delay || stu.departure?.delay || 0,
            vehicleId,
            vehicleLat: liveVehicle?.lat || null,
            vehicleLon: liveVehicle?.lon || null,
            occupancyStatus: liveVehicle?.occupancyStatus ?? null,
            realtime: true
          });
        }
      }
    }
  }

  arrivals.sort((a, b) => a.arrivalEpoch - b.arrivalEpoch);
  res.json({
    stopId,
    lastUpdated: rtCache.lastUpdated,
    count: arrivals.length,
    arrivals
  });
});

// 5. Posizioni GPS reali di tutti i veicoli ATAC
app.get('/api/vehicles', (req, res) => {
  const routeFilter = (req.query.routeId || '').trim().toUpperCase();
  const list = routeFilter
    ? rtCache.vehicles.filter(v => v.routeId.toUpperCase() === routeFilter)
    : rtCache.vehicles;
  res.json({
    lastUpdated: rtCache.lastUpdated,
    count: list.length,
    vehicles: list
  });
});

// 6. Elenco completo linee da GTFS Statico + conteggio bus attivi in tempo reale
app.get('/api/routes', (req, res) => {
  const activeCountByRoute = {};
  for (const v of rtCache.vehicles) {
    if (v.routeId) {
      activeCountByRoute[v.routeId] = (activeCountByRoute[v.routeId] || 0) + 1;
    }
  }

  if (!db) {
    const dynamicRoutes = Object.keys(activeCountByRoute).sort().map(rId => ({
      route_id: rId,
      route_short_name: rId,
      route_long_name: 'Linea ATAC / Roma Mobilita',
      activeVehicles: activeCountByRoute[rId]
    }));
    return res.json(dynamicRoutes);
  }

  const rows = db.prepare(`
    SELECT route_id, agency_id, route_short_name, route_long_name, route_type, route_color
    FROM routes
    ORDER BY route_short_name
  `).all();

  res.json(rows.map(r => ({
    ...r,
    activeVehicles: activeCountByRoute[r.route_id] || activeCountByRoute[r.route_short_name] || 0
  })));
});

// 7. Tracciato geometrico (shape) di una specifica linea (filtrabile per direzione)
app.get('/api/routes/:routeId/shape', (req, res) => {
  const routeParam = String(req.params.routeId).trim();
  const requestedDir = req.query.direction !== undefined ? req.query.direction : req.query.direction_id;
  if (!db) return res.status(503).json({ error: 'Database non disponibile' });

  // Trova i shape_id associati a questa linea
  let tripsQuery = `
    SELECT t.shape_id, t.direction_id, t.trip_headsign, count(1) as c
    FROM trips t
    WHERE (t.route_id = ? OR t.route_id = (SELECT route_id FROM routes WHERE route_short_name = ? LIMIT 1))
      AND t.shape_id IS NOT NULL AND t.shape_id != ''
  `;
  const params = [routeParam, routeParam];
  if (requestedDir !== undefined && requestedDir !== '') {
    tripsQuery += ` AND t.direction_id = ? `;
    params.push(Number(requestedDir));
  }
  tripsQuery += ` GROUP BY t.direction_id, t.shape_id ORDER BY c DESC LIMIT 6`;

  const trips = db.prepare(tripsQuery).all(...params);

  if (!trips.length) {
    return res.json({ routeId: routeParam, shapes: [] });
  }

  const stmt = db.prepare(`
    SELECT shape_pt_lat as lat, shape_pt_lon as lon, shape_pt_sequence as seq
    FROM shapes
    WHERE shape_id = ?
    ORDER BY shape_pt_sequence ASC
  `);

  const shapes = trips.map(t => ({
    shapeId: t.shape_id,
    directionId: t.direction_id,
    headsign: t.trip_headsign,
    coordinates: stmt.all(t.shape_id).map(p => [p.lat, p.lon])
  })).filter(s => s.coordinates.length > 0);

  res.json({ routeId: routeParam, shapes });
});

// 8. Sequenza ordinata delle fermate di una linea con nomi effettivi delle direzioni
app.get('/api/routes/:routeId/stops', (req, res) => {
  const routeParam = String(req.params.routeId).trim();
  if (!db) return res.status(503).json({ error: 'Database non disponibile' });

  const rRow = db.prepare(`
    SELECT route_id, route_short_name, route_long_name, route_type, route_color
    FROM routes
    WHERE route_id = ? OR route_short_name = ?
    LIMIT 1
  `).get(routeParam, routeParam);

  const actualRouteId = rRow ? rRow.route_id : routeParam;

  const rows = db.prepare(`
    SELECT rs.direction_id, rs.stop_sequence, s.stop_id, s.stop_code, s.stop_name, s.stop_lat, s.stop_lon
    FROM route_stops rs
    JOIN stops s ON s.stop_id = rs.stop_id
    WHERE rs.route_id = ?
    ORDER BY rs.direction_id ASC, rs.stop_sequence ASC
  `).all(actualRouteId);

  // Raggruppa per direzione
  const byDirection = {};
  for (const row of rows) {
    if (!byDirection[row.direction_id]) byDirection[row.direction_id] = [];
    byDirection[row.direction_id].push(row);
  }

  // Estrai i nomi ufficiali delle direzioni da trips (trip_headsign)
  const headsignRows = db.prepare(`
    SELECT direction_id, trip_headsign, count(1) as c
    FROM trips
    WHERE route_id = ? AND trip_headsign IS NOT NULL AND trip_headsign != ''
    GROUP BY direction_id, trip_headsign
    ORDER BY c DESC
  `).all(actualRouteId);

  const directionNames = {};
  for (const h of headsignRows) {
    if (directionNames[h.direction_id] === undefined) {
      directionNames[h.direction_id] = h.trip_headsign;
    }
  }

  // Fallback se trip_headsign non fosse presente: usa il nome dell'ultima fermata di quella direzione
  for (const dirId of Object.keys(byDirection)) {
    if (!directionNames[dirId] && byDirection[dirId]?.length > 0) {
      const lastStop = byDirection[dirId][byDirection[dirId].length - 1];
      directionNames[dirId] = lastStop.stop_name;
    }
  }

  res.json({
    route: rRow || { route_id: actualRouteId, route_short_name: actualRouteId },
    directions: byDirection,
    direction_names: directionNames
  });
});

// 9. Allerte di servizio ufficiali ATAC
app.get('/api/alerts', (req, res) => {
  res.json({
    lastUpdated: rtCache.lastUpdated,
    alerts: rtCache.alerts
  });
});

// 10. Geocoding per Indirizzo (OpenStreetMap Photon + Nominatim + fermate GTFS locali)
app.get('/api/geocode', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) return res.json([]);

  const results = [];
  const seen = new Set();

  // 1. Fermate e stazioni GTFS locali in SQLite
  if (db) {
    try {
      const stops = db.prepare(`
        SELECT stop_id, stop_code, stop_name, stop_desc, stop_lat, stop_lon
        FROM stops
        WHERE stop_code = ? OR stop_id = ? OR stop_name LIKE ?
        LIMIT 6
      `).all(query, query, `%${query}%`);

      for (const s of stops) {
        const isMetro = s.stop_name.includes('(MA') || s.stop_name.includes('(MB') || s.stop_name.includes('(MC');
        const isTrain = s.stop_name.includes('(FL') || s.stop_name.includes('(FS');
        const key = `${s.stop_lat.toFixed(4)},${s.stop_lon.toFixed(4)}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            id: `stop_${s.stop_id}`,
            name: s.stop_name,
            subtitle: isMetro ? `Metropolitana (Palina ${s.stop_code || s.stop_id})` : isTrain ? `Stazione Ferroviaria (${s.stop_code || s.stop_id})` : `Palina ATAC ${s.stop_code || s.stop_id}`,
            lat: s.stop_lat,
            lon: s.stop_lon,
            type: isMetro ? 'metro' : isTrain ? 'train' : 'stop'
          });
        }
      }
    } catch (e) {
      console.error('[Geocode DB error]:', e.message);
    }
  }

  // 2. OpenStreetMap Photon Geocoder (Fuzzy Address Search per vie, numeri civici, piazze)
  try {
    const pUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=41.9028&lon=12.4964&limit=8`;
    const osmRes = await fetch(pUrl, { headers: { 'User-Agent': 'RomaTransitExpress/2.0' } });
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      for (const f of osmData.features || []) {
        const [lon, lat] = f.geometry.coordinates;
        // Bounding box per Roma e area metropolitana
        if (lat >= 41.65 && lat <= 42.15 && lon >= 12.20 && lon <= 12.85) {
          const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            const p = f.properties;
            const title = p.name || p.street || query;
            const subtitleParts = [p.city || 'Roma', p.district, p.postcode].filter(Boolean);
            results.push({
              id: `osm_${p.osm_id || Math.random()}`,
              name: title,
              subtitle: subtitleParts.join(', '),
              lat,
              lon,
              type: 'address'
            });
          }
        }
      }
    }
  } catch (osmErr) {
    console.warn('[Photon Geocode warning]:', osmErr.message);
  }

  // 3. Fallback OpenStreetMap Nominatim se pochi risultati
  if (results.length < 2) {
    try {
      const nUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Roma')}&limit=4`;
      const nRes = await fetch(nUrl, { headers: { 'User-Agent': 'RomaTransitExpress/2.0 (contact@romamobilita.it)' } });
      if (nRes.ok) {
        const nData = await nRes.json();
        for (const item of nData) {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              id: `osm_${item.place_id}`,
              name: item.name || item.display_name.split(',')[0],
              subtitle: item.display_name.split(',').slice(1, 3).join(', ').trim(),
              lat,
              lon,
              type: 'address'
            });
          }
        }
      }
    } catch (nErr) {}
  }

  res.json(results);
});

// 11. Calcolo percorso multimodale (OpenTripPlanner 2 con fallback intelligente OSRM + GTFS SQLite)
app.get('/api/plan', async (req, res) => {
  const { fromLat, fromLon, toLat, toLon, date, time } = req.query;
  const fLat = parseFloat(fromLat);
  const fLon = parseFloat(fromLon);
  const tLat = parseFloat(toLat);
  const tLon = parseFloat(toLon);

  if (isNaN(fLat) || isNaN(fLon) || isNaN(tLat) || isNaN(tLon)) {
    return res.status(400).json({ error: 'Parametri fromLat, fromLon, toLat, toLon obbligatori e numerici' });
  }

  // 1. Tenta prima OpenTripPlanner 2 (se attivo via Docker)
  try {
    const query = new URLSearchParams({
      fromPlace: `${fLat},${fLon}`,
      toPlace: `${tLat},${tLon}`,
      mode: 'TRANSIT,WALK',
      maxWalkDistance: '1200',
      locale: 'it'
    });
    if (date) query.set('date', date);
    if (time) query.set('time', time);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const otpRes = await fetch(`${OTP_URL}?${query.toString()}`, { signal: controller.signal });
    clearTimeout(timer);
    if (otpRes.ok) {
      const data = await otpRes.json();
      return res.json(data);
    }
  } catch (err) {
    // Prosegui al motore multimodale locale
  }

  // 2. Motore multimodale locale: A piedi + Linee dirette + Collegamenti con 1 cambio (Zero Mock)
  try {
    const toRad = d => (d * Math.PI) / 180;
    const haversineDist = (lat1, lon1, lat2, lon2) => {
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    const directWalkDist = haversineDist(fLat, fLon, tLat, tLon);
    const directWalkMinutes = Math.max(1, Math.round(directWalkDist / 80)); // ~4.8 km/h

    // Cerca fermate entro 1000m dall'origine e 1000m dalla destinazione
    const originStops = db ? db.prepare(`
      SELECT stop_id, stop_code, stop_name, stop_lat, stop_lon
      FROM stops
      WHERE stop_lat BETWEEN ? AND ? AND stop_lon BETWEEN ? AND ?
    `).all(fLat - 0.011, fLat + 0.011, fLon - 0.011, fLon + 0.011)
      .map(s => ({ ...s, dist: haversineDist(fLat, fLon, s.stop_lat, s.stop_lon) }))
      .filter(s => s.dist <= 1000)
      .sort((a, b) => a.dist - b.dist) : [];

    const destStops = db ? db.prepare(`
      SELECT stop_id, stop_code, stop_name, stop_lat, stop_lon
      FROM stops
      WHERE stop_lat BETWEEN ? AND ? AND stop_lon BETWEEN ? AND ?
    `).all(tLat - 0.011, tLat + 0.011, tLon - 0.011, tLon + 0.011)
      .map(s => ({ ...s, dist: haversineDist(tLat, tLon, s.stop_lat, s.stop_lon) }))
      .filter(s => s.dist <= 1000)
      .sort((a, b) => a.dist - b.dist) : [];

    const itineraries = [];
    const seenSignatures = new Set();

    // Helper per estrarre la sequenza di coordinate delle fermate intermedie di una linea
    const getLegPoints = (routeId, directionId, startSeq, endSeq) => {
      try {
        const rows = db.prepare(`
          SELECT s.stop_lat, s.stop_lon
          FROM route_stops rs
          JOIN stops s ON s.stop_id = rs.stop_id
          WHERE rs.route_id = ? AND rs.direction_id = ? AND rs.stop_sequence BETWEEN ? AND ?
          ORDER BY rs.stop_sequence ASC
        `).all(routeId, directionId, Math.min(startSeq, endSeq), Math.max(startSeq, endSeq));
        return rows.map(r => [r.stop_lat, r.stop_lon]);
      } catch (e) {
        return [];
      }
    };

    if (originStops.length > 0 && destStops.length > 0) {
      const oMap = new Map(originStops.map(s => [s.stop_id, s]));
      const dMap = new Map(destStops.map(s => [s.stop_id, s]));

      const oIds = originStops.map(s => s.stop_id);
      const dIds = destStops.map(s => s.stop_id);

      // --- A. LINEE DIRETTE (0 cambi) ---
      const directLines = db.prepare(`
        SELECT r.route_id, r.route_short_name, r.route_long_name, r.route_type, r.route_color,
               rs1.direction_id, rs1.stop_id as from_stop_id, rs2.stop_id as to_stop_id,
               rs1.stop_sequence as from_seq, rs2.stop_sequence as to_seq,
               (rs2.stop_sequence - rs1.stop_sequence) as stops_count
        FROM route_stops rs1
        JOIN route_stops rs2 ON rs1.route_id = rs2.route_id AND rs1.direction_id = rs2.direction_id
        JOIN routes r ON r.route_id = rs1.route_id
        WHERE rs1.stop_id IN (${oIds.slice(0, 45).map(() => '?').join(',')})
          AND rs2.stop_id IN (${dIds.slice(0, 45).map(() => '?').join(',')})
          AND rs2.stop_sequence > rs1.stop_sequence
        LIMIT 10
      `).all(...oIds.slice(0, 45), ...dIds.slice(0, 45));

      for (const dL of directLines) {
        const oStop = oMap.get(dL.from_stop_id);
        const dStop = dMap.get(dL.to_stop_id);
        if (!oStop || !dStop) continue;

        const sig = `DIRECT_${dL.route_short_name}`;
        if (seenSignatures.has(sig)) continue;
        seenSignatures.add(sig);

        const walk1Min = Math.max(1, Math.round(oStop.dist / 80));
        const transitMin = Math.max(2, Math.round(dL.stops_count * (dL.route_type === 1 ? 1.8 : 2.2)));
        const walk2Min = Math.max(1, Math.round(dStop.dist / 80));
        const totalDurSec = (walk1Min + transitMin + walk2Min) * 60;

        const mode = dL.route_type === 1 ? 'SUBWAY' : dL.route_type === 0 ? 'TRAM' : 'BUS';
        const transitPts = getLegPoints(dL.route_id, dL.direction_id, dL.from_seq, dL.to_seq);

        itineraries.push({
          duration: totalDurSec,
          walkTime: (walk1Min + walk2Min) * 60,
          transitTime: transitMin * 60,
          walkDistance: oStop.dist + dStop.dist,
          transfers: 0,
          summary: `Diretto: Linea ${dL.route_short_name}`,
          legs: [
            {
              mode: 'WALK',
              duration: walk1Min * 60,
              distance: oStop.dist,
              from: { name: 'Partenza', lat: fLat, lon: fLon },
              to: { name: oStop.stop_name, stopCode: oStop.stop_code, lat: oStop.stop_lat, lon: oStop.stop_lon },
              points: [[fLat, fLon], [oStop.stop_lat, oStop.stop_lon]],
              instructions: `Cammina per ${oStop.dist}m (~${walk1Min} min) fino alla fermata ${oStop.stop_name} (${oStop.stop_code || oStop.stop_id})`
            },
            {
              mode,
              duration: transitMin * 60,
              distance: dL.stops_count * 450,
              route: dL.route_short_name,
              routeLongName: dL.route_long_name,
              routeColor: dL.route_color || (dL.route_type === 1 ? 'f37021' : '8e1823'),
              stopsCount: dL.stops_count,
              from: { name: oStop.stop_name, stopCode: oStop.stop_code, lat: oStop.stop_lat, lon: oStop.stop_lon },
              to: { name: dStop.stop_name, stopCode: dStop.stop_code, lat: dStop.stop_lat, lon: dStop.stop_lon },
              points: transitPts,
              instructions: `Prendi ${mode === 'SUBWAY' ? 'la Metro' : 'il Bus'} ${dL.route_short_name} per ${dL.stops_count} fermate fino a ${dStop.stop_name}`
            },
            {
              mode: 'WALK',
              duration: walk2Min * 60,
              distance: dStop.dist,
              from: { name: dStop.stop_name, stopCode: dStop.stop_code, lat: dStop.stop_lat, lon: dStop.stop_lon },
              to: { name: 'Destinazione', lat: tLat, lon: tLon },
              points: [[dStop.stop_lat, dStop.stop_lon], [tLat, tLon]],
              instructions: `Cammina per ${dStop.dist}m (~${walk2Min} min) fino a destinazione`
            }
          ]
        });
      }

      // --- B. COLLEGAMENTI CON 1 CAMBIO (1 Transfer) ---
      const oLines = db.prepare(`
        SELECT DISTINCT rs.route_id, r.route_short_name, r.route_long_name, r.route_type, r.route_color,
               rs.direction_id, rs.stop_id as o_stop_id, rs.stop_sequence as o_seq,
               s.stop_name as o_stop_name, s.stop_code as o_stop_code, s.stop_lat as o_lat, s.stop_lon as o_lon
        FROM route_stops rs
        JOIN routes r ON r.route_id = rs.route_id
        JOIN stops s ON s.stop_id = rs.stop_id
        WHERE rs.stop_id IN (${oIds.slice(0, 35).map(() => '?').join(',')})
      `).all(...oIds.slice(0, 35));

      const dLines = db.prepare(`
        SELECT DISTINCT rs.route_id, r.route_short_name, r.route_long_name, r.route_type, r.route_color,
               rs.direction_id, rs.stop_id as d_stop_id, rs.stop_sequence as d_seq,
               s.stop_name as d_stop_name, s.stop_code as d_stop_code, s.stop_lat as d_lat, s.stop_lon as d_lon
        FROM route_stops rs
        JOIN routes r ON r.route_id = rs.route_id
        JOIN stops s ON s.stop_id = rs.stop_id
        WHERE rs.stop_id IN (${dIds.slice(0, 35).map(() => '?').join(',')})
      `).all(...dIds.slice(0, 35));

      for (const oL of oLines) {
        for (const dL of dLines) {
          if (oL.route_id === dL.route_id) continue;
          const sig = `TRANSFER_${oL.route_short_name}_${dL.route_short_name}`;
          if (seenSignatures.has(sig)) continue;

          // Trova la fermata di scambio comune (o fermate vicine entro 200m)
          const transfer = db.prepare(`
            SELECT s1.stop_id as t1_id, s1.stop_name as t1_name, s1.stop_lat as t1_lat, s1.stop_lon as t1_lon, rs1.stop_sequence as seq1,
                   s2.stop_id as t2_id, s2.stop_name as t2_name, s2.stop_lat as t2_lat, s2.stop_lon as t2_lon, rs2.stop_sequence as seq2
            FROM route_stops rs1
            JOIN stops s1 ON s1.stop_id = rs1.stop_id
            JOIN route_stops rs2 ON rs2.route_id = ? AND rs2.direction_id = ? AND rs2.stop_sequence < ?
            JOIN stops s2 ON s2.stop_id = rs2.stop_id
            WHERE rs1.route_id = ? AND rs1.direction_id = ? AND rs1.stop_sequence > ?
              AND (
                rs1.stop_id = rs2.stop_id
                OR s1.stop_name = s2.stop_name
                OR (ABS(s1.stop_lat - s2.stop_lat) < 0.002 AND ABS(s1.stop_lon - s2.stop_lon) < 0.002)
              )
            LIMIT 1
          `).get(dL.route_id, dL.direction_id, dL.d_seq, oL.route_id, oL.direction_id, oL.o_seq);

          if (transfer) {
            const transDist = haversineDist(transfer.t1_lat, transfer.t1_lon, transfer.t2_lat, transfer.t2_lon);
            if (transDist > 220) continue;

            seenSignatures.add(sig);

            const oStop = oMap.get(oL.o_stop_id);
            const dStop = dMap.get(dL.d_stop_id);
            if (!oStop || !dStop) continue;

            const stops1 = transfer.seq1 - oL.o_seq;
            const stops2 = dL.d_seq - transfer.seq2;
            if (stops1 <= 0 || stops2 <= 0) continue;

            const walk1Min = Math.max(1, Math.round(oStop.dist / 80));
            const transit1Min = Math.max(3, Math.round(stops1 * (oL.route_type === 1 ? 1.8 : 2.2)));
            const transferWaitMin = 4;
            const transit2Min = Math.max(3, Math.round(stops2 * (dL.route_type === 1 ? 1.8 : 2.2)));
            const walk2Min = Math.max(1, Math.round(dStop.dist / 80));

            const totalDurSec = (walk1Min + transit1Min + transferWaitMin + transit2Min + walk2Min) * 60;

            const mode1 = oL.route_type === 1 ? 'SUBWAY' : oL.route_type === 0 ? 'TRAM' : 'BUS';
            const mode2 = dL.route_type === 1 ? 'SUBWAY' : dL.route_type === 0 ? 'TRAM' : 'BUS';

            const pts1 = getLegPoints(oL.route_id, oL.direction_id, oL.o_seq, transfer.seq1);
            const pts2 = getLegPoints(dL.route_id, dL.direction_id, transfer.seq2, dL.d_seq);

            itineraries.push({
              duration: totalDurSec,
              walkTime: (walk1Min + walk2Min) * 60,
              transitTime: (transit1Min + transit2Min) * 60,
              walkDistance: oStop.dist + dStop.dist + transDist,
              transfers: 1,
              summary: `1 Cambio: ${oL.route_short_name} → ${dL.route_short_name} (${transfer.t1_name})`,
              legs: [
                {
                  mode: 'WALK',
                  duration: walk1Min * 60,
                  distance: oStop.dist,
                  from: { name: 'Partenza', lat: fLat, lon: fLon },
                  to: { name: oStop.stop_name, stopCode: oStop.stop_code, lat: oStop.stop_lat, lon: oStop.stop_lon },
                  points: [[fLat, fLon], [oStop.stop_lat, oStop.stop_lon]],
                  instructions: `Cammina per ${oStop.dist}m (~${walk1Min} min) fino alla fermata ${oStop.stop_name} (${oStop.stop_code || oStop.stop_id})`
                },
                {
                  mode: mode1,
                  duration: transit1Min * 60,
                  distance: stops1 * 450,
                  route: oL.route_short_name,
                  routeLongName: oL.route_long_name,
                  routeColor: oL.route_color || (oL.route_type === 1 ? 'f37021' : '8e1823'),
                  stopsCount: stops1,
                  from: { name: oStop.stop_name, stopCode: oStop.stop_code, lat: oStop.stop_lat, lon: oStop.stop_lon },
                  to: { name: transfer.t1_name, stopCode: '', lat: transfer.t1_lat, lon: transfer.t1_lon },
                  points: pts1,
                  instructions: `Prendi ${mode1 === 'SUBWAY' ? 'la Metro' : 'la Linea'} ${oL.route_short_name} per ${stops1} fermate fino a ${transfer.t1_name}`
                },
                {
                  mode: 'TRANSFER',
                  duration: transferWaitMin * 60,
                  distance: transDist,
                  from: { name: transfer.t1_name, lat: transfer.t1_lat, lon: transfer.t1_lon },
                  to: { name: transfer.t2_name, lat: transfer.t2_lat, lon: transfer.t2_lon },
                  points: [[transfer.t1_lat, transfer.t1_lon], [transfer.t2_lat, transfer.t2_lon]],
                  instructions: `CAMBIO alla fermata ${transfer.t1_name}: ${transDist > 25 ? `spostati di ${transDist}m e ` : ''}attendi la linea ${dL.route_short_name}`
                },
                {
                  mode: mode2,
                  duration: transit2Min * 60,
                  distance: stops2 * 450,
                  route: dL.route_short_name,
                  routeLongName: dL.route_long_name,
                  routeColor: dL.route_color || (dL.route_type === 1 ? '0072bc' : '8e1823'),
                  stopsCount: stops2,
                  from: { name: transfer.t2_name, stopCode: '', lat: transfer.t2_lat, lon: transfer.t2_lon },
                  to: { name: dStop.stop_name, stopCode: dStop.stop_code, lat: dStop.stop_lat, lon: dStop.stop_lon },
                  points: pts2,
                  instructions: `Prendi ${mode2 === 'SUBWAY' ? 'la Metro' : 'la Linea'} ${dL.route_short_name} per ${stops2} fermate fino a ${dStop.stop_name}`
                },
                {
                  mode: 'WALK',
                  duration: walk2Min * 60,
                  distance: dStop.dist,
                  from: { name: dStop.stop_name, stopCode: dStop.stop_code, lat: dStop.stop_lat, lon: dStop.stop_lon },
                  to: { name: 'Destinazione', lat: tLat, lon: tLon },
                  points: [[dStop.stop_lat, dStop.stop_lon], [tLat, tLon]],
                  instructions: `Cammina per ${dStop.dist}m (~${walk2Min} min) fino a destinazione`
                }
              ]
            });

            if (itineraries.length >= 8) break;
          }
        }
        if (itineraries.length >= 8) break;
      }
    }

    // Aggiungi sempre anche il percorso a piedi diretto come confronto
    itineraries.push({
      duration: directWalkMinutes * 60,
      walkTime: directWalkMinutes * 60,
      transitTime: 0,
      walkDistance: directWalkDist,
      transfers: 0,
      summary: 'A piedi (diretto)',
      legs: [
        {
          mode: 'WALK',
          duration: directWalkMinutes * 60,
          distance: directWalkDist,
          from: { name: 'Partenza', lat: fLat, lon: fLon },
          to: { name: 'Destinazione', lat: tLat, lon: tLon },
          points: [[fLat, fLon], [tLat, tLon]],
          instructions: `Percorso a piedi diretto (~${(directWalkDist / 1000).toFixed(1)} km, ${directWalkMinutes} min)`
        }
      ]
    });

    // Ordina: prima le opzioni coi mezzi (più veloci per prime), infine a piedi
    itineraries.sort((a, b) => {
      if (a.transitTime > 0 && b.transitTime === 0) return -1;
      if (a.transitTime === 0 && b.transitTime > 0) return 1;
      return a.duration - b.duration;
    });

    res.json({
      plan: {
        date: Date.now(),
        from: { lat: fLat, lon: fLon },
        to: { lat: tLat, lon: tLon },
        itineraries
      },
      source: 'local-multimodal-routing-engine'
    });
  } catch (fallbackErr) {
    console.error('Plan calculation error:', fallbackErr);
    res.status(500).json({ error: 'Errore nel calcolo del percorso', details: fallbackErr.message });
  }
});

// 11. Servizio frontend per produzione (se compilato in frontend/dist)
const distPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` ROMA TRANSIT EXPRESS BACKEND ATTIVO SU PORTA ${PORT}`);
  console.log(` Feed GTFS-RT ufficiali Roma Mobilita collegati.`);
  console.log(`====================================================`);
});
