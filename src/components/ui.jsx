// ── Íconos SVG inline ────────────────────────────────────────────────────────
const PATHS = {
  dashboard : 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  orders    : 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  catalog   : 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  clients   : 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  plus      : 'M12 4v16m8-8H4',
  check     : 'M5 13l4 4L19 7',
  x         : 'M6 18L18 6M6 6l12 12',
  trash     : 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  search    : 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
  money     : 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  box       : 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  chevron   : 'M19 9l-7 7-7-7',
  spin      : 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z',
  edit      : 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
}

export function Icon({ name, size = 18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d={PATHS[name] || PATHS.x} />
    </svg>
  )
}

// ── Badge de estado ───────────────────────────────────────────────────────────
export function Badge({ ok, yes, no }) {
  return (
    <span style={{
      background : ok ? '#14532d' : '#3a1c1c',
      color      : ok ? '#4ade80' : '#f87171',
      borderRadius : 99, padding : '2px 10px',
      fontSize : 11, fontFamily : 'sans-serif', fontWeight : 600,
      whiteSpace : 'nowrap',
    }}>
      {ok ? yes : no}
    </span>
  )
}

// ── Botones ───────────────────────────────────────────────────────────────────
export const btn = {
  base    : { background:'#166534', color:'white', border:'none', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontSize:14, fontFamily:'sans-serif', fontWeight:600 },
  danger  : { background:'#7f1d1d', color:'white', border:'none', borderRadius:8, padding:'9px 18px', cursor:'pointer', fontSize:14, fontFamily:'sans-serif', fontWeight:600 },
  ghost   : { background:'transparent', color:'#9dc89a', border:'1px solid #2d4a2d', borderRadius:8, padding:'8px 16px', cursor:'pointer', fontSize:13, fontFamily:'sans-serif' },
}

// ── Input styles ──────────────────────────────────────────────────────────────
export const inputSt = {
  width:'100%', padding:'9px 12px',
  background:'#0d1710', border:'1px solid #2d4a2d',
  borderRadius:8, color:'#e8f5e9',
  fontSize:14, fontFamily:'sans-serif', outline:'none',
  marginBottom:14,
}
export const labelSt = {
  display:'block', color:'#6b9e6b', fontSize:12,
  fontFamily:'sans-serif', marginBottom:5, fontWeight:600,
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background:'#111d13', borderRadius:12,
      border:'1px solid #1e3a1e', overflow:'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
      <div>
        <h1 style={{ fontSize:24, color:'#e8f5e9', margin:'0 0 4px' }}>{title}</h1>
        {subtitle && <p style={{ color:'#6b9e6b', margin:0, fontFamily:'sans-serif', fontSize:14 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60 }}>
      <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"
        style={{ animation:'spin 0.8s linear infinite' }}>
        <path d="M12 2a10 10 0 1 0 10 10" />
      </svg>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )
}
