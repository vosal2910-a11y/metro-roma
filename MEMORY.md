# MEMORY: Roma Transit Express (by Fox)

File di memoria operativo e riferimento architetturale per prevenire errori e garantire la coerenza tra la versione Web e l'app nativa Android.

---

## 1. Linee Guida e Regole Chiave

1. **Zero Mock Policy**: Tutti i dati (fermate, linee, percorsi geometrici, arrivi in tempo reale, avvisi di servizio) provengono al 100% da ATAC / Roma Mobilità (GTFS Statico SQLite `data/roma_gtfs.db` + GTFS-Realtime).
2. **Branding "by Fox"**:
   - Titolo Web App: "Roma Transit Express by Fox"
   - Titolo Android App: "Roma Transit by Fox"
   - Icona Android: icona vettoriale adattiva personalizzata con gradiente Porpora Imperiale Romano (#8E1823) ed emblema geometrico della Volpe (Fox Transit).
3. **Mappa OpenStreetMap (No Google Maps API keys)**:
   - Web App: Leaflet 1.9.4 + OpenStreetMap tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
   - Android App: Componente Mappa OpenStreetMap integrato (WebView accelerato con Leaflet + ponte JavascriptInterface per interazione bidirezionale nativa con Jetpack Compose).

---

## 2. Comportamento Mappa per Sezione (Web & Android)

| Sezione | Contenuto Mappa | Comportamento Interattivo |
| :--- | :--- | :--- |
| **Palina / Arrivi (Schermata Principale)** | **Segnalini delle Fermate (`stops`)**, NON degli autobus. | Cliccando su qualsiasi fermata, si apre la scheda con i bus in arrivo in tempo reale. |
| **Radar GPS** | **Segnalini dei Veicoli (`vehicles`)** in tempo reale con direzione e velocità. | Cliccando su un veicolo, si filtra per linea o si visualizzano i dettagli del bus. |
| **Vicine (`Nearby`)** | **Posizione GPS dell'utente + Cerchio del Raggio + Tutte le Fermate nel raggio**. | Al rilevamento della posizione o al cambio raggio (300m, 500m, 800m, 1200m), la mappa esegue auto-zoom / fitBounds sulle fermate del raggio. Fermate cliccabili per aprire gli arrivi. |
| **Linee (`Routes`)** | **SOLO il tracciato e le fermate della direzione selezionata** (Andata o Ritorno). | I pulsanti direzione mostrano il **nome effettivo della direzione** (da `trip_headsign` o capolinea). Nessuna sovrapposizione tra le due direzioni sulla mappa. |

---

## 3. Endpoints Backend (`server.js`)

- `GET /api/status`: Conteggio veicoli attivi, allerte, orario ultimo aggiornamento.
- `GET /api/stops/search?q={query}`: Cerca fermate per codice palina (es. 70046) o nome.
- `GET /api/stops/nearby?lat={lat}&lon={lon}&radius={radius}`: Fermate entro un raggio (metri).
- `GET /api/arrivals/:stopId`: Previsioni e arrivi in tempo reale per la palina specificata.
- `GET /api/vehicles`: Posizione GPS di tutti i veicoli della rete in tempo reale.
- `GET /api/routes`: Elenco completo di tutte le linee con conteggio bus in servizio.
- `GET /api/routes/:routeId/stops`: Fermate raggruppate per direzione con `direction_names: { "0": headsign0, "1": headsign1 }`.
- `GET /api/routes/:routeId/shape?direction_id={0|1}`: Tracciato geometrico (polyline) filtrabile per direzione.
- `GET /api/alerts`: Avvisi e allerte di servizio ATAC in corso.

---

## 4. Cronologia Aggiornamenti

- **Deploy**: Preparato per Netlify (frontend statico con proxy) e Render (`render.yaml`, `Dockerfile`).
- **Responsive Mobile**: Material Expressive bottom sheet con 3 stati (`collapsed`, `half`, `expanded`), gesture di trascinamento e supporto tasto indietro (History API / BackHandler).
- **Nuove Funzionalità (Attuale)**:
  - Fermate cliccabili sulla mappa della schermata principale al posto dei bus.
  - Mappa con zoom automatico al raggio scelto nella schermata "Vicine".
  - Nomi reali delle direzioni e tracciato filtrato per singola direzione nella schermata "Linee".
