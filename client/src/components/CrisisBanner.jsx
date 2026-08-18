import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, Phone, MessageSquare, ShieldCheck, X } from 'lucide-react';

export default function CrisisBanner({ onClose, customMessage }) {
  const { setShowAdminChatModal, setShowHotlinesModal } = useApp();

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)',
      border: '1px solid rgba(244, 63, 94, 0.4)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 18px',
      margin: '12px 0',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 30px rgba(244, 63, 94, 0.25)',
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(244, 63, 94, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f43f5e',
            flexShrink: 0
          }}>
            <AlertTriangle size={20} />
          </div>

          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '700',
              color: '#f43f5e',
              fontSize: '0.95rem'
            }}>
              <span>Confidential Crisis Support Available 24/7</span>
              <span className="badge badge-rose" style={{ fontSize: '0.7rem' }}>Immediate Care</span>
            </div>

            <p style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              marginTop: '4px',
              lineHeight: '1.4'
            }}>
              {customMessage || 'If you or someone you know is struggling or in distress, help is available. You are never alone.'}
            </p>

            {/* Quick Action Hotlines */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '10px'
            }}>
              <a
                href="tel:988"
                className="btn btn-danger"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                <Phone size={14} /> Call/Text 988 (Lifeline)
              </a>

              <a
                href="sms:741741?body=HOME"
                className="btn btn-outline"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  borderColor: 'rgba(244, 63, 94, 0.4)',
                  color: '#fda4af'
                }}
              >
                <MessageSquare size={14} /> Text HOME to 741741
              </a>

              <button
                onClick={() => setShowAdminChatModal(true)}
                className="btn btn-teal"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                <ShieldCheck size={14} /> Message Campus Counselor
              </button>

              <button
                onClick={() => setShowHotlinesModal(true)}
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                More Hotlines (India / Global) →
              </button>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '4px', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
