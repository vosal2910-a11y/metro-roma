# 🚇 Roma Transit Express — Metro & Bus Roma Live

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vibe Coded](https://img.shields.io/badge/Development-Vibe%20Coded-ff69b4.svg)](https://en.wikipedia.org/wiki/Vibe_coding)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933.svg)](https://nodejs.org/)
[![Leaflet](https://img.shields.io/badge/Map-Leaflet%201.9.4%20%2B%20OSM-199900.svg)](https://leafletjs.com/)
[![Render](https://img.shields.io/badge/Deploy-onrender.com-46E3B7.svg)](https://render.com/)
[![Netlify Ready](https://img.shields.io/badge/Deploy-Netlify%20Ready-00C7B7.svg)](https://www.netlify.com/)

> **Progetto Open Source con Licenza MIT**  
> Questo progetto è rilasciato sotto licenza libera e permissiva **MIT**.  
> **Vibe Coded**: interamente concepito e sviluppato in modalità *Vibe Coding* con pair-programming AI avanzato, focalizzato su un'architettura 100% reale e zero mock.

---

## 💻 Linguaggi e Tecnologie Utilizzati

- **JavaScript (ES6+ / Modern JS)**: Architettura full-stack sia per il frontend client React sia per il backend server Node.js.
- **React 18 & Vite**: Interfaccia utente reattiva ultra-veloce, component-driven con hot module replacement (HMR).
- **CSS3 & Material Design 3 Expressive**: Design system moderno ispirato a Material You (Google MD3), supporto nativo per Dark / Light mode, card responsive, chip animate e palette colori ufficiali del trasporto romano (Metro A arancione, Metro B blu, Metro C verde, Tram verde smeraldo, Bus rosso ATAC).
- **HTML5**: Markup semantico con PWA viewport e supporto accessibilità.
- **SQL / SQLite (`better-sqlite3`)**: Database relazionale locale ad alte prestazioni contenente:
  - Oltre **8.300 fermate/paline** ATAC (`stops`)
  - Oltre **430 linee** urbane, metro e tram (`routes`)
  - Oltre **169.000 corse** (`trips`)
  - Oltre **533.000 punti geometrici** per i tracciati stradali esatti (`shapes`)
  - Oltre **21.000 sequenze fermate** per linea e direzione (`route_stops`)
- **Protocol Buffers (Google Protobuf / `gtfs-realtime-bindings`)**: Decodifica binaria in tempo reale ad alta efficienza dei feed ufficiali di Roma Mobilità (`TripUpdates`, `VehiclePositions`, `ServiceAlerts`).
- **OpenStreetMap & Leaflet 1.9.4**: Cartografia open source e visualizzazione interattiva senza alcuna chiave API proprietaria.
- **PowerShell / Windows Batch / Bash**: Script di avvio automatico in 1 click cross-platform (`avvia.bat`, `avvia.ps1`, `start.sh`).

---

## ✨ Funzionalità Principali

1. 🚏 **Arrivi Palina Live (GTFS-RT TripUpdates)**:
   - Ricerca immediata per codice palina (es. `70046`, `79644`, `05000`) o nome via.
   - Countdown minuti al passaggio calcolato al secondo.
   - Badge stato ritardo/anticipo in tempo reale rispetto all'orario programmato.
   - Matricola vettura ATAC (es. `#0101`), stato di affollamento (posti liberi/in piedi) e tracciamento GPS istantaneo sulla mappa.

2. 📡 **Radar Flotta Live (GTFS-RT VehiclePositions)**:
   - Mappa live con oltre 1.100+ bus, tram e metro in circolazione a Roma.
   - Filtro per linea (es. 64, 451, H, Tram 3, Metro A/B).
   - Velocità effettiva in km/h, direzione bussola (bearing) e fermata attuale.

3. 🗺️ **Linee & Tracciati Geometrici (GTFS Static Shapes)**:
   - Catalogo completo delle linee ATAC.
   - Disegno esatto della linea sulla mappa Leaflet con tutti i punti geometrici e fermate intermedie cliccabili.

4. 📍 **Fermate Vicine (Geolocalizzazione GPS)**:
   - Rilevamento della posizione dell'utente con calcolo della distanza metrica (Haversine) e del tempo di percorrenza a piedi.

5. ⚠️ **Stato Rete & Allerte ATAC (GTFS-RT ServiceAlerts)**:
   - Avvisi ufficiali su scioperi, deviazioni di percorso, cantieri e modifiche di servizio in tempo reale.

---

## ⚡ Avvio Rapido Locale (1 Click)

### Windows
Fai doppio click su [**`avvia.bat`**](file:///c:/Users/Vosal/Documents/roma-transit-antigravity-kit/avvia.bat) (oppure esegui `.\avvia.ps1` da PowerShell).  
Lo script provvede automaticamente a verificare le dipendenze, assicurarsi che il database GTFS sia sincronizzato, compilare il frontend e aprire il browser su **`http://localhost:3001`**.

### Linux / macOS / WSL
```bash
chmod +x start.sh
./start.sh
```

---

## 🚀 Deploy su Netlify

Il progetto è pre-configurato per il deploy su **Netlify** con impostazioni pronte in [`netlify.toml`](./netlify.toml) e [`frontend/public/_redirects`](./frontend/public/_redirects).

### Passaggi per il Deploy:
1. Effettua il push della repository su GitHub: [https://github.com/vosal2910-a11y/metro-roma](https://github.com/vosal2910-a11y/metro-roma).
2. Accedi alla tua dashboard su [Netlify](https://app.netlify.com/) e seleziona **"Add new site" -> "Import an existing project"**.
3. Seleziona il provider **GitHub** e scegli la repository `vosal2910-a11y/metro-roma`.
4. Netlify rileverà automaticamente il file `netlify.toml`:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. **Configurazione Backend (Variabili d'ambiente Netlify)**:
   - Se ospiti il backend Node.js (con SQLite e feed Protocol Buffers) su un servizio cloud come Render, Railway, Fly.io o VPS, aggiungi in **Site Settings -> Environment variables**:
     ```
     VITE_API_BASE=https://tuo-backend.onrender.com
     ```
   - In questo modo il frontend su Netlify effettuerà le chiamate API direttamente al tuo backend live, mentre in locale continua a funzionare su `http://localhost:3001`.

---

## ☁️ Deploy su Render (onrender.com)

Il progetto è pronto al 100% per il deploy su **Render** come Web Service Full-Stack (servendo sia le API che il frontend compilato), grazie alla specifica Infrastructure-as-Code [`render.yaml`](./render.yaml).

### Opzione A: Deploy automatico con Blueprint (Consigliato)
1. Vai sulla tua [Render Dashboard](https://dashboard.render.com/) e clicca su **New + -> Blueprint**.
2. Connetti la repository GitHub: `https://github.com/vosal2910-a11y/metro-roma`.
3. Render leggerà automaticamente il file `render.yaml`:
   - Configura la regione `frankfurt` (Francoforte, ottimale per Roma con minima latenza).
   - Esegue il build command: `npm run render-build` (installa i pacchetti, compila il frontend React e genera il database SQLite GTFS).
   - Avvia il server Node.js: `npm start`.
   - Imposta l'health check automatico su `/api/status`.
4. Clicca su **Apply** per mettere online la Web App con URL pubblico (es. `https://metro-roma.onrender.com`).

### Opzione B: Creazione manuale Web Service su Render
- **Environment**: Node
- **Region**: Frankfurt (EU Central)
- **Branch**: `main`
- **Build Command**: `npm run render-build`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/status`
- **Environment Variables**:
  - `NODE_VERSION`: `20.18.0`
  - `PORT`: `10000`

---

## 📄 Licenza

Rilasciato sotto licenza [MIT](./LICENSE).
