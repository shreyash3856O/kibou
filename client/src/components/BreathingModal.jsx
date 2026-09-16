import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function BreathingModal() {
  const { showBreathingModal, setShowBreathingModal } = useApp();
  const [phase, setPhase] = useState('Inhale');
  const [timer, setTimer] = useState(4);
  const [active, setActive] = useState(true);

  useEffect(() => {
    let interval = null;
    if (active && showBreathingModal) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev > 1) return prev - 1;
          if (phase === 'Inhale') {
            setPhase('Hold');
            return 7;
          } else if (phase === 'Hold') {
            setPhase('Exhale');
            return 8;
          } else {
            setPhase('Inhale');
            return 4;
          }
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [active, phase, showBreathingModal]);

  if (!showBreathingModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowBreathingModal(false)}>
      <div className="modal-box" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem' }}>4-7-8 Breathing</h3>
          <button onClick={() => setShowBreathingModal(false)} className="icon-btn">✕</button>
        </div>

        <div style={{ padding: '30px 0' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '8px' }}>
            {phase}
          </div>
          <div style={{ fontSize: '3rem', fontWeight: '700', color: 'var(--text-muted)' }}>
            {timer}s
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button onClick={() => setActive(!active)} className="btn btn-secondary">
            {active ? 'Pause' : 'Resume'}
          </button>
          <button onClick={() => setShowBreathingModal(false)} className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
