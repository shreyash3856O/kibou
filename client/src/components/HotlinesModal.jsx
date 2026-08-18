import React from 'react';
import { useApp } from '../context/AppContext';

export default function HotlinesModal() {
  const { showHotlinesModal, setShowHotlinesModal, hotlines } = useApp();
  if (!showHotlinesModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowHotlinesModal(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.1rem' }}>24/7 Crisis Helplines</h3>
          <button onClick={() => setShowHotlinesModal(false)} className="icon-btn">✕</button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Free, confidential, and available at any time.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {hotlines.map((h, i) => (
            <div key={i} style={{ padding: '10px 12px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{h.name}</span>
                <span className="badge-pill">{h.country}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {h.type}: <strong style={{ color: 'var(--text-main)' }}>{h.number}</strong>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setShowHotlinesModal(false)} className="btn btn-secondary btn-block">
          Close
        </button>
      </div>
    </div>
  );
}
