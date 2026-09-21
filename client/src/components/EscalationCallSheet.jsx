import React from 'react';

// Numbers in dialable form
const SHREYASH_CALL = '7304167033';
const SHREYASH_WA = 'https://wa.me/917304167033?text=' + encodeURIComponent('Hi, I need support. My Kibou conversation was just escalated.');
const TELEMANAS_CALL = '14416';
const KIRAN_CALL = '18005990019';

function BigCallButton({ href, primary, title, subtitle }) {
  return (
    <a
      href={href}
      className={`btn ${primary ? 'btn-danger' : 'btn-secondary'} btn-block`}
      style={{ padding: '14px 16px', fontSize: '1rem', textDecoration: 'none', marginBottom: '8px' }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
        <span>{title}</span>
        <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.85 }}>{subtitle}</span>
      </span>
    </a>
  );
}

// mode: 'whatsapp' (peer-escalated → Shreyash WhatsApp first)
//       'helplines' (severe or AI chat → professional helplines first)
//       'all' (escalator / fallback → everything, no preselection)
export default function EscalationCallSheet({ sheet, onClose }) {
  if (!sheet) return null;

  const { mode, reason } = sheet;
  const showShreyashFirst = mode === 'whatsapp';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Get help right now</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
          {reason}
        </p>

        {showShreyashFirst ? (
          <>
            <BigCallButton
              href={SHREYASH_WA}
              primary
              title="WhatsApp Shreyash"
              subtitle="Opens WhatsApp chat — 7304167033"
            />
            <BigCallButton
              href={`tel:${SHREYASH_CALL}`}
              title="Call Shreyash"
              subtitle="Opens dialer — 7304167033"
            />
            <BigCallButton
              href={`tel:${TELEMANAS_CALL}`}
              title="Call Tele-MANAS: 14416"
              subtitle="Govt. helpline, toll-free 24/7"
            />
          </>
        ) : (
          <>
            <BigCallButton
              href={`tel:${TELEMANAS_CALL}`}
              primary
              title="Call Tele-MANAS: 14416"
              subtitle="Opens dialer — toll-free, 24/7"
            />
            <BigCallButton
              href={`tel:${KIRAN_CALL}`}
              title="Call KIRAN: 1800-599-0019"
              subtitle="Opens dialer — toll-free, 24/7"
            />
            <BigCallButton
              href={SHREYASH_WA}
              title="WhatsApp Shreyash"
              subtitle="Opens WhatsApp chat — 7304167033"
            />
          </>
        )}

        <button onClick={onClose} className="btn btn-outline btn-block" style={{ marginTop: '8px' }}>
          Not now
        </button>
      </div>
    </div>
  );
}
