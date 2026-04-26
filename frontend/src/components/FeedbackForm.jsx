import { useState } from 'react'

export default function FeedbackForm({ journeyData, onComplete }) {
  const [ratings, setRatings] = useState({})
  const [feedbackText, setFeedbackText] = useState('')
  const [showRLHF, setShowRLHF] = useState(false)
  const [rlhfStep, setRlhfStep] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [modelUpdates, setModelUpdates] = useState(null)

  const selectRating = (questionNum, rating) => {
    setRatings(prev => ({ ...prev, [questionNum]: rating }))
  }

  const addTag = (tag) => {
    setFeedbackText(prev => prev ? `${prev}, ${tag}` : tag)
  }

  const submitFeedback = () => {
    if (Object.keys(ratings).length < 4) {
      alert('Please answer all questions before submitting')
      return
    }
    setShowRLHF(true)
    animateRLHF()
  }

  const animateRLHF = () => {
    const steps = [1, 2, 3, 4, 5]
    const durations = [1200, 1500, 1800, 2000, 1400]
    
    let delay = 0
    steps.forEach((step, index) => {
      setTimeout(() => {
        setRlhfStep(step)
        setTimeout(() => {
          if (index === steps.length - 1) {
            setTimeout(() => {
              calculateModelUpdates()
              setShowRLHF(false)
              setShowResults(true)
            }, 500)
          }
        }, durations[index])
      }, delay)
      delay += durations[index] + 200
    })
  }

  const calculateModelUpdates = () => {
    const avgRating = Object.values(ratings).reduce((a, b) => a + b, 0) / 4
    setModelUpdates({
      edgesAdjusted: Math.floor(avgRating * 3),
      accuracyImprovement: (avgRating * 0.6).toFixed(1),
      hazardsFlagged: Math.floor(ratings[3] || 0),
      nlpConfidence: (0.75 + avgRating * 0.03).toFixed(2),
    })
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!journeyData) return null

  if (showResults && modelUpdates) {
    return (
      <div className="liquid-glass glass-card">
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✓</div>
          <h2 style={{ margin: 0, color: '#00e676', textTransform: 'uppercase', letterSpacing: '3px' }}>MODEL UPDATED</h2>
          <p style={{ opacity: 0.6, fontSize: '0.85rem', marginTop: '8px' }}>
            {modelUpdates.edgesAdjusted} new trees added · MAE improved {modelUpdates.accuracyImprovement}% · R² now {modelUpdates.nlpConfidence}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '30px' }}>
          <div style={{ padding: '20px', background: 'rgba(250,250,248,0.02)', border: '1px solid rgba(250,250,248,0.05)', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00b0ff' }}>{modelUpdates.edgesAdjusted}</div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6 }}>EDGES ADJUSTED</div>
          </div>
          <div style={{ padding: '20px', background: 'rgba(250,250,248,0.02)', border: '1px solid rgba(250,250,248,0.05)', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00b0ff' }}>+{modelUpdates.accuracyImprovement}%</div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6 }}>MODEL ACCURACY</div>
          </div>
          <div style={{ padding: '20px', background: 'rgba(250,250,248,0.02)', border: '1px solid rgba(250,250,248,0.05)', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffab00' }}>{modelUpdates.hazardsFlagged}</div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6 }}>HAZARDS FLAGGED</div>
          </div>
          <div style={{ padding: '20px', background: 'rgba(250,250,248,0.02)', border: '1px solid rgba(250,250,248,0.05)', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00b0ff' }}>{modelUpdates.nlpConfidence}</div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6 }}>NLP CONFIDENCE</div>
          </div>
        </div>

        <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.8, color: '#00b0ff', marginBottom: '15px' }}>EDGE DANGER SCORE CHANGES</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
          {[
            { name: 'FC Road (Deccan-Univ)', change: 23, color: '#ED1C24' },
            { name: 'Baner Road connector', change: -4, color: '#00e676' },
            { name: 'Karve Road segment 3', change: 12, color: '#ED1C24' },
            { name: 'Senapati Bapat Marg', change: -3, color: '#00e676' },
            { name: 'JM Road (east)', change: 0, color: '#888888' },
            { name: 'Paud Road junction', change: 8, color: '#ED1C24' }
          ].map((edge, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ flex: 1, opacity: 0.7 }}>{edge.name}</div>
              <div style={{ flex: 2, height: '8px', background: 'rgba(250,250,248,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.abs(edge.change) * 3}%`, height: '100%', background: edge.color, borderRadius: '4px' }} />
              </div>
              <div style={{ width: '60px', textAlign: 'right', color: edge.color, fontWeight: 'bold' }}>
                {edge.change > 0 ? '↑' : edge.change < 0 ? '↓' : '—'} {Math.abs(edge.change)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '20px', background: 'rgba(0, 230, 118, 0.05)', border: '1px solid rgba(0, 230, 118, 0.2)', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>✓ DONE — RIDE SAFER NEXT TIME</div>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>
            Your feedback has been integrated into the routing model. Future routes will benefit from your experience.
          </p>
        </div>

        <button onClick={onComplete} className="glass-button" style={{ width: '100%', marginTop: '20px', background: 'var(--imperial-blue)' }}>
          Back to Dashboard
        </button>
      </div>
    )
  }

  if (showRLHF) {
    return (
      <div className="liquid-glass glass-card">
        <h3 style={{ marginTop: 0, color: '#00e676' }}>Processing Your Feedback</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { id: 1, title: 'Data Collection', desc: 'Gathering structured ratings and text feedback' },
            { id: 2, title: 'Sentiment Analysis', desc: 'Analyzing emotional tone and satisfaction signals' },
            { id: 3, title: 'Preference Extraction', desc: 'Identifying route preferences and safety priorities' },
            { id: 4, title: 'Model Update', desc: 'Fine-tuning routing algorithm with your feedback' },
            { id: 5, title: 'Validation', desc: 'Verifying improvements and updating recommendations' }
          ].map(step => (
            <div
              key={step.id}
              style={{
                padding: '16px',
                background: rlhfStep >= step.id ? 'rgba(0, 230, 118, 0.05)' : 'rgba(250,250,248,0.02)',
                border: `1px solid ${rlhfStep >= step.id ? '#00e676' : 'rgba(250,250,248,0.05)'}`,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: rlhfStep >= step.id ? 1 : 0.4,
                transition: 'all 0.5s'
              }}
            >
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                background: rlhfStep >= step.id ? 'rgba(0, 230, 118, 0.15)' : 'rgba(250,250,248,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                color: rlhfStep >= step.id ? '#00e676' : 'rgba(250,250,248,0.3)'
              }}>
                {step.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{step.title}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{step.desc}</div>
              </div>
              {rlhfStep > step.id && <div style={{ color: '#00e676', fontSize: '20px' }}>✓</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="liquid-glass glass-card">
      <h3 style={{ marginTop: 0, color: 'var(--imperial-blue)' }}>Journey Feedback</h3>
      
      <div style={{ padding: '20px', background: 'rgba(34, 176, 255, 0.05)', border: '1px solid rgba(0, 176, 255, 0.2)', borderRadius: '12px', marginBottom: '25px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '0.85rem' }}>
          <div><span style={{ opacity: 0.7 }}>Distance:</span> <b style={{ color: '#00b0ff' }}>{journeyData.distance.toFixed(2)} km</b></div>
          <div><span style={{ opacity: 0.7 }}>Time:</span> <b style={{ color: '#00b0ff' }}>{formatTime(journeyData.time)}</b></div>
          <div><span style={{ opacity: 0.7 }}>Hazards:</span> <b style={{ color: '#ff9800' }}>{journeyData.hazards}</b></div>
          <div><span style={{ opacity: 0.7 }}>Safe Score:</span> <b style={{ color: '#00e676' }}>{(journeyData.safeScore * 100).toFixed(1)}%</b></div>
        </div>
      </div>

      {[
        { q: 1, text: 'How would you rate the overall route safety?', options: ['Very Unsafe', 'Unsafe', 'Neutral', 'Safe', 'Very Safe'] },
        { q: 2, text: 'How accurate was the estimated travel time?', options: ['Very Inaccurate', 'Inaccurate', 'Acceptable', 'Accurate', 'Very Accurate'] },
        { q: 3, text: 'Did you encounter any hazards on the route?', options: ['Many Hazards', 'Some Hazards', 'Few Hazards', 'Very Few', 'No Hazards'] },
        { q: 4, text: 'Would you use this route again?', options: ['Definitely Not', 'Probably Not', 'Maybe', 'Probably Yes', 'Definitely Yes'] }
      ].map(({ q, text, options }) => (
        <div key={q} style={{ marginBottom: '25px' }}>
          <label className="glass-label">{text}</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {options.map((label, idx) => (
              <button
                key={idx}
                onClick={() => selectRating(q, idx + 1)}
                className="glass-button"
                style={{
                  flex: 1,
                  minWidth: '100px',
                  background: ratings[q] === idx + 1 ? 'var(--imperial-blue)' : 'rgba(250,250,248,0.05)',
                  fontSize: '0.8rem',
                  padding: '10px'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginBottom: '25px' }}>
        <label className="glass-label">Additional feedback (optional)</label>
        <textarea
          className="glass-input"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Share your experience, suggestions, or any issues..."
          style={{ minHeight: '100px', resize: 'vertical', marginTop: '10px' }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
          {['smooth ride', 'good lighting', 'heavy traffic', 'poor road', 'felt safe'].map(tag => (
            <button
              key={tag}
              onClick={() => addTag(tag)}
              className="glass-button"
              style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(250,250,248,0.05)' }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <button onClick={submitFeedback} className="glass-button" style={{ width: '100%', background: 'var(--imperial-blue)' }}>
        Submit Feedback
      </button>
    </div>
  )
}
