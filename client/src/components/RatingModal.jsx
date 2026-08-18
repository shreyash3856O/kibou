import React, { useState } from 'react';
import { Star, Heart, Sparkles, X, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

const TAGS = [
  'Empathetic Listener',
  'Felt Safe & Heard',
  'Patient & Kind',
  'Helpful Perspective',
  'Non-Judgmental',
  'Grounding Energy'
];

export default function RatingModal({ conversation, raterRole, onSubmit, onClose }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = () => {
    const fullFeedback = [
      selectedTags.length > 0 ? `Tags: ${selectedTags.join(', ')}` : '',
      feedback
    ].filter(Boolean).join(' | ');

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (e) {}

    setSubmitted(true);
    setTimeout(() => {
      onSubmit(rating, fullFeedback);
    }, 1000);
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
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px' }}
          >
            <X size={20} />
          </button>
        )}

        {!submitted ? (
          <div>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <Heart size={26} />
            </div>

            <h3 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>
              How was your peer connection?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Your feedback is 100% anonymous and helps maintain our safe, caring community.
            </p>

            {/* Star Rating */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <Star
                    size={34}
                    fill={(hoverRating || rating) >= star ? '#fbbf24' : 'transparent'}
                    color={(hoverRating || rating) >= star ? '#fbbf24' : 'rgba(255, 255, 255, 0.2)'}
                  />
                </button>
              ))}
            </div>

            {/* Supportive Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="badge"
                    style={{
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #818cf8' : '1px solid var(--border-glass)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      padding: '6px 12px'
                    }}
                  >
                    {isSelected && <Check size={12} />} {tag}
                  </button>
                );
              })}
            </div>

            {/* Optional text feedback */}
            <textarea
              placeholder="Optional notes or appreciation..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleSubmit}
                className="btn btn-primary"
                style={{ padding: '10px 30px' }}
              >
                <Sparkles size={16} /> Submit Feedback
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 0' }}>
            <h3 style={{ fontSize: '1.4rem', color: '#10b981', marginBottom: '8px' }}>
              Thank you for sharing
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Your rating has been safely recorded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
