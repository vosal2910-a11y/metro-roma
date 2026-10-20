import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { Locate, Layers, Map as MapIcon, Menu } from 'lucide-react';
import { apiUrl } from '../api.js';

export default function Map({
  activeTab = 'ARRIVALS',
  selectedStop,
  selectedRouteShape,
  selectedRouteStops,
  activeRouteDirection = 0,
  nearbyStops = [],
  nearbyRadius = 650,
  vehicles = [],
  filteredRouteId = null,
  userLocation,
  onSelectStop,
  onSelectVehicle,
  onMapClick,
  onRequestLocation,
  onToggleSheet,
  mobileSheetState,
  onOpenToastMenu,
  isLocating = false
}) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const fetchTimeoutRef = useRef(null);
  const layersRef = useRef({
    user: null,
    userAccuracy: null,
    nearbyCircle: null,
    nearbyStops: null,
    mainStops: null,
    stop: null,
    routeShape: null,
    routeStops: null,
    vehicles: null
  });

  // Helper to safely clear a layer
  const clearLayer = (layerKey) => {
    const map = leafletMap.current;
    if (map && layersRef.current[layerKey]) {
      map.removeLayer(layersRef.current[layerKey]);
      layersRef.current[layerKey] = null;
    }
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Centered on Rome Centro / Termini
    const map = L.map(mapRef.current, {
      center: [41.9028, 12.4964],
      zoom: 14,
      zoomControl: false
    });

    // Rule 4: Leaflet 1.9.4 + OpenStreetMap without proprietary keys
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | ATAC Roma'
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng });
      }
    });

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Expose global click bridge for Leaflet popup buttons
  useEffect(() => {
    window.selectStopFromMap = (stopId) => {
      if (onSelectStop) onSelectStop(stopId);
    };
    return () => {
      delete window.selectStopFromMap;
    };
  }, [onSelectStop]);

  // 2. User Location Marker & Accuracy Circle
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    clearLayer('user');
    clearLayer('userAccuracy');

    if (userLocation && userLocation.lat && userLocation.lon) {
      const userIcon = L.divIcon({
        className: 'user-marker-wrapper',
        html: `<div class="user-marker-pulse"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const accInfo = userLocation.accuracy
        ? `<br><span style="color: #1565c0; font-weight: 700;">Precisione: ±${Math.round(userLocation.accuracy)}m</span>`
        : '';
      const marker = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
        .addTo(map)
        .bindPopup(`<b>La tua posizione GPS</b><br>Lat: ${userLocation.lat.toFixed(5)}, Lon: ${userLocation.lon.toFixed(5)}${accInfo}`);

      layersRef.current.user = marker;

      if (userLocation.accuracy) {
        const circle = L.circle([userLocation.lat, userLocation.lon], {
          radius: userLocation.accuracy,
          color: '#1565c0',
          weight: 1.5,
          fillColor: '#2196f3',
          fillOpacity: 0.12
        }).addTo(map);
        layersRef.current.userAccuracy = circle;
      }

      if (userLocation.isManual) {
        map.flyTo([userLocation.lat, userLocation.lon], 16, { animate: true, duration: 1.0 });
        marker.openPopup();
      }
    }
  }, [userLocation]);

  // 3. Tab: ARRIVALS - Show clickable STOP pins on the main screen map (instead of vehicles)
  const fetchStopsForViewport = useCallback(async () => {
    const map = leafletMap.current;
    if (!map || activeTab !== 'ARRIVALS') return;

    const bounds = map.getBounds();
    const zoom = map.getZoom();

    // If zoomed out too far, fetch nearby around center
    let url;
    if (zoom >= 13) {
      url = apiUrl(`/api/stops/bounds?minLat=${bounds.getSouth()}&maxLat=${bounds.getNorth()}&minLon=${bounds.getWest()}&maxLon=${bounds.getEast()}&limit=140`);
    } else {
      const center = map.getCenter();
      url = apiUrl(`/api/stops/nearby?lat=${center.lat}&lon=${center.lng}&radius=800`);
    }

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const stops = await res.json();
      if (!Array.isArray(stops)) return;

      clearLayer('mainStops');
      const stopsGroup = L.featureGroup();

      stops.forEach((st) => {
        if (!st.stop_lat || !st.stop_lon) return;

        const stopIcon = L.divIcon({
          className: 'bus-stop-pin',
          html: `
            <div class="stop-pin-circle">🚏</div>
            <div class="stop-pin-label">${st.stop_code || st.stop_id}</div>
          `,
          iconSize: [36, 44],
          iconAnchor: [18, 22]
        });

        const marker = L.marker([st.stop_lat, st.stop_lon], { icon: stopIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 175px;">
            <div style="font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase;">PALINA ATAC ROMA</div>
            <div style="font-size: 14px; font-weight: 800; color: #8e1823; margin: 3px 0;">${st.stop_name}</div>
            <div style="font-size: 12px; margin-bottom: 8px;">Codice: <b style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">${st.stop_code || st.stop_id}</b></div>
            <button style="width: 100%; padding: 6px 10px; background: #8e1823; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;" onclick="window.selectStopFromMap('${st.stop_id}')">
              Vedi bus in arrivo
            </button>
          </div>
        `);

        marker.on('click', () => {
          marker.openPopup();
        });

        stopsGroup.addLayer(marker);
      });

      stopsGroup.addTo(map);
      layersRef.current.mainStops = stopsGroup;
    } catch (err) {
      console.warn('Error fetching stops for viewport:', err);
    }
  }, [activeTab]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (activeTab === 'ARRIVALS') {
      // Clear vehicle and nearby layers when in arrivals tab
      clearLayer('vehicles');
      clearLayer('nearbyCircle');
      clearLayer('nearbyStops');

      fetchStopsForViewport();

      const onMoveEnd = () => {
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(fetchStopsForViewport, 300);
      };

      map.on('moveend', onMoveEnd);
      return () => {
        map.off('moveend', onMoveEnd);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      };
    } else {
      clearLayer('mainStops');
    }
  }, [activeTab, fetchStopsForViewport]);

  // 4. Tab: NEARBY - Show all stops in radius + circle + auto fitBounds
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (activeTab !== 'NEARBY') {
      clearLayer('nearbyCircle');
      clearLayer('nearbyStops');
      return;
    }

    clearLayer('mainStops');
    clearLayer('vehicles');
    clearLayer('nearbyCircle');
    clearLayer('nearbyStops');

    const centerLat = userLocation?.lat || 41.9010;
    const centerLon = userLocation?.lon || 12.5002;

    // Draw radius boundary circle
    const circle = L.circle([centerLat, centerLon], {
      radius: nearbyRadius,
      color: '#8e1823',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#8e1823',
      fillOpacity: 0.08
    }).addTo(map);
    layersRef.current.nearbyCircle = circle;

    // Draw all stops within radius
    const stopsGroup = L.featureGroup();
    nearbyStops.forEach((st) => {
      if (!st.stop_lat || !st.stop_lon) return;

      const stopIcon = L.divIcon({
        className: 'bus-stop-pin',
        html: `
          <div class="stop-pin-circle">🚏</div>
          <div class="stop-pin-label">${st.stop_code || st.stop_id}</div>
        `,
        iconSize: [36, 44],
        iconAnchor: [18, 22]
      });

      const distBadge = st.distance ? `<div style="font-size: 11px; color: #1565c0; font-weight: 700; margin: 2px 0;">Distanza: ${st.distance} m</div>` : '';
      const marker = L.marker([st.stop_lat, st.stop_lon], { icon: stopIcon });
      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 175px;">
          <div style="font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase;">FERMATA VICINA</div>
          <div style="font-size: 14px; font-weight: 800; color: #8e1823; margin: 3px 0;">${st.stop_name}</div>
          ${distBadge}
          <div style="font-size: 12px; margin-bottom: 8px;">Codice: <b style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">${st.stop_code || st.stop_id}</b></div>
          <button style="width: 100%; padding: 6px 10px; background: #8e1823; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;" onclick="window.selectStopFromMap('${st.stop_id}')">
            Vedi bus in arrivo
          </button>
        </div>
      `);

      stopsGroup.addLayer(marker);
    });

    stopsGroup.addTo(map);
    layersRef.current.nearbyStops = stopsGroup;

    // Automatically zoom and fit to the chosen radius boundary!
    try {
      map.fitBounds(circle.getBounds(), { padding: [30, 30], maxZoom: 17 });
    } catch (e) {}
  }, [activeTab, nearbyStops, nearbyRadius, userLocation]);

  // 5. Selected Stop Marker (high-contrast focus)
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    clearLayer('stop');

    if (selectedStop && selectedStop.stop_lat && selectedStop.stop_lon) {
      const stopIcon = L.divIcon({
        className: 'custom-stop-icon',
        html: `
          <div style="background: #8e1823; color: white; padding: 4px 10px; border-radius: 14px; font-weight: 800; font-size: 12px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.45); display: flex; align-items: center; gap: 5px; white-space: nowrap;">
            <span>🚏</span>
            <span>${selectedStop.stop_code || selectedStop.stop_id}</span>
          </div>
        `,
        iconSize: [84, 30],
        iconAnchor: [42, 30]
      });

      const marker = L.marker([selectedStop.stop_lat, selectedStop.stop_lon], { icon: stopIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: sans-serif; min-width: 170px;">
            <div style="font-size: 10px; color: #666; font-weight: 700;">PALINA SELEZIONATA</div>
            <div style="font-size: 15px; font-weight: 800; color: #8e1823; margin: 2px 0;">${selectedStop.stop_name}</div>
            <div style="font-size: 12px; font-weight: 700;">Codice: ${selectedStop.stop_code || selectedStop.stop_id}</div>
          </div>
        `)
        .openPopup();

      layersRef.current.stop = marker;
      map.setView([selectedStop.stop_lat, selectedStop.stop_lon], 16, { animate: true });
    }
  }, [selectedStop]);

  // 6. Tab: ROUTES - Show ONLY the selected direction's shape and stops!
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    clearLayer('routeShape');
    clearLayer('routeStops');

    if (activeTab !== 'ROUTES') return;

    if (selectedRouteShape && selectedRouteShape.shapes && selectedRouteShape.shapes.length > 0) {
      // Filter strictly by the active direction!
      const dirShapes = selectedRouteShape.shapes.filter(
        s => Number(s.directionId) === Number(activeRouteDirection)
      );
      // Fallback to first shape if directionId didn't match
      const shapesToDraw = dirShapes.length > 0 ? dirShapes : [selectedRouteShape.shapes[0]];

      const group = L.featureGroup();
      shapesToDraw.forEach((s) => {
        const poly = L.polyline(s.coordinates, {
          color: '#8e1823',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round'
        }).bindPopup(`<b>Linea ${selectedRouteShape.routeId}</b><br>Direzione: ${s.headsign || (activeRouteDirection === 0 ? 'Andata' : 'Ritorno')}`);
        group.addLayer(poly);
      });

      group.addTo(map);
      layersRef.current.routeShape = group;

      try {
        map.fitBounds(group.getBounds(), { padding: [35, 35] });
      } catch (e) {}
    }

    // Add Route Stops markers along this direction
    if (selectedRouteStops && selectedRouteStops.length > 0) {
      const stopsGroup = L.featureGroup();
      selectedRouteStops.forEach((st) => {
        const circle = L.circleMarker([st.stop_lat, st.stop_lon], {
          radius: 5,
          fillColor: '#ffffff',
          color: '#8e1823',
          weight: 2,
          fillOpacity: 1
        }).bindPopup(`
          <div style="font-family: sans-serif;">
            <b>${st.stop_sequence}. ${st.stop_name}</b><br>
            Palina: <code>${st.stop_code || st.stop_id}</code><br>
            <button style="margin-top:6px; padding:4px 8px; background:#8e1823; color:#fff; border:none; border-radius:4px; cursor:pointer;" onclick="window.selectStopFromMap('${st.stop_id}')">
              Vedi Arrivi Live
            </button>
          </div>
        `);
        stopsGroup.addLayer(circle);
      });
      stopsGroup.addTo(map);
      layersRef.current.routeStops = stopsGroup;
    }
  }, [activeTab, selectedRouteShape, selectedRouteStops, activeRouteDirection]);

  // 7. Tab: RADAR - Show Real-Time Vehicles Markers ONLY when on RADAR tab
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (activeTab !== 'RADAR') {
      clearLayer('vehicles');
      return;
    }

    clearLayer('vehicles');

    const filtered = filteredRouteId
      ? vehicles.filter(v => v.routeId && v.routeId.toUpperCase() === filteredRouteId.toUpperCase())
      : vehicles;

    const displayVehicles = filteredRouteId ? filtered : filtered.slice(0, 350);
    const vehicleGroup = L.featureGroup();

    displayVehicles.forEach((v) => {
      if (!v.lat || !v.lon) return;

      const isTram = v.routeId && ['2', '3', '5', '8', '14', '19'].includes(v.routeId);
      const isMetro = v.routeId && ['MEA', 'MEB', 'MEB1', 'MEC'].includes(v.routeId);

      const markerClass = isTram ? 'tram' : isMetro ? 'metro' : '';
      const iconSymbol = isTram ? '🚋' : isMetro ? '🚇' : '🚌';

      const busIcon = L.divIcon({
        className: 'bus-marker-container',
        html: `
          <div class="bus-marker-pin ${markerClass}" style="transform: rotate(${v.bearing || 0}deg);">
            <span style="transform: rotate(-${v.bearing || 0}deg); font-size: 13px;">${iconSymbol}</span>
          </div>
          <div class="bus-marker-label">${v.routeId || v.label || ''}</div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 21]
      });

      const marker = L.marker([v.lat, v.lon], { icon: busIcon });
      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 180px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 16px; font-weight: 800; background: #8e1823; color: white; padding: 2px 8px; border-radius: 4px;">
              ${v.routeId || 'ATAC'}
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #2e7d32;">● GPS LIVE</span>
          </div>
          <div style="font-size: 12px; margin-top: 4px;"><b>Matricola:</b> ${v.label || v.id || 'N/D'}</div>
          <div style="font-size: 12px;"><b>Velocità:</b> ${v.speed ? Math.round(v.speed * 3.6) + ' km/h' : 'Ferma / In sosta'}</div>
          <div style="font-size: 12px;"><b>Direzione:</b> ${v.bearing ? Math.round(v.bearing) + '°' : 'N/D'}</div>
          ${v.stopId ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">Presso palina: <b>${v.stopId}</b></div>` : ''}
        </div>
      `);

      marker.on('click', () => {
        if (onSelectVehicle) onSelectVehicle(v);
      });

      vehicleGroup.addLayer(marker);
    });

    vehicleGroup.addTo(map);
    layersRef.current.vehicles = vehicleGroup;
  }, [activeTab, vehicles, filteredRouteId, onSelectVehicle]);

  return (
    <div className="map-container">
      <div id="map" ref={mapRef}></div>

      {/* Floating Action Controls */}
      <div className="map-floating-controls">
        {onOpenToastMenu && (
          <button
            type="button"
            className="btn-fab"
            title="Menù Rapido Pagine"
            onClick={onOpenToastMenu}
            aria-label="Apri Menù Pagine"
          >
            <Menu size={18} color="#8e1823" />
          </button>
        )}

        <button
          type="button"
          className="btn-fab"
          title="Rileva la mia posizione GPS"
          onClick={onRequestLocation}
          aria-label="Rileva posizione GPS"
        >
          <Locate size={18} color="#1565c0" className={isLocating ? 'spin' : ''} />
        </button>

        {onToggleSheet && (
          <button
            type="button"
            className="btn-fab mobile-only-fab"
            title={mobileSheetState === 'collapsed' ? 'Mostra Scheda Dettagli' : 'Vedi Mappa Intera'}
            onClick={onToggleSheet}
            aria-label="Alterna Mappa e Scheda"
          >
            {mobileSheetState === 'collapsed' ? <Layers size={18} color="#8e1823" /> : <MapIcon size={18} color="#8e1823" />}
          </button>
        )}
      </div>
    </div>
  );
}
