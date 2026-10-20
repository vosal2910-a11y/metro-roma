import React, { useState, useEffect } from 'react';
import { Search, MapPin, Clock, RefreshCw, AlertCircle, Bus, Users, Navigation, X } from 'lucide-react';
import { apiUrl } from '../api.js';

export default function ArrivalsBoard({
  selectedStop,
  onSelectStop,
  onTrackVehicle,
  onCenterStopOnMap
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [arrivalsData, setArrivalsData] = useState(null);
  const [isLoadingArrivals, setIsLoadingArrivals] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Search Stops autocomplete
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(apiUrl(`/api/stops/search?q=${encodeURIComponent(searchQuery.trim())}`));
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch real-time arrivals when selectedStop changes
  const fetchArrivals = async (stopId) => {
    if (!stopId) return;
    setIsLoadingArrivals(true);
    try {
      const res = await fetch(apiUrl(`/api/arrivals/${stopId}`));
      if (res.ok) {
        const data = await res.json();
        setArrivalsData(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Arrivals error:', err);
    } finally {
      setIsLoadingArrivals(false);
    }
  };

  useEffect(() => {
    if (selectedStop && selectedStop.stop_id) {
      fetchArrivals(selectedStop.stop_id);
    } else {
      setArrivalsData(null);
    }
  }, [selectedStop]);

  // Format delay display
  const formatDelay = (delaySec) => {
    if (delaySec === undefined || delaySec === null) return null;
    const min = Math.round(delaySec / 60);
    if (min > 0) return <span className="delay-pill late">+{min} min ritardo</span>;
    if (min < 0) return <span className="delay-pill early">{Math.abs(min)} min anticipo</span>;
    return <span className="delay-pill on-time">In orario</span>;
  };

  // Format occupancy display
  const formatOccupancy = (status) => {
    if (status === null || status === undefined) return null;
    switch (status) {
      case 0: return <span title="Posti a sedere disponibili"><Users size={12} color="#2e7d32" /> Molti posti</span>;
      case 1: return <span title="Pochi posti a sedere"><Users size={12} color="#f57c00" /> Pochi posti</span>;
      case 2: return <span title="Solo posti in piedi"><Users size={12} color="#d32f2f" /> Solo in piedi</span>;
      default: return null;
    }
  };

  // Get line style
  const getLineClass = (routeId) => {
    if (!routeId) return '';
    const r = routeId.toUpperCase();
    if (r === 'MEA' || r === 'MA') return 'metro-a';
    if (r === 'MEB' || r === 'MEB1' || r === 'MB') return 'metro-b';
    if (r === 'MEC' || r === 'MC') return 'metro-c';
    if (['2', '3', '5', '8', '14', '19'].includes(r)) return 'tram';
    if (r.startsWith('N')) return 'night';
    return '';
  };

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Arrivi Palina Live</h2>
        <p className="panel-subtitle">Dati ufficiali ATAC in tempo reale (Protocol Buffers GTFS-RT)</p>

        {/* Search Bar */}
        <div className="search-wrapper">
          <Search size={18} className="search-icon-left" />
          <input
            type="text"
            className="search-input"
            placeholder="Cerca palina (es. 70046, 79644) o via..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-btn-clear" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div className="search-results-list">
              {searchResults.map((stop) => (
                <div
                  key={stop.stop_id}
                  className="search-result-item"
                  onClick={() => {
                    onSelectStop(stop);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <span className="badge-code">{stop.stop_code || stop.stop_id}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{stop.stop_name}</div>
                    {stop.stop_desc && <div style={{ fontSize: '11px', color: '#666' }}>{stop.stop_desc}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Stop Card */}
      {selectedStop ? (
        <div style={{ padding: '12px 16px 0' }}>
          <div className="card" style={{ margin: 0, borderLeft: '4px solid var(--color-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge-code" style={{ marginRight: '6px' }}>
                  PALINA {selectedStop.stop_code || selectedStop.stop_id}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '6px 0 2px' }}>
                  {selectedStop.stop_name}
                </h3>
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                  Coordinate: {Number(selectedStop.stop_lat).toFixed(4)}, {Number(selectedStop.stop_lon).toFixed(4)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="btn-icon"
                  title="Centra su mappa"
                  onClick={() => onCenterStopOnMap(selectedStop)}
                >
                  <Navigation size={18} />
                </button>
                <button
                  className="btn-icon"
                  title="Aggiorna arrivi"
                  onClick={() => fetchArrivals(selectedStop.stop_id)}
                >
                  <RefreshCw size={18} className={isLoadingArrivals ? 'spin' : ''} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <MapPin size={42} />
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>Nessuna fermata selezionata</h3>
            <p style={{ fontSize: '12px' }}>Cerca un numero di palina (es. <b>70046</b> o <b>79644</b>) o seleziona una fermata dalla mappa.</p>
          </div>
        </div>
      )}

      {/* Arrivals List */}
      {selectedStop && arrivalsData && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ padding: '0 18px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Prossimi passaggi ({arrivalsData.arrivals ? arrivalsData.arrivals.length : 0})
            </div>
            {lastRefreshed && (
              <div style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} /> Aggiornato: {lastRefreshed.toLocaleTimeString()}
              </div>
            )}
          </div>

          {arrivalsData.arrivals && arrivalsData.arrivals.length > 0 ? (
            arrivalsData.arrivals.map((arr, idx) => (
              <div key={idx} className="arrival-card">
                <div className="arrival-left">
                  <span className={`badge-route ${getLineClass(arr.routeId)}`}>
                    {arr.routeId}
                  </span>
                  <div>
                    <div className="arrival-headsign">
                      {arr.headsign || `Linea ${arr.routeId}`}
                    </div>
                    <div className="arrival-sub">
                      {arr.vehicleId && (
                        <span>Matr. <b>#{arr.vehicleId}</b></span>
                      )}
                      {formatDelay(arr.delaySeconds)}
                      {formatOccupancy(arr.occupancyStatus)}
                    </div>
                  </div>
                </div>

                <div className="arrival-right">
                  <span className={`arrival-time-badge ${arr.minutes <= 2 ? 'imminent' : 'normal'}`}>
                    {arr.minutes === 0 ? 'In arrivo' : `${arr.minutes} min`}
                  </span>
                  {arr.vehicleLat && arr.vehicleLon && (
                    <button
                      className="btn-tonal"
                      style={{ padding: '2px 8px', fontSize: '10px', height: '22px', marginTop: '2px' }}
                      onClick={() => onTrackVehicle({
                        lat: arr.vehicleLat,
                        lon: arr.vehicleLon,
                        routeId: arr.routeId,
                        label: arr.vehicleId
                      })}
                    >
                      <Bus size={10} /> Segui Bus
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
              <Clock size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Nessun passaggio in tempo reale nei prossimi 60 min</div>
              <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
                I feed GTFS-RT di Roma Mobilità segnalano corse attive entro 60-90 minuti.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
