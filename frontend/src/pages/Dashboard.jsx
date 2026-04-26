import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import supabase from '../supabase'
import Navbar from '../components/Navbar'
import FeedbackForm from '../components/FeedbackForm'
import './GlassUI.css'

const DEVICE_ID = 'argus-device-01'

export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const [device, setDevice] = useState(null)
  const [hazards, setHazards] = useState([])
  const [crashes, setCrashes] = useState([])
  const [rides, setRides] = useState([])
  const [form, setForm] = useState({ owner_name: '', phone: '', contact1: '', contact2: '', contact3: '', emergency1: '', emergency2: '' })
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState('profile')
  const [reportModal, setReportModal] = useState(null)
  const [reportLoading, setReportLoading] = useState(null)
  
  // Feedback state
  const [journeyData, setJourneyData] = useState(null)

  const BACKEND_URL = "http://localhost:8001"

  // Check for journey feedback on mount and when URL changes
  useEffect(() => {
    const feedbackParam = searchParams.get('feedback')
    const storedData = localStorage.getItem('journeyFeedback')
    
    console.log('Dashboard mounted/updated')
    console.log('Feedback param:', feedbackParam)
    console.log('Stored data:', storedData)
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        console.log('Setting journey data:', data)
        setJourneyData(data)
        setTab('feedback')
      } catch (e) {
        console.error('Error parsing journey data:', e)
      }
    }
  }, [searchParams])

  const handleFeedbackComplete = () => {
    localStorage.removeItem('journeyFeedback')
    setJourneyData(null)
    setTab('profile')
  }

  useEffect(() => {
    async function load() {
      const { data: d, error: ed } = await supabase.from('devices').select('*').eq('device_id', DEVICE_ID).single()
      const { data: h, error: eh } = await supabase.from('hazards').select('*').eq('device_id', DEVICE_ID).order('created_at', { ascending: false }).limit(50)
      const { data: c, error: ec } = await supabase.from('crashes').select('*').eq('device_id', DEVICE_ID).order('created_at', { ascending: false }).limit(20)
      const { data: r, error: er } = await supabase.from('rides').select('*').eq('device_id', DEVICE_ID).order('created_at', { ascending: false }).limit(10)
      
      console.log('Devices:', d, ed)
      console.log('Hazards:', h, eh)
      console.log('Crashes:', c, ec)
      console.log('Rides:', r, er)

      if (d) { setDevice(d); setForm(d) }
      if (h) setHazards(h)
      if (c) setCrashes(c)
      if (r) setRides(r)
    }
    load()
  }, [])

  async function saveDevice() {
    const payload = { ...form, device_id: DEVICE_ID }
    if (device) {
      await supabase.from('devices').update(payload).eq('device_id', DEVICE_ID)
    } else {
      await supabase.from('devices').insert(payload)
    }
    setDevice(payload)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function generateReport(crash) {
    setReportLoading(crash.id)
    try {
      const crashTime = new Date(crash.created_at)
      const nearby = hazards.filter(h => {
        const dist = Math.sqrt(
          Math.pow(h.lat - crash.lat, 2) + Math.pow(h.lng - crash.lng, 2)
        )
        const timeDiff = Math.abs(new Date(h.created_at) - crashTime) / 60000
        return dist < 0.01 && timeDiff < 10
      })

      const res = await fetch(`${BACKEND_URL}/api/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crash_id: crash.id,
          lat: crash.lat,
          lng: crash.lng,
          sms_sent: crash.sms_sent,
          created_at: crash.created_at,
          device_id: crash.device_id,
          nearby_hazards: nearby,
        })
      })
      const data = await res.json()
      if (data.success) {
        setReportModal({ crash, report: data.report })
      } else {
        alert("Report generation failed. Check backend.")
      }
    } catch (err) {
      alert("Could not reach backend. Is Railway deployed?")
      console.error(err)
    }
    setReportLoading(null)
  }

  function downloadReport(reportModal) {
    const content = `
ARGUS AI â€” INCIDENT REPORT
Generated: ${new Date().toLocaleString()}
Device: ${reportModal.crash.device_id}
=============================

POLICE FIR DRAFT
----------------
${reportModal.report.fir_draft}

=============================

INSURANCE CLAIM SUMMARY
------------------------
${reportModal.report.insurance_summary}

=============================

MEDICAL HANDOFF NOTE
---------------------
${reportModal.report.medical_handoff}
    `.trim()

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `argus-incident-${reportModal.crash.id?.slice(0, 8) || 'report'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }


  const topZones = hazards.reduce((acc, h) => {
    if (h.lat == null || h.lng == null) return acc;
    const key = `${h.lat.toFixed(3)},${h.lng.toFixed(3)}`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const sortedZones = Object.entries(topZones).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="page-bg-overlay pt-16">
      <Navbar />
      
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div className="liquid-glass glass-card shimmer" style={{ marginBottom: '30px' }}>
          <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 700 }}>Rider Dashboard</h2>
          <p style={{ opacity: 0.6, fontSize: '0.8rem', marginTop: '5px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'middle' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            NODE: <span style={{ color: 'var(--racing-red)', fontWeight: 'bold' }}>{DEVICE_ID}</span>
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '25px', flexWrap: 'wrap' }}>
            {['profile', 'hazards', 'crashes', 'rides', journeyData && 'feedback'].filter(Boolean).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`glass-button ${tab === t ? 'active' : ''}`}
                style={{ background: tab === t ? 'var(--imperial-blue)' : 'rgba(250,250,248,0.05)', flex: 1, minWidth: '100px' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {tab === 'profile' && (
          <div className="liquid-glass glass-card">
            <h3 style={{ marginTop: 0 }}>Device Registration</h3>
            <p style={{ opacity: 0.7, fontSize: '0.85rem', marginBottom: '25px' }}>Sync your device with emergency response networks.</p>
            {[
              { key: 'owner_name', label: 'Owner Name', placeholder: 'Full name' },
              { key: 'phone', label: 'Owner Phone', placeholder: '+91 XXXXXXXXXX' },
              { key: 'contact1', label: 'Family Contact 1', placeholder: '+91 XXXXXXXXXX' },
              { key: 'contact2', label: 'Family Contact 2', placeholder: '+91 XXXXXXXXXX' },
              { key: 'contact3', label: 'Family Contact 3', placeholder: '+91 XXXXXXXXXX' },
              { key: 'emergency1', label: 'Emergency Number 1', placeholder: '112 or hospital' },
              { key: 'emergency2', label: 'Emergency Number 2', placeholder: 'Local police' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: '15px' }}>
                <label className="glass-label">{label}</label>
                <input
                  className="glass-input"
                  value={form[key] || ''}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div style={{ marginTop: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button onClick={saveDevice} className="glass-button">
                {device ? 'Update Registration' : 'Register AI Node'}
              </button>
              {saved && <span style={{ color: '#44ff44', fontSize: '0.9rem', fontWeight: 'bold' }}>âœ“ Securely Synced</span>}
            </div>
          </div>
        )}

        {tab === 'hazards' && (
          <div className="liquid-glass glass-card">
            <h3 style={{ marginTop: 0 }}>Hazard Telemetry</h3>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
              {[
                { label: 'Potholes', count: hazards.filter(h => h.hazard_class === 'pothole').length, color: 'var(--racing-red)' },
                { label: 'Obstacles', count: hazards.filter(h => h.hazard_class === 'obstacle').length, color: '#888888' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ flex: 1, padding: '20px', background: 'rgba(250,250,248,0.03)', borderRadius: '15px', textAlign: 'center', border: '1px solid rgba(250,250,248,0.05)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: color }}>{count}</div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6 }}>{label}</div>
                </div>
              ))}
            </div>

            <h4 style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.8 }}>Critical Impact Zones</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sortedZones.length === 0
                ? <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Awaiting initial telemetry data...</p>
                : sortedZones.map(([coords, count]) => (
                  <div key={coords} style={{ padding: '12px 18px', borderRadius: '10px', background: 'rgba(237, 28, 36, 0.1)', borderLeft: '4px solid var(--racing-red)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {coords} â€” <b style={{ color: 'var(--racing-red)' }}>{count} DETECTED EVENTS</b>
                  </div>
                ))
              }
            </div>

            <div style={{ marginTop: '20px', padding: '15px', borderRadius: '12px', background: 'rgba(34, 176, 255, 0.05)', border: '1px solid rgba(0, 176, 255, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00b0ff', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                 AI Analytical Insight
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8, lineHeight: '1.5' }}>
                Computer Vision engine is processing frame-by-frame telemetry from <b>{DEVICE_ID}</b>. 
                Spatial hazard clusters are calculated using <b>DBSCAN density analysis</b> with a 0.05 confidence interval.
              </p>
            </div>

            <h4 style={{ marginTop: '30px', textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.8 }}>Recent Visual Detections</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
              {hazards.slice(0, 15).map(h => (
                <div key={h.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(250,250,248,0.05)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span><b>{h.hazard_class?.toUpperCase()}</b> â€” <span style={{ opacity: 0.7 }}>{h.confidence ? `${(h.confidence * 100).toFixed(0)}% accuracy` : 'Verified'}</span></span>
                  <span style={{ opacity: 0.5 }}>{new Date(h.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'crashes' && (
          <div className="liquid-glass glass-card">
            <h3 style={{ marginTop: 0 }}>SOS Incident Log</h3>
            {crashes.length === 0
              ? <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>
                No critical incidents recorded. Safe travels.
              </p>
              : crashes.map(c => (
                <div key={c.id} style={{
                  padding: '20px',
                  border: '1px solid rgba(237,28,36,0.3)',
                  borderRadius: '15px',
                  marginBottom: '15px',
                  background: 'rgba(237,28,36,0.05)'
                }}>
                  <div style={{
                    color: 'var(--racing-red)',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    CRITICAL INCIDENT LOGGED
                  </div>

                  <div style={{
                    fontSize: '0.85rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px'
                  }}>
                    <div>Coordinates: <b>{c.lat?.toFixed(4) || '--'}, {c.lng?.toFixed(4) || '--'}</b></div>
                    <div>Dispatch: <b style={{
                      color: c.sms_sent ? '#44ff44' : 'var(--racing-red)'
                    }}>{c.sms_sent ? 'COMPLETED' : 'FAILED'}</b></div>
                    <div style={{ gridColumn: 'span 2', opacity: 0.6 }}>
                      Timestamp: {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => generateReport(c)}
                    className="glass-button"
                    style={{
                      marginTop: '15px',
                      fontSize: '0.8rem',
                      padding: '10px 18px',
                      opacity: reportLoading === c.id ? 0.6 : 1
                    }}
                    disabled={reportLoading === c.id}
                  >
                    {reportLoading === c.id
                      ? 'â³ Generating Report...'
                      : 'ðŸ“„ Generate Incident Report'}
                  </button>
                </div>
              ))
            }

            {/* REPORT MODAL */}
            {reportModal && (
              <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.88)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}>
                <div className="liquid-glass glass-card" style={{
                  maxWidth: '720px',
                  width: '100%',
                  maxHeight: '88vh',
                  overflowY: 'auto',
                  position: 'relative'
                }}>

                  {/* Close button */}
                  <button
                    onClick={() => setReportModal(null)}
                    style={{
                      position: 'absolute',
                      top: '15px',
                      right: '18px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--floral-white)',
                      fontSize: '1.4rem',
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  >âœ•</button>

                  {/* Modal header */}
                  <div style={{ marginBottom: '25px' }}>
                    <h3 style={{
                      marginTop: 0,
                      color: 'var(--racing-red)',
                      letterSpacing: '3px',
                      textTransform: 'uppercase',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      Argus AI â€” Incident Intelligence
                    </h3>
                    <p style={{ opacity: 0.45, fontSize: '0.75rem', margin: 0 }}>
                      {new Date(reportModal.crash.created_at).toLocaleString()} Â·
                      {reportModal.crash.lat.toFixed(4)}, {reportModal.crash.lng.toFixed(4)}
                    </p>
                  </div>

                  {/* Three report sections */}
                  {[
                    { key: 'fir_draft', label: 'Police FIR Intelligence Draft', color: '#ED1C24', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
                    { key: 'insurance_summary', label: 'Insurance Liability Summary', color: '#ffcc44', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
                    { key: 'medical_handoff', label: 'Clinical Triage Note', color: '#44ddff', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
                  ].map(({ key, label, color, icon }) => (
                    <div key={key} style={{
                      marginBottom: '20px',
                      padding: '18px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${color}22`
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <b style={{
                          fontSize: '0.8rem',
                          textTransform: 'uppercase',
                          letterSpacing: '1.5px',
                          color: color,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>{icon}{label}</b>
                        <button
                          onClick={() => navigator.clipboard.writeText(
                            reportModal.report[key]
                          )}
                          className="glass-button"
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.7rem',
                            background: 'rgba(255,255,255,0.06)'
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      <p style={{
                        fontSize: '0.82rem',
                        lineHeight: '1.75',
                        opacity: 0.85,
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        color: 'var(--floral-white)'
                      }}>
                        {reportModal.report[key]}
                      </p>
                    </div>
                  ))}

                  {/* Download button */}
                  <button
                    onClick={() => downloadReport(reportModal)}
                    className="glass-button"
                    style={{ width: '100%', marginTop: '8px', letterSpacing: '1px' }}
                  >
                    â¬‡ Download Full Report as .txt
                  </button>

                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'rides' && (
          <div className="liquid-glass glass-card">
            <h3 style={{ marginTop: 0 }}>Voyage Analytics</h3>
            {rides.length === 0
              ? <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>No telemetry recorded for recent voyages.</p>
              : rides.map(r => (
                <div key={r.id} style={{ padding: '15px', border: '1px solid rgba(250,250,248,0.1)', borderRadius: '12px', marginBottom: '12px', background: 'rgba(250,250,248,0.02)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <b>ðŸï¸ MISSION {r.id.slice(0, 6).toUpperCase()}</b>
                    <span style={{ color: 'var(--floral-white)', fontWeight: 'bold' }}>{r.distance_km ? `${r.distance_km.toFixed(1)} KM` : '--'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}>
                    <span>Hazards Mitigated: <b>{r.hazards_encountered}</b></span>
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* FEEDBACK TAB */}
        {tab === 'feedback' && <FeedbackForm journeyData={journeyData} onComplete={handleFeedbackComplete} />}

      </div>
    </div>
  )
}
