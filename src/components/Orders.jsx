import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient.js'
import { fmt } from '../catalog.js'
import { Icon, Badge, Card, PageHeader, Spinner, btn, inputSt } from './ui.jsx'

const FILTERS = [
  { v:'todos',             l:'Todos' },
  { v:'pendiente_pago',    l:'💰 Sin cobrar' },
  { v:'pendiente_entrega', l:'📦 Sin entregar' },
  { v:'completo',          l:'✅ Completados' },
]

const STATUS_FIELDS = [
  { field:'entregado_tv',       label:'Entregado a TV'       },
  { field:'entregado_cliente',  label:'Entregado al cliente' },
  { field:'pagado_rafa',        label:'Pagado a mí (Rafa)'   },
  { field:'pagado_tv',          label:'Pagado a TV'          },
]

export default function Orders({ showToast }) {
  const [orders,   setOrders]  = useState([])
  const [loading,  setLoading] = useState(true)
  const [filter,   setFilter]  = useState('todos')
  const [search,   setSearch]  = useState('')
  const [expanded, setExpanded]= useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (field, id, current) => {
    await supabase.from('orders').update({ [field]: !current }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, [field]: !current } : o))
    showToast('Estado actualizado ✓')
  }

  const deleteOrder = async (id) => {
    if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return
    await supabase.from('orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
    setExpanded(null)
    showToast('Pedido eliminado')
  }

  const visible = orders
    .filter(o => {
      if (filter === 'pendiente_pago')    return !o.pagado_rafa
      if (filter === 'pendiente_entrega') return !o.entregado_cliente
      if (filter === 'completo')          return o.pagado_rafa && o.entregado_cliente
      return true
    })
    .filter(o => search === '' || o.client_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding:28 }} className="fade-in">
      <PageHeader title="Pedidos" subtitle="Controlá entregas y pagos de cada cliente" />

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        {FILTERS.map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)} style={{
            padding:'6px 14px', borderRadius:99, border:'none', cursor:'pointer',
            fontSize:13, fontFamily:'sans-serif',
            background: filter === f.v ? '#166534' : '#1a2e1a',
            color:      filter === f.v ? 'white'   : '#9dc89a',
          }}>{f.l}</button>
        ))}
        <div style={{ position:'relative', marginLeft:'auto' }}>
          <span style={{ position:'absolute', left:9, top:10, color:'#4a7a4a' }}><Icon name="search" size={14}/></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..."
            style={{ ...inputSt, marginBottom:0, paddingLeft:30, width:200 }}/>
        </div>
      </div>

      {loading && <Spinner />}

      {!loading && visible.length === 0 && (
        <div style={{ textAlign:'center', padding:50, color:'#4a7a4a', fontFamily:'sans-serif' }}>
          No hay pedidos con ese filtro
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {visible.map(o => (
          <Card key={o.id}>
            {/* Header del pedido */}
            <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
              onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:'bold', color:'#e8f5e9', fontSize:16 }}>{o.client_name}</span>
                  <span style={{ background:'#1a2e1a', color:'#4ade80', borderRadius:99, fontSize:11, padding:'1px 8px', fontFamily:'sans-serif' }}>
                    {o.client_type === 'empresario' ? '🏪 Empresario' : '👤 Cliente'}
                  </span>
                  <span style={{ color:'#4a7a4a', fontSize:12, fontFamily:'sans-serif' }}>{o.period}</span>
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ color:'#4ade80', fontWeight:'bold', fontFamily:'sans-serif' }}>{fmt(o.total)}</span>
                  <span style={{ color:'#6b9e6b', fontSize:12, fontFamily:'sans-serif' }}>
                    {(o.order_items || []).length} producto{(o.order_items || []).length !== 1 ? 's' : ''}
                  </span>
                  <Badge ok={o.pagado_rafa}       yes="✓ Pagado"    no="⏳ Sin cobrar"/>
                  <Badge ok={o.entregado_cliente} yes="✓ Entregado" no="📦 Sin entregar"/>
                </div>
              </div>
              <span style={{ color:'#4a7a4a', transform: expanded === o.id ? 'rotate(180deg)' : 'none', transition:'0.2s' }}>
                <Icon name="chevron" size={18}/>
              </span>
            </div>

            {/* Detalle expandido */}
            {expanded === o.id && (
              <div style={{ borderTop:'1px solid #1e3a1e', padding:'16px 18px' }} className="slide-in">

                {/* Tabla de productos */}
                <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:16 }}>
                  <thead>
                    <tr style={{ background:'#0d1710' }}>
                      {['Producto','P. Unitario','Cant','Total'].map(h => (
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#6b9e6b', fontSize:12, fontFamily:'sans-serif', fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(o.order_items || []).map(it => (
                      <tr key={it.id} style={{ borderTop:'1px solid #141f14' }}>
                        <td style={{ padding:'8px 12px', color:'#e8f5e9', fontSize:13 }}>{it.product_name}</td>
                        <td style={{ padding:'8px 12px', color:'#9dc89a', fontSize:13, fontFamily:'sans-serif' }}>{fmt(it.unit_price)}</td>
                        <td style={{ padding:'8px 12px', color:'#9dc89a', fontSize:13, fontFamily:'sans-serif' }}>{it.qty}</td>
                        <td style={{ padding:'8px 12px', color:'#4ade80', fontWeight:'bold', fontSize:13, fontFamily:'sans-serif' }}>{fmt(it.total)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop:'2px solid #2d4a2d' }}>
                      <td colSpan={3} style={{ padding:'10px 12px', fontWeight:'bold', color:'#e8f5e9', fontFamily:'sans-serif' }}>TOTAL</td>
                      <td style={{ padding:'10px 12px', fontWeight:'bold', color:'#4ade80', fontSize:16, fontFamily:'sans-serif' }}>{fmt(o.total)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Toggle de estados */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10, marginBottom:14 }}>
                  {STATUS_FIELDS.map(({ field, label }) => (
                    <button key={field} onClick={() => toggle(field, o.id, o[field])} style={{
                      display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
                      borderRadius:8, border:`1px solid ${o[field] ? '#166534' : '#2d4a2d'}`,
                      background: o[field] ? '#14532d' : '#0d1710',
                      cursor:'pointer', color: o[field] ? '#4ade80' : '#6b9e6b',
                      fontFamily:'sans-serif', fontSize:13,
                    }}>
                      <span style={{
                        width:18, height:18, borderRadius:4,
                        border:`2px solid ${o[field] ? '#4ade80' : '#4a7a4a'}`,
                        background: o[field] ? '#4ade80' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      }}>
                        {o[field] && <Icon name="check" size={11} color="#14532d"/>}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>

                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button onClick={() => deleteOrder(o.id)} style={{ ...btn.danger, fontSize:13, padding:'8px 16px' }}>
                    🗑 Eliminar pedido
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
