import React, { useState, useEffect } from 'react';
import { Wind, X, Play, Pause, RotateCcw } from 'lucide-react';

export default function BreathingPacer({ onClose }) {
  const [phase, setPhase] = useState('Inhale'); // Inhale (4s), Hold (7s), Exhale (8s)
  const [timer, setTimer] = useState(4);
  const [isActive, setIsActive] = useState(true);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  useEffect(() => {
    let interval = null;

    if (isActive) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev > 1) return prev - 1;

          // Transition phases
          if (phase === 'Inhale') {
            setPhase('Hold');
            return 7;
          } else if (phase === 'Hold') {
            setPhase('Exhale');
            return 8;
          } else {
            setPhase('Inhale');
            setCyclesCompleted((c) => c + 1);
            return 4;
          }
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, phase]);

  const getScale = () => {
    if (phase === 'Inhale') return 1.35;
    if (phase === 'Hold') return 1.35;
    return 0.85;
  };

  const getPhaseColor = () => {
    if (phase === 'Inhale') return '#6366f1';
    if (phase === 'Hold') return '#8b5cf6';
    return '#14b8a6';
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '30px',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <Wind size={22} color="#14b8a6" />
          <h3 style={{ fontSize: '1.4rem' }}>4-7-8 Breathing Pacer</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '30px' }}>
          Slow your nervous system and regain calm. Follow the circle guidance.
        </p>

        {/* Breathing Orb */}
        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            className="breathing-circle"
            style={{
              transform: `scale(${getScale()})`,
              borderColor: getPhaseColor(),
              boxShadow: `0 0 50px ${getPhaseColor()}55`,
              transition: phase === 'Inhale' ? 'transform 4s ease-out' : phase === 'Hold' ? 'none' : 'transform 8s ease-in'
            }}
          >
            <div>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2rem',
                fontWeight: '800',
                color: '#ffffff'
              }}>
                {phase}
              </div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: '700',
                color: getPhaseColor(),
                fontVariantNumeric: 'tabular-nums'
              }}>
                {timer}s
              </div>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: '20px',
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}>
          Cycles Completed: <strong style={{ color: '#ffffff' }}>{cyclesCompleted}</strong>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginTop: '20px'
        }}>
          <button
            onClick={() => setIsActive(!isActive)}
            className="btn btn-primary"
            style={{ padding: '10px 24px' }}
          >
            {isActive ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Resume</>}
          </button>

          <button
            onClick={() => {
              setPhase('Inhale');
              setTimer(4);
              setCyclesCompleted(0);
            }}
            className="btn btn-outline"
            style={{ padding: '10px 20px' }}
          >
            <RotateCcw size={16} /> Reset
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '10px 20px' }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
