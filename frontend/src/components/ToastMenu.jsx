import React from 'react';
import {
  Clock,
  Radio,
  Route as RouteIcon,
  MapPin,
  AlertTriangle,
  X,
  Locate,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function ToastMenu({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  onRequestLocation,
  isLocating = false,
  vehiclesCount = 0
}) {
  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'ARRIVALS',
      title: 'Palina',
      subtitle: 'Arrivi e passaggi in tempo reale per fermata',
      icon: Clock,
      color: '#8e1823',
      badge: 'Live'
    },
    {
      id: 'RADAR',
      title: 'Radar GPS',
      subtitle: 'Bus e tram in movimento sulla mappa di Roma',
      icon: Radio,
      color: '#1565c0',
      badge: vehiclesCount > 0 ? `${vehiclesCount} bus` : 'Live GPS'
    },
    {
      id: 'ROUTES',
      title: 'Linee',
      subtitle: 'Percorsi e fermate di Metro A, B, C, tram e bus',
      icon: RouteIcon,
      color: '#2e7d32',
      badge: 'Rete'
    },
    {
      id: 'NEARBY',
      title: 'Vicine',
      subtitle: 'Fermate attorno alla tua posizione GPS',
      icon: MapPin,
      color: '#e65100',
      badge: 'Dintorni'
    },
    {
      id: 'ALERTS',
      title: 'Avvisi',
      subtitle: 'Stato servizio, deviazioni e allerte ufficiali ATAC',
      icon: AlertTriangle,
      color: '#c62828',
      badge: 'Avvisi'
    }
  ];

  return (
    <div className="toast-menu-backdrop" onClick={onClose}>
      <div
        className="toast-menu-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Menù di navigazione rapida"
      >
        <div className="drag-pill" style={{ margin: '0 auto 12px' }} />

        {/* Header */}
        <div className="toast-menu-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-logo" style={{ width: '28px', height: '28px', fontSize: '14px' }}>R</div>
            <div>
              <h3 className="toast-menu-title">Menù Roma Transit by Fox</h3>
              <p className="toast-menu-subtitle">Seleziona la sezione desiderata</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            title="Chiudi menù"
            aria-label="Chiudi menù"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="toast-menu-list">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`toast-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
              >
                <div
                  className="toast-menu-icon-box"
                  style={{
                    backgroundColor: isActive ? 'var(--color-primary)' : `${item.color}15`,
                    color: isActive ? '#ffffff' : item.color
                  }}
                >
                  <Icon size={20} />
                </div>
                <div className="toast-menu-text">
                  <div className="toast-menu-item-title-row">
                    <span className="toast-menu-item-title">{item.title}</span>
                    <span className="toast-menu-badge">{item.badge}</span>
                  </div>
                  <span className="toast-menu-item-sub">{item.subtitle}</span>
                </div>
                <ChevronRight size={18} className="toast-menu-arrow" />
              </button>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="toast-menu-footer">
          <button
            type="button"
            className="toast-menu-gps-btn"
            onClick={() => {
              onRequestLocation();
              onClose();
            }}
          >
            <Locate size={18} className={isLocating ? 'spin' : ''} />
            <span>{isLocating ? 'Rilevamento GPS in corso...' : 'Rileva la mia Posizione GPS'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
