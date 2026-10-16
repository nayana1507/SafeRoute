'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Bell,
  Bike,
  Check,
  ChevronDown,
  Clock3,
  CloudRain,
  Crosshair,
  Gauge,
  Info,
  Layers3,
  MapPin,
  Menu,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  Umbrella,
  Users,
  X,
} from 'lucide-react'

type Risk = 'low' | 'moderate' | 'high'
type Segment = { id: string; name: string; risk: Risk; score: number; d: string; zone: string; factors: string[] }

type RouteOption = {
  id: string
  label: string
  title: string
  score: number
  risk: Risk
  distance: string
  duration: string
  extra: string
  coverage: string
  note: string
  segments: Segment[]
}

const locations = ['Edappally Junction', 'Palarivattom', 'Kaloor Stadium', 'Kakkanad InfoPark', 'Kalamassery Metro']
const colors = { low: '#2e9d78', moderate: '#d39b3e', high: '#db5c5c' }

const routeOptions: RouteOption[] = [
  {
    id: 'balanced', label: 'Recommended', title: 'Balanced route', score: 34, risk: 'low', distance: '8.4 km', duration: '24 min', extra: '+2 min', coverage: '92%', note: 'Good trade-off between exposure and travel time.',
    segments: [
      { id: 's1', name: 'Edappally Toll → Pipeline Junction', risk: 'low', score: 24, d: '2.1 km', zone: 'Edappally North', factors: ['Good lighting', 'High footfall'] },
      { id: 's2', name: 'Pipeline Junction → Palarivattom', risk: 'moderate', score: 42, d: '2.8 km', zone: 'Palarivattom East', factors: ['Lower footfall after 9 PM', 'Rain exposure'] },
      { id: 's3', name: 'Palarivattom → Kakkanad', risk: 'low', score: 29, d: '3.5 km', zone: 'Vyttila Connector', factors: ['Well-lit arterial', 'Active businesses'] },
    ],
  },
  {
    id: 'fastest', label: 'Fastest', title: 'Quickest route', score: 41, risk: 'moderate', distance: '7.8 km', duration: '22 min', extra: 'Fastest', coverage: '89%', note: 'Shortest travel time with one higher-exposure stretch.',
    segments: [
      { id: 'f1', name: 'Edappally → Kaloor', risk: 'low', score: 27, d: '2.2 km', zone: 'Edappally South', factors: ['High footfall'] },
      { id: 'f2', name: 'Kaloor → Palarivattom Bypass', risk: 'high', score: 66, d: '1.7 km', zone: 'Kaloor Bypass', factors: ['Poor lighting', 'Low late-night footfall'] },
      { id: 'f3', name: 'Bypass → Kakkanad', risk: 'moderate', score: 39, d: '3.9 km', zone: 'Palarivattom West', factors: ['Rain exposure'] },
    ],
  },
  {
    id: 'safer', label: 'Lowest index', title: 'Lower-risk route', score: 29, risk: 'low', distance: '9.6 km', duration: '29 min', extra: '+7 min', coverage: '94%', note: 'Lowest relative index; adds a longer, better-covered loop.',
    segments: [
      { id: 'a1', name: 'Edappally → Kalamassery', risk: 'low', score: 18, d: '3.0 km', zone: 'Kalamassery Central', factors: ['Good lighting', 'Active businesses'] },
      { id: 'a2', name: 'Kalamassery → Seaport Road', risk: 'low', score: 31, d: '3.2 km', zone: 'Kalamassery East', factors: ['High footfall'] },
      { id: 'a3', name: 'Seaport Road → Kakkanad', risk: 'moderate', score: 38, d: '3.4 km', zone: 'Kakkanad West', factors: ['Lower footfall after 9 PM'] },
    ],
  },
]

function RiskBadge({ risk, score }: { risk: Risk; score?: number }) {
  return <span className={`risk-badge ${risk}`}><span className="risk-dot" />{score ?? ({ low: 25, moderate: 50, high: 75 }[risk])} · {risk}</span>
}

function IconButton({ children, label }: { children: React.ReactNode; label: string }) {
  return <button className="icon-button" aria-label={label}>{children}</button>
}

export default function Page() {
  const [selectedRoute, setSelectedRoute] = useState('balanced')
  const [selectedSegment, setSelectedSegment] = useState('s2')
  const [rain, setRain] = useState(true)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [safetyState, setSafetyState] = useState<'ready' | 'started' | 'pending' | 'escalated'>('ready')
  const [showZones, setShowZones] = useState(false)
  const [departure, setDeparture] = useState('Now · 8:40 PM')

  const route = useMemo(() => routeOptions.find((item) => item.id === selectedRoute) ?? routeOptions[0], [selectedRoute])
  const segment = route.segments.find((item) => item.id === selectedSegment) ?? route.segments[0]
  const highSegment = route.segments.reduce((a, b) => a.score > b.score ? a : b)

  function selectRoute(id: string) {
    setSelectedRoute(id)
    const next = routeOptions.find((item) => item.id === id)
    if (next) setSelectedSegment(next.segments[1]?.id ?? next.segments[0].id)
  }

  function startSafety() { setSafetyState(safetyState === 'ready' ? 'started' : 'pending') }
  function resetSafety() { setSafetyState('ready') }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><ShieldCheck size={19} strokeWidth={2.5} /></div><span>SafeRoute</span><span className="brand-beta">BETA</span></div>
        <div className="workspace-label">DELIVERY CONSOLE</div>
        <nav aria-label="Main navigation">
          <button className="nav-item active"><Navigation size={17} />Route dashboard</button>
          <button className="nav-item" onClick={() => setShowZones(!showZones)}><Layers3 size={17} />Nearby zones <span className="nav-chevron">{showZones ? '−' : '+'}</span></button>
          <button className="nav-item"><Gauge size={17} />Model insights</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card"><div className="demo-icon"><Sparkles size={15} /></div><div><strong>Demo environment</strong><p>Using simulated route data</p></div></div>
          <button className="profile"><span className="avatar">AR</span><span><strong>Ananya Rao</strong><small>Delivery partner</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      {mobileMenu && <button className="scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
      <main className="main-content">
        <header className="topbar"><div className="topbar-left"><IconButton label="Open navigation"><Menu size={19} onClick={() => setMobileMenu(true)} /></IconButton><div><p className="eyebrow">ACTIVE DELIVERY</p><h1>Route safety dashboard</h1></div></div><div className="topbar-actions"><span className="status-pill"><span className="status-pulse" />Model online</span><span className="demo-pill">SIMULATED DATA</span><IconButton label="Notifications"><Bell size={18} /></IconButton></div></header>

        <section className="planner card">
          <div className="planner-title"><div className="section-icon teal"><Navigation size={18} /></div><div><h2>Plan a delivery route</h2><p>Compare routes with relative safety indicators</p></div></div>
          <div className="planner-fields">
            <label className="field"><span>Pickup location</span><div className="select-wrap"><MapPin size={15} /><select defaultValue="Edappally Junction"><option>Edappally Junction</option><option>Palarivattom</option><option>Kaloor Stadium</option></select><ChevronDown size={14} /></div></label>
            <ArrowRight className="route-arrow" size={17} />
            <label className="field"><span>Customer destination</span><div className="select-wrap"><MapPin size={15} /><select defaultValue="Kakkanad InfoPark"><option>Kakkanad InfoPark</option><option>Edappally Junction</option><option>Kalamassery Metro</option></select><ChevronDown size={14} /></div></label>
            <label className="field time-field"><span>Departure</span><div className="select-wrap"><Clock3 size={15} /><select value={departure} onChange={(e) => setDeparture(e.target.value)}><option>Now · 8:40 PM</option><option>9:30 PM</option><option>Tomorrow · 8:00 AM</option></select><ChevronDown size={14} /></div></label>
            <button className={`rain-toggle ${rain ? 'on' : ''}`} onClick={() => setRain(!rain)} aria-pressed={rain}><CloudRain size={16} /><span>Rain</span><span className="toggle"><span /></span></button>
            <button className="primary-button"><RefreshCw size={15} /> Recalculate</button>
          </div>
        </section>

        <div className="content-grid">
          <section className="map-card card"><div className="card-heading"><div><h2>Edappally Junction <span className="heading-arrow">→</span> Kakkanad InfoPark</h2><p>Showing {route.title.toLowerCase()} · {route.distance} · {route.duration}</p></div><IconButton label="Map layers"><Layers3 size={17} /></IconButton></div>
            <div className="map-wrap"><svg className="map-svg" viewBox="0 0 800 390" role="img" aria-label="Simulated route map from Edappally Junction to Kakkanad InfoPark">
              <rect width="800" height="390" fill="#e9f0ee" />
              <path d="M-30 82 C130 115 168 22 280 72 S460 120 550 66 S700 46 830 96" className="map-road major" /><path d="M-30 294 C94 253 138 330 248 275 S400 244 516 300 S686 326 830 266" className="map-road major" /><path d="M122 -20 C158 100 102 155 166 225 S210 338 188 420 M376 -10 C354 65 430 128 382 214 S342 322 366 410 M626 -20 C585 72 630 125 572 224 S596 330 548 410" className="map-road" /><path d="M0 178 C146 150 250 205 370 168 S574 147 800 191 M0 350 C148 324 275 370 408 345 S635 310 800 342" className="map-road" />
              <path d="M75 105 L173 127 L258 169" className="route-shadow" /><path d="M258 169 L384 201 L492 154" className="route-shadow" /><path d="M492 154 L591 187 L713 248" className="route-shadow" />
              <path d="M75 105 L173 127 L258 169" className={`route-line ${route.id === 'safer' ? 'soft' : ''}`} stroke={colors[route.segments[0].risk]} /><path d="M258 169 L384 201 L492 154" className="route-line" stroke={colors[route.segments[1].risk]} onClick={() => setSelectedSegment(route.segments[1].id)} /><path d="M492 154 L591 187 L713 248" className="route-line" stroke={colors[route.segments[2].risk]} onClick={() => setSelectedSegment(route.segments[2].id)} />
              <g className="map-labels"><text x="48" y="77">EDAPPALLY</text><text x="315" y="235">PALARIVATTOM</text><text x="650" y="284">KAKKANAD</text><text x="542" y="117">INFO PARK</text></g>
              <g className="marker pickup"><circle cx="75" cy="105" r="15" /><path d="M75 97v16M67 105h16" /></g><g className="marker destination"><circle cx="713" cy="248" r="15" /><path d="M713 240v16M705 248h16" /></g>
              <g className="segment-bubble"><rect x="348" y="176" width="74" height="30" rx="15" /><text x="385" y="196">{segment.score} index</text></g>
            </svg><div className="map-controls"><button><Crosshair size={16} /></button><button><span>+</span></button><button><span>−</span></button></div><div className="map-legend"><strong>Relative risk index</strong><span><i className="legend-dot low" />Lower</span><span><i className="legend-dot moderate" />Moderate</span><span><i className="legend-dot high" />Higher</span></div><div className="map-note"><Info size={13} /> Route geometry is simulated for this demo</div></div>
            <div className="map-footer"><span><MapPin size={14} /> Pickup confirmed</span><span><Navigation size={14} /> Destination set</span><span className="coverage"><span className="tiny-check"><Check size={11} /></span> Data coverage {route.coverage}</span></div>
          </section>

          <aside className="side-column"><section className="card comparison"><div className="card-heading"><div><p className="eyebrow">ROUTE OPTIONS</p><h2>Choose your route</h2></div><span className="options-count">3 options</span></div><div className="route-list">{routeOptions.map((option) => <button key={option.id} className={`route-option ${selectedRoute === option.id ? 'selected' : ''}`} onClick={() => selectRoute(option.id)}><div className="route-option-top"><span className={`option-radio ${selectedRoute === option.id ? 'checked' : ''}`}>{selectedRoute === option.id && <Check size={11} />}</span><div><strong>{option.title}</strong><span className="option-label">{option.label}</span></div><RiskBadge risk={option.risk} score={option.score} /></div><div className="route-metrics"><span><Navigation size={13} />{option.distance}</span><span><Timer size={13} />{option.duration}</span><span className={option.id === 'fastest' ? 'green-text' : ''}>{option.extra}</span></div><p className="route-note">{option.note}</p></button>)}</div><div className="comparison-foot"><Info size={14} />Recommendations balance index, travel time, and coverage.</div></section></aside>
        </div>

        <div className="lower-grid"><section className="card summary-card"><div className="card-heading"><div><p className="eyebrow">SELECTED ROUTE · {route.title.toUpperCase()}</p><h2>Route safety summary</h2></div><RiskBadge risk={route.risk} score={route.score} /></div><div className="summary-stats"><div className="score-stat"><div className="score-ring"><strong>{route.score}</strong><span>/ 100</span></div><div><strong>Relative risk index</strong><p>Lower is a comparatively lower index</p></div></div><div className="stat"><span>Distance</span><strong>{route.distance}</strong><small>estimated route length</small></div><div className="stat"><span>Travel time</span><strong>{route.duration}</strong><small>at current context</small></div><div className="stat warning-stat"><span>Higher-risk stretch</span><strong>{highSegment.d}</strong><small>{highSegment.name.split(' → ')[0]} area</small></div></div><div className="coverage-bar"><div className="coverage-head"><span>Risk data coverage</span><strong>{route.coverage}</strong></div><div className="bar"><i style={{ width: route.coverage }} /></div><p><Info size={13} /> {100 - Number.parseInt(route.coverage)}% of the route has insufficient zone coverage. Scores are not assigned to unknown areas.</p></div></section>
          <section className="card segment-card"><div className="card-heading"><div><p className="eyebrow">SEGMENT INSPECTOR</p><h2>Why this route is risky</h2></div><span className="segment-id">{segment.id.toUpperCase()}</span></div><div className="segment-title"><div className={`segment-icon ${segment.risk}`}><AlertTriangle size={17} /></div><div><strong>{segment.name}</strong><p>{segment.zone} · {segment.d}</p></div><RiskBadge risk={segment.risk} score={segment.score} /></div><div className="factor-list">{segment.factors.map((factor) => <div key={factor}><Check size={14} />{factor}<span>model input</span></div>)}</div><p className="segment-disclaimer"><Info size={13} /> These factors are associated with the parent zone. They are not road-specific observations.</p></section></div>

        <div className="bottom-grid"><section className="card safety-card"><div className="safety-header"><div><p className="eyebrow">IN-TRIP SAFETY CHECK</p><h2>Delivery safety check-in</h2><p>This is a simulated workflow for demonstration only.</p></div><div className={`safety-status ${safetyState}`}><span />{safetyState === 'ready' ? 'Ready to start' : safetyState === 'started' ? 'Delivery active' : safetyState === 'pending' ? 'Check-in pending' : 'Escalation simulated'}</div></div><div className="steps"><div className="step done"><span><Check size={13} /></span><div><strong>Pickup confirmed</strong><small>Edappally Junction</small></div></div><div className={`step ${safetyState !== 'ready' ? 'done' : ''}`}><span>{safetyState !== 'ready' ? <Check size={13} /> : '2'}</span><div><strong>Delivery started</strong><small>{safetyState !== 'ready' ? 'Route is active' : 'Start when you leave pickup'}</small></div></div><div className={`step ${safetyState === 'pending' || safetyState === 'escalated' ? 'active' : ''}`}><span>{safetyState === 'pending' || safetyState === 'escalated' ? '!' : '3'}</span><div><strong>Next check-in</strong><small>{safetyState === 'pending' ? 'Response requested now' : 'In approximately 10 min'}</small></div></div></div><div className="safety-actions">{safetyState === 'ready' && <button className="primary-button" onClick={startSafety}><Bike size={16} /> Start delivery</button>}{safetyState === 'started' && <><button className="primary-button" onClick={() => setSafetyState('pending')}><Bell size={16} /> Request check-in</button><button className="secondary-button" onClick={() => setSafetyState('escalated')}><AlertTriangle size={16} /> Simulate missed check-in</button></>}{safetyState === 'pending' && <><button className="primary-button" onClick={() => setSafetyState('started')}><Check size={16} /> I&apos;m safe — check in</button><button className="danger-button" onClick={() => setSafetyState('escalated')}><AlertTriangle size={16} /> Simulate no response</button></>}{safetyState === 'escalated' && <div className="escalated-message"><AlertTriangle size={16} /><span><strong>Simulated escalation</strong><small>No emergency services are contacted.</small></span></div>}<button className="reset-button" onClick={resetSafety}><RefreshCw size={14} /> Reset demo</button></div></section><section className="card transparency-card"><div className="card-heading"><div><p className="eyebrow">MODEL TRANSPARENCY</p><h2>How to read this</h2></div><Info size={17} className="muted-icon" /></div><div className="model-row"><span className="model-avatar"><Gauge size={16} /></span><div><strong>Rule-based baseline</strong><p>Active scorer · synthetic data</p></div><span className="active-tag">ACTIVE</span></div><p className="transparency-copy">This relative index reuses zone-level signals and does not represent a probability of harm or a verified measure of street safety.</p><button className="text-button">View model limitations <ArrowDown size={14} /></button></section></div>
        {showZones && <section className="card zones-panel"><div className="card-heading"><div><p className="eyebrow">NEARBY ZONES</p><h2>Explore safety zones</h2></div><button className="icon-button" onClick={() => setShowZones(false)} aria-label="Close zones"><X size={17} /></button></div><div className="zone-chips">{locations.map((location, index) => <span key={location}><MapPin size={13} />{location}<RiskBadge risk={index === 2 ? 'moderate' : 'low'} score={index === 2 ? 47 : 28 + index} /></span>)}</div></section>}
        <footer><span><ShieldCheck size={14} /> SafeRoute · Route safety assistance for delivery partners</span><span>Predictions are relative estimates · Not emergency response</span></footer>
      </main>
    </div>
  )
}
