# SYSTEM PROMPT PER ANTIGRAVITY: ROMA TRANSIT EXPRESS (100% REAL ATAC DATA)

Agisci come un Senior Full-Stack Engineer. Completa, compila e metti in produzione l'applicazione **Roma Transit Express** (Material Design 3 Expressive) collegandola al backend Node.js/SQLite/GTFS-RT e a OpenTripPlanner 2 inclusi in questo workspace.

## REGOLE TASSATIVE (ZERO MOCK POLICY)
1. **MAI** generare dati simulati, `Math.random()`, o orari inventati.
2. Tutte le oltre 8.300 paline ATAC (`stop_code` / `stop_id`), le oltre 350 linee (`routes.txt`), i percorsi geometrici (`shapes.txt`) e gli orari programmati (`stop_times.txt`) devono provenire dal dataset ufficiale **Roma Mobilità GTFS Statico** (`https://romamobilita.it/sites/default/files/rome_static_gtfs.zip`) importato automaticamente nel database SQLite locale (`roma_gtfs.db`) tramite lo script `scripts/sync-gtfs.js`.
3. Tutti gli arrivi in tempo reale, i ritardi, la posizione GPS dei bus, le matricole ATAC e le allerte devono provenire dai 3 feed **Protocol Buffers GTFS-RT ufficiali**:
   - TripUpdates: `https://romamobilita.it/sites/default/files/rome_rtgtfs_trip_updates_feed.pb`
   - VehiclePositions: `https://romamobilita.it/sites/default/files/rome_rtgtfs_vehicle_positions_feed.pb`
   - ServiceAlerts: `https://romamobilita.it/sites/default/files/rome_rtgtfs_service_alerts_feed.pb`
4. Tutte le mappe devono usare esclusivamente **Leaflet 1.9.4 + OpenStreetMap (`tile.openstreetmap.org`)** senza alcuna chiave API proprietaria.
5. Il calcolo del percorso multimodale (Piedi + Bus ATAC + Metro A/B/B1/C + Ferrovie Urbane FL + Tram) deve interrogare l'istanza **OpenTripPlanner 2 (OTP2)** configurata nel `docker-compose.yml` (con fallback a OSRM + grafo GTFS SQLite se il container OTP2 è in fase di build iniziale).

## TASK DI ESECUZIONE PER ANTIGRAVITY
1. Esegui `npm install` per installare le dipendenze del backend (`express`, `cors`, `gtfs-realtime-bindings`, `better-sqlite3`, `adm-zip`, `node-fetch`).
2. Esegui `npm run sync-gtfs` per scaricare `rome_static_gtfs.zip` da Roma Mobilità e popolare il database SQLite `roma_gtfs.db` con tutte le fermate, linee, corse e geometrie di Roma.
3. Avvia il backend con `npm start` (porta `3001`) e verifica gli endpoint:
   - `GET /api/stops/search?q=70046`
   - `GET /api/stops/nearby?lat=41.9010&lon=12.5002&radius=600`
   - `GET /api/arrivals/:stopId`
   - `GET /api/vehicles`
   - `GET /api/routes`
   - `GET /api/plan?fromLat=...&fromLon=...&toLat=...&toLon=...`
4. Collega il frontend React (`frontend/src/App.jsx`) a `http://localhost:3001/api` come sorgente primaria.
