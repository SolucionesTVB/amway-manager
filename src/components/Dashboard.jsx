import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient.js'
import { Icon, Badge, Card, PageHeader, Spinner, btn } from './ui.jsx'
import { fmt } from '../catalog.js'

export default function Dashboard({ setView }) {
  const [stats,  setStats]  = useState(null)
  const [recent, setRecent] = useState([])
  const [loading,setLoading]= useState(true)

  useEffect(() => {
    async function load() {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, client_name, period, total, pagado_rafa, entregado_cliente, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!orders) { setLoading(false); return }

      const pendingPay      = orders.filter(o => !o.pagado_rafa)
      const pendingDeliver  = orders.filter(o => !o.entregado_cliente)
      const paid            = orders.filter(o =>  o.pagado_rafa)

      setStats({
        total          : orders.length,
        pendingPayCount: pendingPay.length,
        pendingPayAmt  : pendingPay.reduce((s,o) => s + o.total, 0),
        pendingDeliver : pendingDeliver.length,
        revenue        : paid.reduce((s,o) => s + o.total, 0),
      })
      setRecent(orders.slice(0, 6))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding:28 }}><Spinner /></div>

  return (
    <div style={{ padding:28 }} className="fade-in">
      <PageHeader
        title="¡Bienvenido! 👋"
        subtitle="Resumen general de tus pedidos Amway"
      />

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:28 }}>
        {[
          { label:'Total Pedidos',        value: stats?.total ?? 0,                 color:'#4ade80', icon:'orders'  },
          { label:'Sin cobrar',           value: stats?.pendingPayCount ?? 0,        color:'#f97316', icon:'money',
            sub: stats?.pendingPayAmt ? fmt(stats.pendingPayAmt) + ' pendientes' : '' },
          { label:'Sin entregar',         value: stats?.pendingDeliver ?? 0,         color:'#f59e0b', icon:'box'    },
          { label:'Total cobrado',        value: fmt(stats?.revenue ?? 0),           color:'#34d399', icon:'money', small:true },
        ].map(s => (
          <Card key={s.label} style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ color:s.color }}><Icon name={s.icon} size={18}/></span>
              <span style={{ color:'#6b9e6b', fontSize:12, fontFamily:'sans-serif' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: s.small ? 20 : 32, fontWeight:'bold', color:s.color }}>{s.value}</div>
            {s.sub && <div style={{ color:'#4a7a4a', fontSize:11, marginTop:4, fontFamily:'sans-serif' }}>{s.sub}</div>}
          </Card>
        ))}
      </div>

      {/* Recent orders */}
      {recent.length > 0 ? (
        <Card>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #1e3a1e', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:'bold', color:'#e8f5e9' }}>Pedidos Recientes</span>
            <button onClick={() => setView('orders')} style={{ ...btn.ghost, padding:'5px 12px', fontSize:12 }}>
              Ver todos →
            </button>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#0d1710' }}>
                {['Cliente','Total','Pagado','Entregado','Fecha'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', color:'#6b9e6b', fontSize:12, fontFamily:'sans-serif', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map(o => (
                <tr key={o.id} style={{ borderTop:'1px solid #1a2e1a' }}>
                  <td style={{ padding:'10px 16px', color:'#e8f5e9', fontSize:14 }}>{o.client_name}</td>
                  <td style={{ padding:'10px 16px', color:'#4ade80', fontWeight:'bold', fontFamily:'sans-serif', fontSize:13 }}>{fmt(o.total)}</td>
                  <td style={{ padding:'10px 16px' }}><Badge ok={o.pagado_rafa}       yes="✓ Pagado"    no="⏳ Pendiente"/></td>
                  <td style={{ padding:'10px 16px' }}><Badge ok={o.entregado_cliente} yes="✓ Entregado" no="📦 Pendiente"/></td>
                  <td style={{ padding:'10px 16px', color:'#6b9e6b', fontSize:12, fontFamily:'sans-serif' }}>
                    {new Date(o.created_at).toLocaleDateString('es-CR', { day:'2-digit', month:'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div style={{ textAlign:'center', padding:60, color:'#4a7a4a' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
          <div style={{ fontSize:18, marginBottom:8, color:'#9dc89a' }}>Aún no hay pedidos</div>
          <div style={{ fontSize:14, fontFamily:'sans-serif', marginBottom:20 }}>¡Empezá con tu primer pedido!</div>
          <button onClick={() => setView('new_order')} style={btn.base}>+ Nuevo Pedido</button>
        </div>
      )}
    </div>
  )
}
