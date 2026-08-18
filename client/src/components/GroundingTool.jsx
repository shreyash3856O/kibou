import React, { useState } from 'react';
import { Eye, Hand, Volume2, Flower2, Coffee, CheckCircle2, X, Sparkles } from 'lucide-react';

const STEPS = [
  {
    step: 5,
    title: '5 Things You Can SEE',
    description: 'Look around you. Notice 5 distinct items (a plant, a shadow, a book, colors, textures).',
    icon: Eye,
    color: '#6366f1'
  },
  {
    step: 4,
    title: '4 Things You Can FEEL',
    description: 'Notice physical sensations (feet on the floor, texture of your shirt, cool air on skin).',
    icon: Hand,
    color: '#14b8a6'
  },
  {
    step: 3,
    title: '3 Things You Can HEAR',
    description: 'Listen closely. Listen for distant traffic, a hum of air, birds, or your own breathing.',
    icon: Volume2,
    color: '#8b5cf6'
  },
  {
    step: 2,
    title: '2 Things You Can SMELL',
    description: 'Notice smells in the air, coffee, fresh breeze, soap, or imagine your favorite scent.',
    icon: Flower2,
    color: '#f59e0b'
  },
  {
    step: 1,
    title: '1 Thing You Can TASTE',
    description: 'Notice the taste in your mouth, a sip of water, or reflect on a comforting taste.',
    icon: Coffee,
    color: '#10b981'
  }
];

export default function GroundingTool({ onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const stepData = STEPS[currentStepIndex];
  const StepIcon = stepData?.icon || Eye;

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setCompleted(true);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card" style={{
        maxWidth: '520px',
        width: '100%',
        padding: '32px',
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

        {!completed ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge badge-indigo">5-4-3-2-1 Technique</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Step {currentStepIndex + 1} of 5</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              margin: '24px 0 16px',
              padding: '20px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${stepData.color}44`
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: `${stepData.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: stepData.color,
                flexShrink: 0
              }}>
                <StepIcon size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '4px' }}>
                  {stepData.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {stepData.description}
                </p>
              </div>
            </div>

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '24px 0' }}>
              {STEPS.map((s, idx) => (
                <div
                  key={s.step}
                  style={{
                    width: idx === currentStepIndex ? '28px' : '10px',
                    height: '10px',
                    borderRadius: 'var(--radius-full)',
                    background: idx <= currentStepIndex ? stepData.color : 'rgba(255, 255, 255, 0.15)',
                    transition: 'all var(--transition-normal)'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleNext}
                className="btn btn-primary"
                style={{ padding: '10px 24px' }}
              >
                {currentStepIndex === STEPS.length - 1 ? 'Finish Grounding' : 'Next Step →'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Well Done</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 24px' }}>
              You brought your mind back into the present moment. Take a gentle breath before continuing.
            </p>

            <button
              onClick={onClose}
              className="btn btn-teal"
              style={{ padding: '10px 28px' }}
            >
              <Sparkles size={16} /> Return to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
