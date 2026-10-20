import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Locate, Layers, Map as MapIcon, Menu } from 'lucide-react';

export default function Map({
  selectedStop,
  selectedRouteShape,
  selectedRouteStops,
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
  const layersRef = useRef({
    user: null,
    userAccuracy: null,
    stop: null,
    routeShape: null,
    routeStops: null,
    vehicles: null
  });

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Centered on Rome Termini / Centro Storico
    const map = L.map(mapRef.current, {
      center: [41.9028, 12.4964],
      zoom: 13,
      zoomControl: false
    });

    // Per Rule 4: Leaflet 1.9.4 + OpenStreetMap (tile.openstreetmap.org) without proprietary API keys
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | ATAC Roma Mobilita'
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

  // Update User Location Marker & Pan
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (layersRef.current.user) {
      map.removeLayer(layersRef.current.user);
      layersRef.current.user = null;
    }
    if (layersRef.current.userAccuracy) {
      map.removeLayer(layersRef.current.userAccuracy);
      layersRef.current.userAccuracy = null;
    }

    if (userLocation && userLocation.lat && userLocation.lon) {
      const userIcon = L.divIcon({
        className: 'user-marker-wrapper',
        html: `<div class="user-marker-pulse"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const accInfo = userLocation.accuracy ? `<br><span style="color: #1565c0; font-weight: 700;">Precisione: ±${Math.round(userLocation.accuracy)}m</span>` : '';
      const marker = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
        .addTo(map)
        .bindPopup(`<b>La tua posizione GPS</b><br>Lat: ${userLocation.lat.toFixed(5)}, Lon: ${userLocation.lon.toFixed(5)}${accInfo}`);

      layersRef.current.user = marker;

      // Draw accuracy circle
      if (userLocation.accuracy) {
        const circle = L.circle([userLocation.lat, userLocation.lon], {
          radius: userLocation.accuracy,
          color: '#1565c0',
          weight: 1.5,
          fillColor: '#2196f3',
          fillOpacity: 0.14
        }).addTo(map);
        layersRef.current.userAccuracy = circle;
      }

      // Fly to user location if triggered manually or requested
      if (userLocation.isManual) {
        map.flyTo([userLocation.lat, userLocation.lon], 16, { animate: true, duration: 1.2 });
        marker.openPopup();
      }
    }
  }, [userLocation]);

  // Update Selected Stop Marker
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (layersRef.current.stop) {
      map.removeLayer(layersRef.current.stop);
      layersRef.current.stop = null;
    }

    if (selectedStop && selectedStop.stop_lat && selectedStop.stop_lon) {
      const stopIcon = L.divIcon({
        className: 'custom-stop-icon',
        html: `
          <div style="background: #8e1823; color: white; padding: 4px 8px; border-radius: 12px; font-weight: 800; font-size: 11px; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>🚏</span>
            <span>${selectedStop.stop_code || selectedStop.stop_id}</span>
          </div>
        `,
        iconSize: [80, 28],
        iconAnchor: [40, 28]
      });

      const marker = L.marker([selectedStop.stop_lat, selectedStop.stop_lon], { icon: stopIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: sans-serif; min-width: 160px;">
            <div style="font-size: 11px; color: #666; font-weight: 600;">PALINA ATAC</div>
            <div style="font-size: 15px; font-weight: 800; color: #8e1823; margin: 2px 0;">${selectedStop.stop_name}</div>
            <div style="font-size: 12px; font-weight: 700;">Codice: ${selectedStop.stop_code || selectedStop.stop_id}</div>
          </div>
        `)
        .openPopup();

      layersRef.current.stop = marker;
      map.setView([selectedStop.stop_lat, selectedStop.stop_lon], 16, { animate: true });
    }
  }, [selectedStop]);

  // Update Route Shape Polyline & Route Stops
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (layersRef.current.routeShape) {
      map.removeLayer(layersRef.current.routeShape);
      layersRef.current.routeShape = null;
    }
    if (layersRef.current.routeStops) {
      map.removeLayer(layersRef.current.routeStops);
      layersRef.current.routeStops = null;
    }

    if (selectedRouteShape && selectedRouteShape.shapes && selectedRouteShape.shapes.length > 0) {
      const group = L.featureGroup();
      const colors = ['#8e1823', '#00629e', '#e65100', '#2e7d32'];

      selectedRouteShape.shapes.forEach((s, idx) => {
        const poly = L.polyline(s.coordinates, {
          color: colors[idx % colors.length],
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round'
        }).bindPopup(`<b>Linea ${selectedRouteShape.routeId}</b><br>Direzione: ${s.headsign || 'Andata/Ritorno'}`);
        group.addLayer(poly);
      });

      group.addTo(map);
      layersRef.current.routeShape = group;

      // Fit bounds to route
      try {
        map.fitBounds(group.getBounds(), { padding: [30, 30] });
      } catch (e) {}
    }

    // Add Route Stops markers along the line
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
  }, [selectedRouteShape, selectedRouteStops]);

  // Global helper for Leaflet popups
  useEffect(() => {
    window.selectStopFromMap = (stopId) => {
      if (onSelectStop) onSelectStop(stopId);
    };
    return () => {
      delete window.selectStopFromMap;
    };
  }, [onSelectStop]);

  // Update Real-Time Vehicles Markers
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (layersRef.current.vehicles) {
      map.removeLayer(layersRef.current.vehicles);
      layersRef.current.vehicles = null;
    }

    const filtered = filteredRouteId
      ? vehicles.filter(v => v.routeId && v.routeId.toUpperCase() === filteredRouteId.toUpperCase())
      : vehicles;

    // To prevent browser rendering lag with 1,200 markers, show all if filtered, or show up to 350 most relevant when in full view
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
  }, [vehicles, filteredRouteId, onSelectVehicle]);

  return (
    <div className="map-container">
      <div id="map" ref={mapRef}></div>

      {/* Floating Action Buttons per Mobile & Desktop */}
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
