import React, { useState, useEffect } from 'react';
import { Search, Route, MapPin, Eye, ChevronRight, Layers, ArrowLeft } from 'lucide-react';
import { apiUrl } from '../api.js';

export default function RoutesExplorer({
  onSelectRoute,
  onSelectStop
}) {
  const [routes, setRoutes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeStops, setRouteStops] = useState(null);
  const [activeDirection, setActiveDirection] = useState(0);
  const [isLoadingStops, setIsLoadingStops] = useState(false);

  // Fetch all routes on mount
  useEffect(() => {
    fetch(apiUrl('/api/routes'))
      .then(res => res.json())
      .then(data => setRoutes(data))
      .catch(err => console.error('Routes fetch error:', err));
  }, []);

  // When a route is clicked, fetch its shape and stops
  const handleRouteClick = async (r) => {
    setSelectedRoute(r);
    setIsLoadingStops(true);

    try {
      // 1. Fetch shape
      const shapeRes = await fetch(apiUrl(`/api/routes/${r.route_id}/shape`));
      if (shapeRes.ok) {
        const shapeData = await shapeRes.json();
        onSelectRoute(r, shapeData);
      }

      // 2. Fetch stops
      const stopsRes = await fetch(apiUrl(`/api/routes/${r.route_id}/stops`));
      if (stopsRes.ok) {
        const stopsData = await stopsRes.json();
        setRouteStops(stopsData);
        // default to first available direction
        const dirs = Object.keys(stopsData.directions || {});
        if (dirs.length > 0) {
          setActiveDirection(Number(dirs[0]));
        }
      }
    } catch (err) {
      console.error('Error fetching route details:', err);
    } finally {
      setIsLoadingStops(false);
    }
  };

  // Filter routes
  const filteredRoutes = routes.filter(r => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      const matchName = r.route_short_name && r.route_short_name.toUpperCase().includes(q);
      const matchLong = r.route_long_name && r.route_long_name.toUpperCase().includes(q);
      if (!matchName && !matchLong) return false;
    }

    if (typeFilter === 'METRO') {
      return r.route_type === 1 || ['MEA', 'MEB', 'MEB1', 'MEC'].includes(r.route_short_name);
    }
    if (typeFilter === 'TRAM') {
      return r.route_type === 0 || ['2', '3', '5', '8', '14', '19'].includes(r.route_short_name);
    }
    if (typeFilter === 'NIGHT') {
      return r.route_short_name && r.route_short_name.toUpperCase().startsWith('N');
    }
    if (typeFilter === 'BUS') {
      return r.route_type === 3 && !r.route_short_name.toUpperCase().startsWith('N');
    }

    return true;
  });

  return (
    <div>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedRoute && (
            <button className="btn-icon" onClick={() => { setSelectedRoute(null); setRouteStops(null); }}>
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="panel-title">
              {selectedRoute ? `Linea ${selectedRoute.route_short_name}` : 'Linee & Percorsi'}
            </h2>
            <p className="panel-subtitle">
              {selectedRoute ? (selectedRoute.route_long_name || 'Dettagli percorso e fermate') : '437 linee ufficiali ATAC / Roma Mobilità'}
            </p>
          </div>
        </div>

        {!selectedRoute && (
          <div className="search-wrapper">
            <Search size={18} className="search-icon-left" />
            <input
              type="text"
              className="search-input"
              placeholder="Cerca linea (es. 64, 451, Metro A)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {!selectedRoute ? (
        <>
          {/* Quick Filter Chips */}
          <div className="chips-row">
            <button
              className={`chip ${typeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setTypeFilter('ALL')}
            >
              Tutte ({routes.length})
            </button>
            <button
              className={`chip ${typeFilter === 'METRO' ? 'active' : ''}`}
              onClick={() => setTypeFilter('METRO')}
            >
              Metropolitana
            </button>
            <button
              className={`chip ${typeFilter === 'TRAM' ? 'active' : ''}`}
              onClick={() => setTypeFilter('TRAM')}
            >
              Tram
            </button>
            <button
              className={`chip ${typeFilter === 'BUS' ? 'active' : ''}`}
              onClick={() => setTypeFilter('BUS')}
            >
              Bus Urbani
            </button>
            <button
              className={`chip ${typeFilter === 'NIGHT' ? 'active' : ''}`}
              onClick={() => setTypeFilter('NIGHT')}
            >
              Notturni (n*)
            </button>
          </div>

          {/* Routes List */}
          <div style={{ paddingBottom: '20px' }}>
            {filteredRoutes.map((r) => (
              <div
                key={r.route_id}
                className="card"
                style={{ margin: '8px 16px', cursor: 'pointer' }}
                onClick={() => handleRouteClick(r)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="badge-route">
                      {r.route_short_name}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>
                        {r.route_long_name || `Linea ${r.route_short_name}`}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                        {r.agency_id ? `Gestore: ${r.agency_id}` : 'ATAC Roma'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {r.activeVehicles > 0 && (
                      <span className="brand-badge" style={{ fontSize: '11px' }}>
                        {r.activeVehicles} bus live
                      </span>
                    )}
                    <ChevronRight size={18} color="var(--color-outline)" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Selected Route Detail View */
        <div style={{ padding: '12px 16px 20px' }}>
          {routeStops && routeStops.directions && Object.keys(routeStops.directions).length > 1 && (
            <div className="chips-row" style={{ padding: '0 0 12px' }}>
              {Object.keys(routeStops.directions).map((dirId) => (
                <button
                  key={dirId}
                  className={`chip ${activeDirection === Number(dirId) ? 'active' : ''}`}
                  onClick={() => setActiveDirection(Number(dirId))}
                >
                  Direzione {Number(dirId) === 0 ? 'Andata' : 'Ritorno'}
                </button>
              ))}
            </div>
          )}

          <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-on-surface-variant)', marginBottom: '8px' }}>
            Fermate lungo il percorso ({routeStops?.directions?.[activeDirection]?.length || 0})
          </div>

          {routeStops?.directions?.[activeDirection]?.map((st) => (
            <div
              key={st.stop_id + st.stop_sequence}
              className="arrival-card"
              style={{ margin: '6px 0', cursor: 'pointer' }}
              onClick={() => onSelectStop(st)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--color-surface-container-highest)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 800
                }}>
                  {st.stop_sequence}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{st.stop_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                    Palina: <b>{st.stop_code || st.stop_id}</b>
                  </div>
                </div>
              </div>

              <button className="btn-tonal" style={{ fontSize: '11px', padding: '4px 10px' }}>
                Arrivi
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
