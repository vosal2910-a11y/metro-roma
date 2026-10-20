import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, Info, ShieldAlert, CheckCircle } from 'lucide-react';
import { apiUrl } from '../api.js';

export default function AlertsFeed() {
  const [alerts, setAlerts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch(apiUrl('/api/alerts'))
      .then(res => res.json())
      .then(data => setAlerts(data.alerts || []))
      .catch(err => console.error('Alerts error:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredAlerts = alerts.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toUpperCase();
    const matchHeader = a.header && a.header.toUpperCase().includes(q);
    const matchDesc = a.description && a.description.toUpperCase().includes(q);
    const matchEntities = a.informedEntities && a.informedEntities.some(e => e.routeId && e.routeId.toUpperCase().includes(q));
    return matchHeader || matchDesc || matchEntities;
  });

  return (
    <div>
      <div className="panel-header">
        <h2 className="panel-title">Stato Rete & Allerte ATAC</h2>
        <p className="panel-subtitle">Feed ufficiale ServiceAlerts Protocol Buffers</p>

        <div className="search-wrapper">
          <Search size={18} className="search-icon-left" />
          <input
            type="text"
            className="search-input"
            placeholder="Cerca linea o parola chiave (es. 89, deviazione)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>
        Avvisi attivi ({filteredAlerts.length})
      </div>

      <div style={{ paddingBottom: '20px' }}>
        {filteredAlerts.map((alert, idx) => {
          const routeIds = (alert.informedEntities || [])
            .map(e => e.routeId)
            .filter(Boolean);

          return (
            <div
              key={alert.id || idx}
              className="card"
              style={{
                margin: '8px 16px',
                borderLeft: '4px solid #f57c00',
                background: 'var(--color-surface-container-low)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                <AlertTriangle size={18} color="#f57c00" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-on-surface)', lineHeight: 1.3 }}>
                    {alert.header}
                  </h4>

                  {routeIds.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
                      {routeIds.slice(0, 10).map((rId) => (
                        <span key={rId} className="badge-route" style={{ height: '22px', fontSize: '11px', padding: '0 6px' }}>
                          {rId}
                        </span>
                      ))}
                    </div>
                  )}

                  {alert.description && (
                    <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '6px', whiteSpace: 'pre-line' }}>
                      {alert.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredAlerts.length === 0 && !isLoading && (
          <div className="empty-state">
            <CheckCircle size={36} color="#2e7d32" />
            <div style={{ fontWeight: 700, fontSize: '14px' }}>Nessuna allerta per i filtri selezionati</div>
          </div>
        )}
      </div>
    </div>
  );
}
