import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  Menu
} from 'lucide-react';

import Map from './components/Map.jsx';
import ArrivalsBoard from './components/ArrivalsBoard.jsx';
import VehiclesRadar from './components/VehiclesRadar.jsx';
import RoutesExplorer from './components/RoutesExplorer.jsx';
import NearbyStops from './components/NearbyStops.jsx';
import AlertsFeed from './components/AlertsFeed.jsx';
import ToastMenu from './components/ToastMenu.jsx';
import ToastNotification from './components/ToastNotification.jsx';
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
  const [mobileSheetState, setMobileSheetState] = useState('half'); // 'collapsed' | 'half' | 'expanded'
  const [isToastMenuOpen, setIsToastMenuOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Apply theme to html root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Toast feedback helper
  const showToast = (text, type = 'info') => {
    setToastMessage({ text, type });
  };

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Request browser geolocation (triggered strictly upon user tap)
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocalizzazione non supportata dal tuo browser', 'error');
      return;
    }

    setIsLocating(true);
    showToast('Richiesta autorizzazione GPS al dispositivo...', 'info');

    const handleSuccess = (pos) => {
      setIsLocating(false);
      const { latitude, longitude, accuracy } = pos.coords;
      setUserLocation({
        lat: latitude,
        lon: longitude,
        accuracy: accuracy || null,
        isManual: true,
        timestamp: Date.now()
      });
      const accText = accuracy ? ` (±${Math.round(accuracy)}m)` : '';
      showToast(`📍 Posizione rilevata con successo${accText}!`, 'success');
    };

    const handleFailure = (err) => {
      console.warn('Geolocation error:', err);
      setIsLocating(false);
      if (err.code === 1) { // PERMISSION_DENIED
        showToast('⚠️ Permesso GPS non concesso. Abilita la posizione nelle impostazioni del browser.', 'error');
      } else if (err.code === 2) { // POSITION_UNAVAILABLE
        showToast('⚠️ Posizione GPS non disponibile. Verifica che la localizzazione sia attiva sul telefono.', 'error');
      } else if (err.code === 3) { // TIMEOUT
        showToast('⚠️ Ricerca GPS scaduta. Riprova all\'aperto o verifica la connessione.', 'error');
      } else {
        showToast(`⚠️ Impossibile determinare la posizione: ${err.message || 'Errore'}`, 'error');
      }
    };

    // Attempt high accuracy GPS first
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        // Fallback retry with standard/network accuracy if GPS timed out or unavailable
        if (err.code === 3 || err.code === 2) {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            handleFailure,
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          );
        } else {
          handleFailure(err);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
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

  // Initial fetch and 15s auto-refresh (Notice: Geolocation is NOT triggered here!)
  useEffect(() => {
    refreshAll();

    if (!autoRefresh) return;
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const TABS = ['ARRIVALS', 'RADAR', 'ROUTES', 'NEARBY', 'ALERTS'];
  const lastBackPressRef = useRef(0);
  const dragTouchStartRef = useRef({ x: 0, y: 0 });
  const panelTouchStartRef = useRef({ x: 0, y: 0 });

  // History & Back Gesture Navigation (Prevents app exit on back gesture / back button)
  useEffect(() => {
    // Initial state
    window.history.replaceState({
      tab: 'ARRIVALS',
      sheetState: 'half',
      hasStop: false
    }, '');

    const handlePopState = (e) => {
      // 1. If toast menu is open, close it
      if (isToastMenuOpen) {
        setIsToastMenuOpen(false);
        return;
      }

      // 2. If bottom sheet is expanded, snap down to half
      if (mobileSheetState === 'expanded') {
        setMobileSheetState('half');
        return;
      }

      // 3. If viewing a specific stop, return to stop search
      if (selectedStop) {
        setSelectedStop(null);
        showToast('Tornato alla ricerca fermate', 'info');
        return;
      }

      // 4. If previous state has another tab, navigate back to it
      if (e.state && e.state.tab && e.state.tab !== activeTab) {
        setActiveTab(e.state.tab);
        if (e.state.sheetState) setMobileSheetState(e.state.sheetState);
        return;
      }

      // 5. If at the beginning, prevent closing the web app unless tapped twice
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        // User confirmed exit
      } else {
        lastBackPressRef.current = now;
        window.history.pushState({
          tab: activeTab,
          sheetState: mobileSheetState,
          hasStop: false
        }, '');
        showToast('Premi di nuovo indietro per uscire dalla Web App', 'info');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isToastMenuOpen, mobileSheetState, selectedStop, activeTab]);

  // Handlers
  const cycleSheetState = () => {
    if (mobileSheetState === 'collapsed') {
      setMobileSheetState('half');
    } else if (mobileSheetState === 'half') {
      setMobileSheetState('expanded');
      window.history.pushState({ tab: activeTab, sheetState: 'expanded' }, '');
    } else {
      setMobileSheetState('collapsed');
    }
  };

  const toggleMapAndSheet = () => {
    setMobileSheetState(prev => prev === 'collapsed' ? 'half' : 'collapsed');
  };

  const handleTabChange = (tab, pushHistory = true) => {
    if (tab === activeTab && mobileSheetState !== 'collapsed') return;
    setActiveTab(tab);
    if (mobileSheetState === 'collapsed') {
      setMobileSheetState('half');
    }
    if (pushHistory) {
      window.history.pushState({
        tab,
        sheetState: mobileSheetState === 'collapsed' ? 'half' : mobileSheetState,
        hasStop: !!selectedStop
      }, '');
    }
    const names = {
      ARRIVALS: 'Palina Arrivi',
      RADAR: 'Radar GPS',
      ROUTES: 'Linee & Percorsi',
      NEARBY: 'Fermate Vicine',
      ALERTS: 'Avvisi di Servizio'
    };
    showToast(`Sezione: ${names[tab] || tab}`, 'info');
  };

  const handleSelectStop = (stop) => {
    setSelectedStop(stop);
    setActiveTab('ARRIVALS');
    if (mobileSheetState === 'collapsed') {
      setMobileSheetState('half');
    }
    if (stop) {
      window.history.pushState({
        tab: 'ARRIVALS',
        sheetState: 'half',
        hasStop: true
      }, '');
    }
  };

  const handleTrackVehicle = (vehicle) => {
    setFilteredRouteId(vehicle.routeId || '');
    handleTabChange('RADAR');
  };

  const handleSelectRoute = (route, shapeData) => {
    setFilteredRouteId(route.route_short_name || route.route_id);
    setSelectedRouteShape(shapeData);
  };

  const handleOpenToastMenu = () => {
    setIsToastMenuOpen(true);
    window.history.pushState({
      tab: activeTab,
      sheetState: mobileSheetState,
      modal: 'menu'
    }, '');
  };

  // Touch Gesture Handlers for Bottom Sheet (Vertical Drag)
  const handleDragTouchStart = (e) => {
    dragTouchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleDragTouchEnd = (e) => {
    const deltaY = e.changedTouches[0].clientY - dragTouchStartRef.current.y;
    const deltaX = e.changedTouches[0].clientX - dragTouchStartRef.current.x;

    if (Math.abs(deltaY) > 35 && Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY > 0) {
        // Dragged down
        if (mobileSheetState === 'expanded') setMobileSheetState('half');
        else if (mobileSheetState === 'half') setMobileSheetState('collapsed');
      } else {
        // Dragged up
        if (mobileSheetState === 'collapsed') setMobileSheetState('half');
        else if (mobileSheetState === 'half') {
          setMobileSheetState('expanded');
          window.history.pushState({ tab: activeTab, sheetState: 'expanded' }, '');
        }
      }
    }
  };

  // Touch Gesture Handlers for Panel (Horizontal Swipe between tabs / Edge-swipe Back)
  const handlePanelTouchStart = (e) => {
    panelTouchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handlePanelTouchEnd = (e) => {
    const deltaX = e.changedTouches[0].clientX - panelTouchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - panelTouchStartRef.current.y;

    // Edge swipe from left: back navigation
    if (panelTouchStartRef.current.x < 35 && deltaX > 60) {
      window.history.back();
      return;
    }

    // Horizontal swipe between tabs
    if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.6) {
      const idx = TABS.indexOf(activeTab);
      if (deltaX < 0 && idx < TABS.length - 1) {
        // Swipe left -> next tab
        handleTabChange(TABS[idx + 1]);
      } else if (deltaX > 0 && idx > 0) {
        // Swipe right -> previous tab
        handleTabChange(TABS[idx - 1]);
      }
    }
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
          {/* Menù Toast Button */}
          <button
            type="button"
            className="btn-menu-toast"
            onClick={handleOpenToastMenu}
            title="Apri Menù Rapido Pagine"
            aria-label="Apri Menù Rapido Pagine"
          >
            <Menu size={16} />
            <span>Menù</span>
          </button>

          {backendStatus && backendStatus.counts && (
            <div className="top-bar-stats" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>
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

        {/* Sidebar Interactive Panel with Mobile Sheet States & Touch Gestures */}
        <div
          className={`side-panel ${mobileSheetState === 'collapsed' ? 'sheet-collapsed' : mobileSheetState === 'expanded' ? 'sheet-expanded' : 'sheet-half'}`}
          onTouchStart={handlePanelTouchStart}
          onTouchEnd={handlePanelTouchEnd}
        >
          {/* Mobile Sheet Drag Handle & Summary Pill (Supports Vertical Drag Gestures) */}
          <div
            className="mobile-sheet-drag-bar"
            onClick={cycleSheetState}
            onTouchStart={handleDragTouchStart}
            onTouchEnd={handleDragTouchEnd}
          >
            <div className="drag-pill" />
            <div className="sheet-summary-bar">
              <div className="sheet-summary-left">
                <span className="sheet-tab-name">
                  {activeTab === 'ARRIVALS' && 'Arrivi Palina'}
                  {activeTab === 'RADAR' && 'Radar Bus GPS'}
                  {activeTab === 'ROUTES' && 'Linee & Percorsi'}
                  {activeTab === 'NEARBY' && 'Fermate Vicine'}
                  {activeTab === 'ALERTS' && 'Avvisi di Servizio'}
                </span>
                <span className="sheet-sub">
                  {activeTab === 'ARRIVALS' && (selectedStop ? selectedStop.stop_name : 'Tocca per cercare')}
                  {activeTab === 'RADAR' && `${vehicles.length} bus con posizione`}
                  {activeTab === 'ROUTES' && 'Tutte le linee ATAC'}
                  {activeTab === 'NEARBY' && 'Intorno a te'}
                  {activeTab === 'ALERTS' && 'Stato rete Roma'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700 }}>
                {mobileSheetState === 'collapsed' && <>Espandi <ChevronUp size={14} /></>}
                {mobileSheetState === 'half' && <>Schermo intero <ChevronUp size={14} /></>}
                {mobileSheetState === 'expanded' && <>Riduci <ChevronDown size={14} /></>}
              </div>
            </div>
          </div>

          <div className="side-panel-content">
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
                isLocating={isLocating}
              />
            )}

            {activeTab === 'ALERTS' && (
              <AlertsFeed />
            )}
          </div>
        </div>

        {/* Leaflet 1.9.4 Interactive OpenStreetMap View */}
        <Map
          selectedStop={selectedStop}
          selectedRouteShape={selectedRouteShape}
          selectedRouteStops={selectedRouteStops}
          vehicles={vehicles}
          filteredRouteId={filteredRouteId}
          userLocation={userLocation}
          onRequestLocation={handleRequestLocation}
          onToggleSheet={toggleMapAndSheet}
          mobileSheetState={mobileSheetState}
          onOpenToastMenu={handleOpenToastMenu}
          isLocating={isLocating}
          onSelectStop={(stopId) => {
            fetch(apiUrl(`/api/stops/search?q=${stopId}`))
              .then(res => res.json())
              .then(data => {
                if (data.length > 0) handleSelectStop(data[0]);
              });
          }}
          onSelectVehicle={(v) => {
            setFilteredRouteId(v.routeId || '');
            if (mobileSheetState === 'collapsed') {
              setMobileSheetState('half');
            }
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
          onClick={() => handleTabChange('ARRIVALS')}
        >
          <Clock size={18} />
          <span>Palina</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'RADAR' ? 'active' : ''}`}
          onClick={() => handleTabChange('RADAR')}
        >
          <Radio size={18} />
          <span>Radar</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'ROUTES' ? 'active' : ''}`}
          onClick={() => handleTabChange('ROUTES')}
        >
          <RouteIcon size={18} />
          <span>Linee</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'NEARBY' ? 'active' : ''}`}
          onClick={() => handleTabChange('NEARBY')}
        >
          <MapPin size={18} />
          <span>Vicine</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'ALERTS' ? 'active' : ''}`}
          onClick={() => handleTabChange('ALERTS')}
        >
          <AlertTriangle size={18} />
          <span>Avvisi</span>
        </button>
      </nav>

      {/* Toast Navigation Menu */}
      <ToastMenu
        isOpen={isToastMenuOpen}
        onClose={handleCloseToastMenu}
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onRequestLocation={handleRequestLocation}
        isLocating={isLocating}
        vehiclesCount={vehicles.length}
      />

      {/* Floating Status / Action Toast Notification */}
      <ToastNotification
        toast={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />
    </div>
  );
}
