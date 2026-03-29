import { useState, useEffect } from 'react'
import { Icon } from './ui.jsx'
import { supabase } from '../supabaseClient.js'

const NAV = [
  { id:'dashboard', label:'Dashboard',    icon:'dashboard' },
  { id:'new_order', label:'Nuevo Pedido', icon:'plus'      },
  { id:'orders',    label:'Pedidos',      icon:'orders'    },
  { id:'accounts',  label:'Cuentas',      icon:'clients'   },
  { id:'clients',   label:'Clientes',     icon:'clients'   },
  { id:'catalog',   label:'Catálogo',     icon:'catalog'   },
]

export default function Sidebar({ view, setView }) {
  const [pending, setPending] = useState(0)
  const [alerts,  setAlerts]  = useState(0)

  useEffect(() => {
    supabase
      .from('orders')
      .select('id', { count:'exact', head:true })
      .eq('pagado_rafa', false)
      .then(({ count }) => setPending(count || 0))

    supabase
      .from('client_reorder_patterns')
      .select('id, last_purchase, avg_days_reorder, product_code')
      .then(({ data }) => {
        if (!data) return
        const hoy = new Date()
        const cnt = data.filter(p => {
          const dias    = Math.floor((hoy - new Date(p.last_purchase)) / (1000*60*60*24))
          const duracion = p.avg_days_reorder || p.product_durations?.duration_days || 30
          return (dias / duracion) >= 0.8
        }).length
        setAlerts(cnt)
      })
  }, [view])

  return (
    <aside style={{
      width:'220px', background:'#111d13',
      borderRight:'1px solid #1e3a1e',
      display:'flex', flexDirection:'column',
      padding:'0 0 20px', flexShrink:0,
    }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid #1e3a1e' }}>
        <div style={{ color:'#4ade80', fontSize:11, letterSpacing:3, textTransform:'uppercase', marginBottom:4 }}>Amway</div>
        <div style={{ color:'#e8f5e9', fontSize:17, fontWeight:'bold', lineHeight:1.2 }}>Gestor de<br/>Pedidos</div>
        <div style={{ color:'#4ade80', fontSize:10, marginTop:4 }}>Costa Rica 2026</div>
      </div>

      <nav style={{ flex:1, padding:'16px 12px' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{
            width:'100%', display:'flex', alignItems:'center', gap:10,
            padding:'10px 12px', borderRadius:8, border:'none', cursor:'pointer',
            marginBottom:4, textAlign:'left', fontSize:14, fontFamily:'inherit',
            background : view === n.id ? '#1a4a1a' : 'transparent',
            color      : view === n.id ? '#4ade80' : '#9dc89a',
            transition : 'background 0.15s',
          }}>
            <Icon name={n.icon} size={16} />
            <span style={{ flex:1 }}>{n.label}</span>
            {n.id === 'orders' && pending > 0 && (
              <span style={{ background:'#dc2626', color:'white', borderRadius:99, fontSize:11, padding:'1px 7px', fontFamily:'sans-serif' }}>
                {pending}
              </span>
            )}
            {n.id === 'accounts' && alerts > 0 && (
              <span style={{ background:'#dc2626', color:'white', borderRadius:99, fontSize:11, padding:'1px 7px', fontFamily:'sans-serif' }}>
                {alerts}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={{ padding:'0 16px', color:'#4a7a4a', fontSize:11, fontFamily:'sans-serif' }}>
        v1.0 • Datos en Supabase ☁️
      </div>
    </aside>
  )
}
