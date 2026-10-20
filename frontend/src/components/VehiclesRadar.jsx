import React, { useState } from 'react';
import { Bus, Compass, Gauge, MapPin, Search, Filter, Radio, ChevronRight } from 'lucide-react';

export default function VehiclesRadar({
  vehicles = [],
  filteredRouteId,
  onFilterRoute,
  onSelectVehicle
}) {
  const [searchFilter, setSearchFilter] = useState(filteredRouteId || '');
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, BUS, TRAM, METRO

  const popularLines = ['64', '40', '451', 'H', '170', '714', '90', '3', '8', 'MEA', 'MEB', 'MEC'];

  const handleSearchChange = (val) => {
    setSearchFilter(val);
    onFilterRoute(val.trim());
  };

  const filteredVehicles = vehicles.filter(v => {
    // Route search filter
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toUpperCase();
      const matchRoute = v.routeId && v.routeId.toUpperCase().includes(q);
      const matchMatricola = v.label && v.label.toUpperCase().includes(q);
      if (!matchRoute && !matchMatricola) return false;
    }

    // Type filter
    if (typeFilter === 'TRAM') {
      return ['2', '3', '5', '8', '14', '19'].includes(v.routeId);
    }
    if (typeFilter === 'METRO') {
      return ['MEA', 'MEB', 'MEB1', 'MEC', 'MA', 'MB', 'MC'].includes(v.routeId);
    }
    if (typeFilter === 'BUS') {
      const isTram = ['2', '3', '5', '8', '14', '19'].includes(v.routeId);
      const isMetro = ['MEA', 'MEB', 'MEB1', 'MEC', 'MA', 'MB', 'MC'].includes(v.routeId);
      return !isTram && !isMetro;
    }

    return true;
  });

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Radar Flotta Live ATAC</h2>
        <p className="panel-subtitle">Posizioni GPS reali trasmesse dai veicoli su strada</p>

        {/* Search Filter */}
        <div className="search-wrapper">
          <Search size={18} className="search-icon-left" />
          <input
            type="text"
            className="search-input"
            placeholder="Filtra per linea (es. 64, 451) o matricola..."
            value={searchFilter}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Quick Chips */}
      <div className="chips-row">
        <button
          className={`chip ${typeFilter === 'ALL' && !searchFilter ? 'active' : ''}`}
          onClick={() => { setTypeFilter('ALL'); handleSearchChange(''); }}
        >
          Tutti ({vehicles.length})
        </button>
        <button
          className={`chip ${typeFilter === 'BUS' ? 'active' : ''}`}
          onClick={() => setTypeFilter('BUS')}
        >
          Bus
        </button>
        <button
          className={`chip ${typeFilter === 'TRAM' ? 'active' : ''}`}
          onClick={() => setTypeFilter('TRAM')}
        >
          Tram
        </button>
        <button
          className={`chip ${typeFilter === 'METRO' ? 'active' : ''}`}
          onClick={() => setTypeFilter('METRO')}
        >
          Metro
        </button>

        {popularLines.map((line) => (
          <button
            key={line}
            className={`chip ${searchFilter.toUpperCase() === line ? 'active' : ''}`}
            onClick={() => handleSearchChange(line)}
          >
            {line}
          </button>
        ))}
      </div>

      {/* Status summary banner */}
      <div style={{ padding: '0 16px', margin: '4px 0 10px' }}>
        <div style={{
          background: 'var(--color-surface-container-high)',
          borderRadius: '12px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          fontWeight: 700
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} color="#2e7d32" />
            Veicoli in movimento trovati:
          </span>
          <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
            {filteredVehicles.length}
          </span>
        </div>
      </div>

      {/* Vehicles List */}
      <div style={{ paddingBottom: '20px' }}>
        {filteredVehicles.slice(0, 100).map((v, i) => (
          <div
            key={v.id || i}
            className="card"
            style={{ margin: '8px 16px', cursor: 'pointer' }}
            onClick={() => onSelectVehicle(v)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge-route">
                  {v.routeId || 'ATAC'}
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '14px' }}>
                    Matricola #{v.label || v.id}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Gauge size={12} /> {v.speed ? Math.round(v.speed * 3.6) + ' km/h' : 'In sosta'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Compass size={12} /> {v.bearing ? Math.round(v.bearing) + '°' : '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {v.stopId && (
                  <span className="badge-code" style={{ fontSize: '11px' }}>
                    Ferm. {v.stopId}
                  </span>
                )}
                <ChevronRight size={18} color="var(--color-outline)" />
              </div>
            </div>
          </div>
        ))}

        {filteredVehicles.length > 100 && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#666', padding: '8px' }}>
            Visualizzati i primi 100 veicoli di {filteredVehicles.length}. Usa il filtro per restringere la ricerca.
          </div>
        )}
      </div>
    </div>
  );
}
