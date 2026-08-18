import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wind, 
  Hand, 
  PhoneCall, 
  BookOpen, 
  ShieldCheck, 
  Heart, 
  Sparkles, 
  ExternalLink,
  MessageSquare
} from 'lucide-react';

export default function ResourcesHub() {
  const { 
    setShowHotlinesModal, 
    setShowBreathingModal, 
    setShowGroundingModal,
    setShowAdminChatModal 
  } = useApp();

  return (
    <div style={{ padding: '24px 0 60px' }}>
      <div className="container">
        
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 36px' }}>
          <span className="badge badge-teal" style={{ marginBottom: '8px' }}>
            <Sparkles size={12} /> Student Wellness Hub
          </span>
          <h1 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '8px' }}>
            Self-Care & Grounding Tools
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
            Immediate interactive coping techniques, guided exercises, and verified crisis resources whenever you need balance.
          </p>
        </div>

        {/* Interactive Coping Tools Grid */}
        <div className="grid-cols-3" style={{ gap: '20px', marginBottom: '36px' }}>
          
          {/* Tool 1: 4-7-8 Breathing */}
          <div className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '14px',
                background: 'rgba(20, 184, 166, 0.15)',
                color: '#14b8a6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <Wind size={26} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
                4-7-8 Breathing Pacer
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
                Inhale 4s, hold 7s, exhale 8s. Scientifically proven to slow your heart rate and regulate anxiety.
              </p>
            </div>

            <button
              onClick={() => setShowBreathingModal(true)}
              className="btn btn-teal"
              style={{ width: '100%' }}
            >
              Start Breathing Pacer →
            </button>
          </div>

          {/* Tool 2: 5-4-3-2-1 Grounding */}
          <div className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '14px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <Hand size={26} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
                5-4-3-2-1 Grounding Tool
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
                Re-anchor your senses during panic or racing thoughts by engaging sight, touch, sound, smell, and taste.
              </p>
            </div>

            <button
              onClick={() => setShowGroundingModal(true)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Launch Sensory Grounding →
            </button>
          </div>

          {/* Tool 3: Campus Counselor */}
          <div className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '14px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <ShieldCheck size={26} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
                Campus Counselor Direct
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px' }}>
                Send a confidential message to the student counseling office for support, appointment scheduling, or academic accommodations.
              </p>
            </div>

            <button
              onClick={() => setShowAdminChatModal(true)}
              className="btn btn-outline"
              style={{ width: '100%', borderColor: '#10b981', color: '#34d399' }}
            >
              Message Counselor →
            </button>
          </div>

        </div>

        {/* 24/7 Helplines Highlight */}
        <div className="glass-card" style={{
          padding: '32px',
          background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(99, 102, 241, 0.08))',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <PhoneCall size={20} color="#f43f5e" />
              <h3 style={{ fontSize: '1.3rem', color: '#ffffff' }}>
                Immediate 24/7 Crisis Helplines
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '550px' }}>
              Call or text <strong>988</strong> (USA), text <strong>HOME to 741741</strong>, or reach <strong>AASRA / Tele-MANAS</strong> in India. Confidential, free, and always open.
            </p>
          </div>

          <button
            onClick={() => setShowHotlinesModal(true)}
            className="btn btn-danger"
            style={{ padding: '12px 24px', fontSize: '0.95rem' }}
          >
            <PhoneCall size={16} /> Open Complete Hotline Directory
          </button>
        </div>

      </div>
    </div>
  );
}
