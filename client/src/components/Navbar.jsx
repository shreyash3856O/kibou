import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  HeartHandshake, 
  MessageSquare, 
  Sparkles, 
  ShieldAlert, 
  Compass, 
  Layers, 
  PhoneCall, 
  Wind, 
  Lock 
} from 'lucide-react';

export default function Navbar() {
  const { 
    currentView, 
    setCurrentView, 
    seekerSession, 
    helperSession,
    setShowHotlinesModal,
    setShowBreathingModal
  } = useApp();

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(8, 12, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-glass)',
      padding: '12px 0'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Brand Logo */}
        <div 
          onClick={() => setCurrentView('seeker')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer'
          }}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #0d9488 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.35)'
          }}>
            <HeartHandshake size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.35rem',
                fontWeight: '800',
                letterSpacing: '-0.03em',
                color: '#ffffff'
              }}>
                Seeker
              </span>
              <span className="badge badge-emerald" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                <Lock size={10} /> Anonymous
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Peer Mental Health & Support
            </div>
          </div>
        </div>

        {/* Center Role Navigation */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-full)',
          padding: '4px',
          gap: '4px'
        }}>
          <button
            onClick={() => setCurrentView('seeker')}
            className={`btn ${currentView === 'seeker' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '7px 16px', fontSize: '0.84rem' }}
          >
            <MessageSquare size={15} />
            <span>Seek Help</span>
          </button>

          <button
            onClick={() => setCurrentView('helper')}
            className={`btn ${currentView === 'helper' ? 'btn-teal' : 'btn-ghost'}`}
            style={{ padding: '7px 16px', fontSize: '0.84rem' }}
          >
            <Sparkles size={15} />
            <span>Give Help</span>
          </button>

          <button
            onClick={() => setCurrentView('admin')}
            className={`btn ${currentView === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              padding: '7px 16px',
              fontSize: '0.84rem',
              background: currentView === 'admin' ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : 'transparent'
            }}
          >
            <ShieldAlert size={15} />
            <span>Counselor Portal</span>
          </button>

          <button
            onClick={() => setCurrentView('resources')}
            className={`btn ${currentView === 'resources' ? 'btn-outline' : 'btn-ghost'}`}
            style={{ padding: '7px 16px', fontSize: '0.84rem' }}
          >
            <Compass size={15} />
            <span>Wellness Tools</span>
          </button>

          <button
            onClick={() => setCurrentView('simulator')}
            className={`btn ${currentView === 'simulator' ? 'btn-outline' : 'btn-ghost'}`}
            style={{ padding: '7px 14px', fontSize: '0.84rem' }}
            title="Split-screen Seeker and Helper live simulator"
          >
            <Layers size={15} />
            <span>Live Test</span>
          </button>
        </nav>

        {/* Right Tools & Hotlines */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowBreathingModal(true)}
            className="btn btn-ghost"
            style={{
              padding: '7px 12px',
              fontSize: '0.8rem',
              border: '1px solid var(--border-glass)'
            }}
            title="4-7-8 Breathing Pacer"
          >
            <Wind size={15} color="#14b8a6" />
            <span>Breathe</span>
          </button>

          <button
            onClick={() => setShowHotlinesModal(true)}
            className="btn btn-danger crisis-pulse"
            style={{
              padding: '7px 16px',
              fontSize: '0.84rem',
              fontWeight: '700'
            }}
          >
            <PhoneCall size={15} />
            <span>988 Crisis Line</span>
          </button>
        </div>
      </div>
    </header>
  );
}
