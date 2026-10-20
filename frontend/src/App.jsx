import React, { useState, useEffect } from 'react';
import {
  Clock,
  Radio,
  Route as RouteIcon,
  MapPin,
  AlertTriangle,
  Sun,
  Moon,
  RefreshCw,
  Locate,
  Layers,
  ChevronDown
} from 'lucide-react';

import Map from './components/Map.jsx';
import ArrivalsBoard from './components/ArrivalsBoard.jsx';
import VehiclesRadar from './components/VehiclesRadar.jsx';
import RoutesExplorer from './components/RoutesExplorer.jsx';
import NearbyStops from './components/NearbyStops.jsx';
import AlertsFeed from './components/AlertsFeed.jsx';
import { apiUrl } from './api.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('ARRIVALS');
  const [theme, setTheme] = useState('light');
  const [backendStatus, setBackendStatus] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedStop, setSelectedStop] = useState(null);
  const [selectedRouteShape, setSelectedRouteShape] = useState(null);
  const [selectedRouteStops, setSelectedRouteStops] = useState(null);
  const [filteredRouteId, setFilteredRouteId] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Apply theme to html root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Request browser geolocation
  const handleRequestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          });
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
          // Fallback to Rome Termini
          setUserLocation({ lat: 41.9010, lon: 12.5002 });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  // Fetch status and vehicles
  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
      const [statusRes, vehRes] = await Promise.allSettled([
        fetch(apiUrl('/api/status')),
        fetch(apiUrl('/api/vehicles'))
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const sData = await statusRes.value.json();
        setBackendStatus(sData);
      }
      if (vehRes.status === 'fulfilled' && vehRes.value.ok) {
        const vData = await vehRes.value.json();
        setVehicles(vData.vehicles || []);
      }
    } catch (err) {
      console.error('Error fetching global live data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial fetch and 15s auto-refresh
  useEffect(() => {
    refreshAll();
    handleRequestLocation();

    if (!autoRefresh) return;
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handlers
  const handleSelectStop = (stop) => {
    setSelectedStop(stop);
    setActiveTab('ARRIVALS');
  };

  const handleTrackVehicle = (vehicle) => {
    setFilteredRouteId(vehicle.routeId || '');
    setActiveTab('RADAR');
  };

  const handleSelectRoute = (route, shapeData) => {
    setFilteredRouteId(route.route_short_name || route.route_id);
    setSelectedRouteShape(shapeData);
  };

  return (
    <div className="app-container">
      {/* Top Application Bar */}
      <header className="top-bar">
        <div className="brand-section">
          <div className="brand-logo">R</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="brand-title">Roma Transit Express</h1>
              <span className="brand-badge">
                <span className="pulse-dot"></span>
                LIVE GTFS-RT
              </span>
            </div>
          </div>
        </div>

        <div className="top-actions">
          {backendStatus && backendStatus.counts && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>
              <span title="Bus e tram con posizione GPS attiva in questo istante a Roma">
                🚌 <b>{backendStatus.counts.vehicles}</b> bus GPS
              </span>
              <span title="Avvisi di servizio ufficiali ATAC">
                ⚠️ <b>{backendStatus.counts.alerts}</b> avvisi
              </span>
            </div>
          )}

          <button
            className="btn-icon"
            title="Aggiorna dati in tempo reale"
            onClick={refreshAll}
          >
            <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
          </button>

          <button
            className="btn-icon"
            title={theme === 'light' ? 'Modalità Scura' : 'Modalità Chiara'}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="main-content">
        {/* Desktop Side Navigation */}
        <nav className="side-nav">
          <button
            className={`nav-item ${activeTab === 'ARRIVALS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ARRIVALS')}
          >
            <Clock size={20} />
            <span>Palina</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'RADAR' ? 'active' : ''}`}
            onClick={() => setActiveTab('RADAR')}
          >
            <Radio size={20} />
            <span>Radar GPS</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'ROUTES' ? 'active' : ''}`}
            onClick={() => setActiveTab('ROUTES')}
          >
            <RouteIcon size={20} />
            <span>Linee</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'NEARBY' ? 'active' : ''}`}
            onClick={() => setActiveTab('NEARBY')}
          >
            <MapPin size={20} />
            <span>Vicine</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'ALERTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALERTS')}
          >
            <AlertTriangle size={20} />
            <span>Avvisi</span>
          </button>
        </nav>

        {/* Sidebar Interactive Panel */}
        <div className="side-panel">
          {activeTab === 'ARRIVALS' && (
            <ArrivalsBoard
              selectedStop={selectedStop}
              onSelectStop={handleSelectStop}
              onTrackVehicle={handleTrackVehicle}
              onCenterStopOnMap={(st) => setSelectedStop({ ...st })}
            />
          )}

          {activeTab === 'RADAR' && (
            <VehiclesRadar
              vehicles={vehicles}
              filteredRouteId={filteredRouteId}
              onFilterRoute={(rId) => setFilteredRouteId(rId)}
              onSelectVehicle={(v) => {
                setUserLocation({ lat: v.lat, lon: v.lon });
              }}
            />
          )}

          {activeTab === 'ROUTES' && (
            <RoutesExplorer
              onSelectRoute={handleSelectRoute}
              onSelectStop={handleSelectStop}
            />
          )}

          {activeTab === 'NEARBY' && (
            <NearbyStops
              userLocation={userLocation}
              onRequestLocation={handleRequestLocation}
              onSelectStop={handleSelectStop}
              onCenterStopOnMap={(st) => setSelectedStop({ ...st })}
            />
          )}

          {activeTab === 'ALERTS' && (
            <AlertsFeed />
          )}
        </div>

        {/* Leaflet 1.9.4 Interactive OpenStreetMap View */}
        <Map
          selectedStop={selectedStop}
          selectedRouteShape={selectedRouteShape}
          selectedRouteStops={selectedRouteStops}
          vehicles={vehicles}
          filteredRouteId={filteredRouteId}
          userLocation={userLocation}
          onSelectStop={(stopId) => {
            fetch(apiUrl(`/api/stops/search?q=${stopId}`))
              .then(res => res.json())
              .then(data => {
                if (data.length > 0) handleSelectStop(data[0]);
              });
          }}
          onSelectVehicle={(v) => {
            setFilteredRouteId(v.routeId || '');
          }}
          onMapClick={(coords) => {
            console.log('Map clicked:', coords);
          }}
        />
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'ARRIVALS' ? 'active' : ''}`}
          onClick={() => setActiveTab('ARRIVALS')}
        >
          <Clock size={18} />
          <span>Palina</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'RADAR' ? 'active' : ''}`}
          onClick={() => setActiveTab('RADAR')}
        >
          <Radio size={18} />
          <span>Radar</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'ROUTES' ? 'active' : ''}`}
          onClick={() => setActiveTab('ROUTES')}
        >
          <RouteIcon size={18} />
          <span>Linee</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'NEARBY' ? 'active' : ''}`}
          onClick={() => setActiveTab('NEARBY')}
        >
          <MapPin size={18} />
          <span>Vicine</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'ALERTS' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALERTS')}
        >
          <AlertTriangle size={18} />
          <span>Avvisi</span>
        </button>
      </nav>
    </div>
  );
}
