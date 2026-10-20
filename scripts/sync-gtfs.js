/**
 * SCRIPT DI SINCRONIZZAZIONE AUTOMATICA GTFS STATICO ROMA MOBILITA
 * Scarica https://romamobilita.it/sites/default/files/rome_static_gtfs.zip
 * ed estrae stops.txt, routes.txt, trips.txt nel database SQLite data/roma_gtfs.db
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const stream = require('stream');
const AdmZip = require('adm-zip');
const Database = require('better-sqlite3');
const { parse } = require('csv-parse/sync');

const GTFS_ZIP_URL = 'https://romamobilita.it/sites/default/files/rome_static_gtfs.zip';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ZIP_PATH = path.join(DATA_DIR, 'rome_static_gtfs.zip');
const DB_PATH = path.join(DATA_DIR, 'roma_gtfs.db');

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('[1/4] Scaricamento rome_static_gtfs.zip da Roma Mobilita...');
  const response = await fetch(GTFS_ZIP_URL, {
    headers: { 'User-Agent': 'RomaTransitExpress-GTFSSync/2.0' }
  });
  if (!response.ok) {
    throw new Error(`Download fallito: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(ZIP_PATH, buffer);
  console.log(`[2/4] Archivio salvato (${(buffer.length / 1024 / 1024).toFixed(2)} MB). Estrazione CSV...`);

  const zip = new AdmZip(ZIP_PATH);
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    DROP TABLE IF EXISTS stops;
    DROP TABLE IF EXISTS routes;
    DROP TABLE IF EXISTS trips;
    DROP TABLE IF EXISTS shapes;
    DROP TABLE IF EXISTS route_stops;

    CREATE TABLE stops (
      stop_id TEXT PRIMARY KEY,
      stop_code TEXT,
      stop_name TEXT,
      stop_desc TEXT,
      stop_lat REAL,
      stop_lon REAL
    );
    CREATE INDEX idx_stops_code ON stops(stop_code);
    CREATE INDEX idx_stops_name ON stops(stop_name);
    CREATE INDEX idx_stops_coords ON stops(stop_lat, stop_lon);

    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY,
      agency_id TEXT,
      route_short_name TEXT,
      route_long_name TEXT,
      route_type INTEGER,
      route_color TEXT
    );
    CREATE INDEX idx_routes_short ON routes(route_short_name);

    CREATE TABLE trips (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      service_id TEXT,
      trip_headsign TEXT,
      direction_id INTEGER,
      shape_id TEXT
    );
    CREATE INDEX idx_trips_route ON trips(route_id);

    CREATE TABLE shapes (
      shape_id TEXT,
      shape_pt_lat REAL,
      shape_pt_lon REAL,
      shape_pt_sequence INTEGER,
      PRIMARY KEY (shape_id, shape_pt_sequence)
    );
    CREATE INDEX idx_shapes_id ON shapes(shape_id);

    CREATE TABLE route_stops (
      route_id TEXT,
      direction_id INTEGER,
      stop_sequence INTEGER,
      stop_id TEXT,
      PRIMARY KEY (route_id, direction_id, stop_sequence)
    );
    CREATE INDEX idx_route_stops ON route_stops(route_id, direction_id);
  `);

  function importCsv(entryName, insertSql, mapFn) {
    const entry = zip.getEntry(entryName);
    if (!entry) {
      console.warn(`File ${entryName} non presente nello zip.`);
      return 0;
    }
    const content = entry.getData().toString('utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
    const stmt = db.prepare(insertSql);
    const tx = db.transaction((rows) => {
      for (const r of rows) stmt.run(mapFn(r));
    });
    tx(records);
    return records.length;
  }

  console.log('[3/4] Popolamento tabelle SQLite...');
  const stopsCount = importCsv(
    'stops.txt',
    'INSERT OR REPLACE INTO stops VALUES (?, ?, ?, ?, ?, ?)',
    r => [
      r.stop_id,
      r.stop_code || r.stop_id,
      r.stop_name || '',
      r.stop_desc || '',
      parseFloat(r.stop_lat || '0'),
      parseFloat(r.stop_lon || '0')
    ]
  );

  const routesCount = importCsv(
    'routes.txt',
    'INSERT OR REPLACE INTO routes VALUES (?, ?, ?, ?, ?, ?)',
    r => [
      r.route_id,
      r.agency_id || 'ATAC',
      r.route_short_name || r.route_id,
      r.route_long_name || '',
      parseInt(r.route_type || '3', 10),
      r.route_color || ''
    ]
  );

  const tripsCount = importCsv(
    'trips.txt',
    'INSERT OR REPLACE INTO trips VALUES (?, ?, ?, ?, ?, ?)',
    r => [
      r.trip_id,
      r.route_id,
      r.service_id || '',
      r.trip_headsign || '',
      parseInt(r.direction_id || '0', 10),
      r.shape_id || ''
    ]
  );

  console.log('[4/5] Popolamento tracciati geometrici (shapes)...');
  const shapesCount = importCsv(
    'shapes.txt',
    'INSERT OR REPLACE INTO shapes VALUES (?, ?, ?, ?)',
    r => [
      r.shape_id,
      parseFloat(r.shape_pt_lat || '0'),
      parseFloat(r.shape_pt_lon || '0'),
      parseInt(r.shape_pt_sequence || '0', 10)
    ]
  );

  console.log('[5/5] Estrazione sequenze fermate per linea (route_stops)...');
  const canonicalTrips = db.prepare('SELECT route_id, direction_id, trip_id FROM trips GROUP BY route_id, direction_id').all();
  const tripMap = new Map();
  for (const t of canonicalTrips) {
    tripMap.set(t.trip_id, { route_id: t.route_id, direction_id: t.direction_id });
  }

  const stopTimesEntry = zip.getEntry('stop_times.txt');
  let routeStopsCount = 0;
  if (stopTimesEntry) {
    const s = stream.Readable.from(stopTimesEntry.getData());
    const rl = readline.createInterface({ input: s, crlfDelay: Infinity });
    const rsStmt = db.prepare('INSERT OR REPLACE INTO route_stops VALUES (?, ?, ?, ?)');
    const rsRecords = [];
    let isHeader = true;

    for await (const line of rl) {
      if (isHeader) { isHeader = false; continue; }
      const parts = line.split(',');
      const info = tripMap.get(parts[0]);
      if (info) {
        rsRecords.push([info.route_id, info.direction_id, parseInt(parts[4], 10), parts[3]]);
      }
    }
    const tx = db.transaction((rows) => {
      for (const r of rows) rsStmt.run(...r);
    });
    tx(rsRecords);
    routeStopsCount = rsRecords.length;
  }

  db.close();
  console.log(`Completato con successo: ${stopsCount} fermate, ${routesCount} linee, ${tripsCount} corse, ${shapesCount} punti geometrici, ${routeStopsCount} fermate di linea.`);
}

main().catch(err => {
  console.error('Errore durante la sincronizzazione GTFS:', err);
  process.exit(1);
});
