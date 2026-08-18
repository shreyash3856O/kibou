import React, { useState } from 'react';
import { ShieldAlert, X, AlertCircle } from 'lucide-react';

const REASONS = [
  { value: 'unsafe_advice', label: 'Unsafe or Medical/Psychiatric Advice (Exceeding peer boundaries)' },
  { value: 'harassment', label: 'Disrespectful, Harassing, or Hostile Behavior' },
  { value: 'spam', label: 'Spam, Links, or Solicitations' },
  { value: 'off_topic', label: 'Inappropriate or Off-Topic Conduct' },
  { value: 'other', label: 'Other Safety Concern' }
];

export default function ReportModal({ conversationId, reporterSessionId, reporterRole, onSubmit, onClose }) {
  const [reason, setReason] = useState('unsafe_advice');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSubmit({
        conversation_id: conversationId,
        reporter_session_id: reporterSessionId,
        reporter_role: reporterRole,
        reason,
        description
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      alert('Report failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card" style={{
        maxWidth: '520px',
        width: '100%',
        padding: '30px',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px' }}
        >
          <X size={20} />
        </button>

        {!success ? (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.2)',
                color: '#f43f5e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>Report Conversation</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Confidential & Reviewed by Campus Staff within 24h
                </span>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              margin: '16px 0',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              <AlertCircle size={16} color="#fbbf24" style={{ flexShrink: 0 }} />
              <span>
                Your identity remains 100% anonymous to the other party. The conversation transcript will be submitted to moderators.
              </span>
            </div>

            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
              Primary Reason for Report:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: reason === r.value ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${reason === r.value ? '#6366f1' : 'var(--border-glass)'}`,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
              What happened? (Optional context):
            </label>
            <textarea
              placeholder="Describe what occurred to assist our counselors..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                height: '80px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                color: '#ffffff',
                padding: '10px',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                resize: 'none',
                marginBottom: '20px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-danger"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <h3 style={{ fontSize: '1.4rem', color: '#10b981', marginBottom: '8px' }}>
              Report Received
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Our moderation team has been notified and will review the chat logs promptly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
