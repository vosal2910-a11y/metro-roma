# Roma Transit Express — Kit Completo per Antigravity

Applicazione Web completa basata al 100% su **dati reali ATAC e Roma Servizi per la Mobilità** (Zero Mock Policy), con interfaccia **Material Design 3 Expressive**, mappa interattiva **Leaflet 1.9.4 + OpenStreetMap** e sincronizzazione in tempo reale tramite **Protocol Buffers GTFS-RT**.

---

## ⚡ Avvio Rapido in 1 Click

Per avviare l'intera applicazione (backend + database + frontend compilato) e aprire automaticamente il browser su `http://localhost:3001`:

### Su Windows (Doppio click o da terminale):
- Esegui **`avvia.bat`** (oppure da PowerShell: `.\avvia.ps1`)

### Su Linux / macOS / WSL:
```bash
chmod +x start.sh
./start.sh
```

Lo script provvederà in autonomia a:
1. Verificare o installare le dipendenze di backend e frontend.
2. Scaricare e sincronizzare il database GTFS ufficiale di Roma (`data/roma_gtfs.db`).
3. Compilare il frontend React MD3 se necessario.
4. Avviare il server Express su `http://localhost:3001` e aprire automaticamente la Web App nel browser predefinito.

---

## 🌟 Funzionalità della Web App

1. **Arrivi Palina Live (GTFS-RT TripUpdates)**:
   - Ricerca istantanea con autocompletamento per codice palina (es. `70046`, `79644`, `05000`) o via.
   - Orari in tempo reale, ritardi/anticipi calcolati al secondo, matricola del bus (es. `#0101`), stato di affollamento e tasto per tracciare il bus sulla mappa.
2. **Radar Flotta Live ATAC (GTFS-RT VehiclePositions)**:
   - Tracciamento in tempo reale di oltre 1.100+ bus, tram e metro in circolazione a Roma.
   - Filtro per linea (es. 64, 451, H, Tram 3, Metro A), visualizzazione velocità effettiva in km/h, direzione bussola e fermata attuale.
3. **Linee & Percorsi Geometrici (GTFS Static Shapes & Stops)**:
   - Catalogo delle oltre 430 linee della rete di Roma (Bus, Metro A/B/C, Tram, Notturni n*).
   - Tracciamento geometrico esatto (`shapes.txt`) sulla mappa Leaflet ed elenco sequenziale di tutte le fermate per ciascuna direzione.
4. **Fermate Vicine (Geolocalizzazione GPS)**:
   - Rilevamento della posizione GPS dell'utente con calcolo della distanza metrica (Haversine) e del tempo di percorrenza a piedi.
5. **Calcolo Percorso Multimodale (Trip Planner)**:
   - Integrazione con OpenTripPlanner 2 e fallback locale intelligente (OSRM walking + grafo GTFS in SQLite).
   - Suddivisione dettagliata delle tappe a piedi e a bordo dei mezzi con tracciamento visivo del percorso sulla mappa.
6. **Allerte di Servizio Ufficiali (GTFS-RT ServiceAlerts)**:
   - Notifiche in tempo reale su deviazioni, scioperi, cantieri e modifiche di percorso diramate da ATAC.

---

## 📁 Struttura del Progetto

```
roma-transit-antigravity-kit/
├── avvia.bat               # Script di avvio rapido in 1 click per Windows (Batch)
├── avvia.ps1               # Script di avvio rapido PowerShell
├── start.sh                # Script di avvio rapido per Bash/Linux/macOS
├── server.js               # Backend Node.js / Express GTFS & GTFS-RT (Porta 3001)
├── package.json            # Dipendenze backend
├── scripts/
│   └── sync-gtfs.js        # Sincronizzazione automatica GTFS statico Roma Mobilita -> SQLite
├── data/
│   ├── rome_static_gtfs.zip # Archivio GTFS ufficiale scaricato
│   └── roma_gtfs.db        # Database SQLite (stops, routes, trips, shapes, route_stops)
├── frontend/               # Web App React + Vite + Leaflet (Material Design 3)
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── dist/               # Build pronta per la produzione servita direttamente da Express
│   └── src/
│       ├── main.jsx
│       ├── App.jsx         # Layout principale, navigazione e stato reattivo
│       ├── index.css       # Design System Material 3 Expressive & Leaflet styling
│       └── components/
│           ├── Map.jsx             # Mappa Leaflet 1.9.4 + OpenStreetMap (No API key)
│           ├── ArrivalsBoard.jsx   # Tabellone arrivi palina in tempo reale
│           ├── VehiclesRadar.jsx   # Radar GPS flotta ATAC
│           ├── RoutesExplorer.jsx  # Esploratore linee, percorsi e fermate
│           ├── NearbyStops.jsx     # Ricerca paline vicine con GPS
│           ├── TripPlanner.jsx     # Calcolo percorso multimodale
│           └── AlertsFeed.jsx      # Allerte ufficiali di rete ATAC
├── docker-compose.yml      # Configurazione per OpenTripPlanner 2 & backend containerizzato
└── Dockerfile              # Dockerfile per il backend
```

---

## 🔌 Endpoint API Disponibili (`http://localhost:3001/api`)

- `GET /api/status`: Diagnostica feed GTFS-RT e conteggio veicoli live.
- `GET /api/stops/search?q=70046`: Ricerca paline per codice o nome.
- `GET /api/stops/nearby?lat=41.9010&lon=12.5002&radius=600`: Fermate vicine entro raggio in metri.
- `GET /api/arrivals/:stopId`: Arrivi in tempo reale alla fermata con ritardi e matricole.
- `GET /api/vehicles?routeId=64`: Posizioni GPS dei veicoli in movimento (con filtro linea opzionale).
- `GET /api/routes`: Tutte le linee con conteggio bus attivi.
- `GET /api/routes/:routeId/shape`: Tracciato geometrico polyline della linea per Leaflet.
- `GET /api/routes/:routeId/stops`: Elenco ordinato delle fermate della linea per direzione.
- `GET /api/alerts`: Avvisi di servizio ufficiali ATAC.
- `GET /api/plan?fromLat=...&fromLon=...&toLat=...&toLon=...`: Calcolo percorso multimodale.
