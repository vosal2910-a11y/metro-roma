import React, { useState, useEffect } from 'react';
import { Locate, MapPin, Footprints, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { apiUrl } from '../api.js';

export default function NearbyStops({
  userLocation,
  onRequestLocation,
  onSelectStop,
  onCenterStopOnMap,
  isLocating = false,
  radius = 500,
  onRadiusChange,
  onStopsUpdate
}) {
  const [nearbyStops, setNearbyStops] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Default coordinate if user hasn't shared GPS (Termini Central Station: 41.9010, 12.5002)
  const activeLat = userLocation?.lat || 41.9010;
  const activeLon = userLocation?.lon || 12.5002;

  const fetchNearby = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/stops/nearby?lat=${activeLat}&lon=${activeLon}&radius=${radius}`));
      if (res.ok) {
        const data = await res.json();
        setNearbyStops(data);
        if (onStopsUpdate) onStopsUpdate(data);
      }
    } catch (err) {
      console.error('Error fetching nearby stops:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNearby();
  }, [activeLat, activeLon, radius]);

  const handleSelectRadius = (r) => {
    if (onRadiusChange) onRadiusChange(r);
  };

  return (
    <div>
      <div className="panel-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="panel-title">Fermate Vicine</h2>
            <p className="panel-subtitle">
              {userLocation ? 'Basato sulla tua posizione GPS' : 'Posizione di default: Roma Termini'}
            </p>
          </div>
          <button
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={onRequestLocation}
            disabled={isLocating}
          >
            <Locate size={14} className={isLocating ? 'spin' : ''} />
            {isLocating ? 'Rilevamento...' : 'Rileva GPS'}
          </button>
        </div>
      </div>

      {/* Radius selector */}
      <div className="chips-row">
        {[300, 500, 800, 1200].map((r) => (
          <button
            key={r}
            className={`chip ${radius === r ? 'active' : ''}`}
            onClick={() => handleSelectRadius(r)}
          >
            Entro {r}m
          </button>
        ))}
      </div>

      {/* Results List */}
      <div style={{ paddingBottom: '20px' }}>
        <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase' }}>
            Paline trovate ({nearbyStops.length})
          </div>
          <button className="btn-icon" onClick={fetchNearby} title="Aggiorna">
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
        </div>

        {nearbyStops.map((st) => {
          const walkMin = Math.max(1, Math.round(st.distance / 75)); // ~4.5 km/h
          return (
            <div
              key={st.stop_id}
              className="card"
              style={{ margin: '8px 16px', cursor: 'pointer' }}
              onClick={() => onSelectStop(st)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="badge-code">
                    {st.stop_code || st.stop_id}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                      {st.stop_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span>Distanza: <b>{st.distance} m</b></span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Footprints size={12} /> ~{walkMin} min a piedi
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    className="btn-tonal"
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCenterStopOnMap(st);
                    }}
                  >
                    Mappa
                  </button>
                  <ChevronRight size={18} color="var(--color-outline)" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
