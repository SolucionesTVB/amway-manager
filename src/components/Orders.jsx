import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient.js'
import { fmt } from '../catalog.js'
import { Icon, Badge, Card, Spinner, btn, inputSt } from './ui.jsx'

const AMWAY_WHATSAPP = '50670507023'

const FILTERS = [
  { v:'todos',             l:'Todos' },
  { v:'pendiente_pago',    l:'Sin cobrar' },
  { v:'pendiente_entrega', l:'Sin entregar' },
  { v:'completo',          l:'Completados' },
]

const STATUS_FIELDS = [
  { field:'entregado_tv',      label:'Entregado a TV'      },
  { field:'entregado_cliente', label:'Entregado al cliente'},
  { field:'pagado_rafa',       label:'Pagado a mi (Rafa)'  },
  { field:'pagado_tv',         label:'Pagado a TV'         },
]

function buildWhatsAppMessage(orders) {
  const today = new Date().toLocaleDateString('es-CR', { day:'2-digit', month:'long', year:'numeric' })
  const productMap = {}
  orders.forEach(o => {
    ;(o.order_items || []).forEach(it => {
      if (productMap[it.product_code]) {
        productMap[it.product_code].qty   += it.qty
        productMap[it.product_code].total += it.total
      } else {
        productMap[it.product_code] = { name:it.product_name, code:it.product_code, qty:it.qty, price:it.unit_price, total:it.total }
      }
    })
  })
  const productos        = Object.values(productMap)
  const totalConIVAI     = productos.reduce((s, p) => s + p.total, 0)
  const totalSinImpuesto = Math.round(totalConIVAI / 1.13)
  const impuestos        = totalConIVAI - totalSinImpuesto
  const clientesList     = [...new Set(orders.map(o => o.client_name))].join(', ')

  let msg = '🛒 *PEDIDO AMWAY - ' + today + '*\n'
  msg += '━━━━━━━━━━━━━━━━━━━━\n'
  msg += '👥 Clientes: ' + clientesList + '\n'
  msg += '━━━━━━━━━━━━━━━━━━━━\n\n'
  msg += '*PRODUCTOS:*\n'
  productos.forEach(p => {
    msg += '• ' + p.name + '\n'
    msg += '  Cod: ' + p.code + ' | Cant: ' + p.qty + ' | ' + fmt(p.price) + ' c/u\n'
  })
  msg += '\n━━━━━━━━━━━━━━━━━━━━\n'
  msg += '📋 *RESUMEN:*\n'
  msg += 'Total pedido (IVAI): ' + fmt(totalConIVAI) + '\n'
  msg += 'Total sin impuesto:  ' + fmt(totalSinImpuesto) + '\n'
  msg += 'Impuestos (13%):     ' + fmt(impuestos) + '\n'
  msg += '━━━━━━━━━━━━━━━━━━━━\n'
  msg += '💵 *Total a pagar a Amway: ' + fmt(totalSinImpuesto) + '*\n'
  msg += '━━━━━━━━━━━━━━━━━━━━\n'
  msg += '_Enviado desde Amway Manager CR_ ✅'
  return msg
}

export default function Orders({ showToast }) {
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('todos')
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)

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
    if (!confirm('¿Eliminar este pedido?')) return
    await supabase.from('orders').delete().eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
    setExpanded(null)
    showToast('Pedido eliminado')
  }

  const openWhatsApp = (ordersToSend) => {
    const msg = buildWhatsAppMessage(ordersToSend)
    window.open('https://wa.me/' + AMWAY_WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank')
  }

  const sendAllToday = () => {
    const todayOrders = orders.filter(o =>
      new Date(o.created_at).toDateString() === new Date().toDateString() && !o.entregado_tv
    )
    if (todayOrders.length === 0) {
      showToast('No hay pedidos de hoy pendientes de enviar', 'error')
      return
    }
    openWhatsApp(todayOrders)
  }

  const pendientesHoy = orders.filter(o =>
    new Date(o.created_at).toDateString() === new Date().toDateString() && !o.entregado_tv
  ).length

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

      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:24, color:'#e8f5e9', margin:'0 0 4px' }}>Pedidos</h1>
        <p style={{ color:'#6b9e6b', margin:'0 0 16px', fontFamily:'sans-serif', fontSize:14 }}>
          Controlá entregas y pagos de cada cliente
        </p>
        <button onClick={sendAllToday} style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          background:'#25D366', color:'white', border:'none', borderRadius:10,
          padding:'14px 20px', cursor:'pointer', fontSize:16,
          fontFamily:'sans-serif', fontWeight:700,
          boxShadow:'0 4px 16px rgba(37,211,102,0.3)', marginBottom:4,
        }}>
          📱 Enviar pedido del día a Amway por WhatsApp
          {pendientesHoy > 0 && (
            <span style={{ background:'rgba(0,0,0,0.25)', borderRadius:99, fontSize:13, padding:'2px 10px' }}>
              {pendientesHoy} pendiente{pendientesHoy !== 1 ? 's' : ''}
            </span>
          )}
        </button>
        <p style={{ color:'#4a7a4a', fontSize:11, fontFamily:'sans-serif', margin:0 }}>
          Agrupa los pedidos de hoy que no se han marcado como "Entregado a TV"
        </p>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
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
        {visible.map(o => {
          const totalSinImp = Math.round(o.total / 1.13)
          const impuestos   = o.total - totalSinImp
          return (
            <Card key={o.id}>
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
                    <span style={{ color:'#4ade80', fontWeight:'bold', fontFamily:'sans-serif', fontSize:15 }}>{fmt(o.total)}</span>
                    <Badge ok={o.pagado_rafa}       yes="✓ Pagado"    no="Pendiente pago"/>
                    <Badge ok={o.entregado_cliente} yes="✓ Entregado" no="Sin entregar"/>
                  </div>
                </div>
                <span style={{ color:'#4a7a4a', transform: expanded === o.id ? 'rotate(180deg)' : 'none', transition:'0.2s' }}>
                  <Icon name="chevron" size={18}/>
                </span>
              </div>

              {expanded === o.id && (
                <div style={{ borderTop:'1px solid #1e3a1e', padding:'18px' }} className="slide-in">

                  {/* Productos */}
                  <div style={{ color:'#9dc89a', fontSize:12, fontFamily:'sans-serif', fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:1 }}>
                    Productos del pedido
                  </div>
                  {(o.order_items || []).map((it, idx) => (
                    <div key={it.id} style={{
                      display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                      background: idx % 2 === 0 ? '#0d1710' : '#111d13',
                      borderRadius:8, marginBottom:6,
                    }}>
                      <div style={{ flex:1 }}>
                        <div style={{ color:'#e8f5e9', fontSize:14, fontWeight:'bold', marginBottom:2 }}>{it.product_name}</div>
                        <div style={{ color:'#4a7a4a', fontSize:12, fontFamily:'sans-serif' }}>Código: {it.product_code}</div>
                      </div>
                      <div style={{ textAlign:'right', fontFamily:'sans-serif' }}>
                        <div style={{ color:'#9dc89a', fontSize:13 }}>{fmt(it.unit_price)} × {it.qty}</div>
                        <div style={{ color:'#4ade80', fontSize:15, fontWeight:'bold' }}>{fmt(it.total)}</div>
                      </div>
                    </div>
                  ))}

                  {/* Resumen de totales */}
                  <div style={{ marginTop:12, marginBottom:16, borderRadius:8, overflow:'hidden', border:'1px solid #2d4a2d' }}>
                    {[
                      { label:'Total pedido (IVAI)',    value: o.total,      color:'#9dc89a', bold:false },
                      { label:'Total sin impuesto',     value: totalSinImp,  color:'#9dc89a', bold:false },
                      { label:'Impuestos (13%)',        value: impuestos,    color:'#f59e0b', bold:false },
                      { label:'Total a pagar a Amway', value: totalSinImp,  color:'#4ade80', bold:true  },
                    ].map((row, i) => (
                      <div key={i} style={{
                        display:'flex', justifyContent:'space-between', padding:'10px 16px',
                        background: row.bold ? '#1a4a1a' : (i % 2 === 0 ? '#0d1710' : '#111d13'),
                        borderTop: i > 0 ? '1px solid #1e3a1e' : 'none',
                      }}>
                        <span style={{ color: row.bold ? '#e8f5e9':'#9dc89a', fontFamily:'sans-serif', fontSize:13, fontWeight: row.bold ? 700:400 }}>
                          {row.label}
                        </span>
                        <span style={{ color: row.color, fontFamily:'sans-serif', fontSize: row.bold ? 17:14, fontWeight: row.bold ? 700:600 }}>
                          {fmt(row.value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Estados */}
                  <div style={{ color:'#9dc89a', fontSize:12, fontFamily:'sans-serif', fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:1 }}>
                    Estados
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:10, marginBottom:16 }}>
                    {STATUS_FIELDS.map(({ field, label }) => (
                      <button key={field} onClick={() => toggle(field, o.id, o[field])} style={{
                        display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
                        borderRadius:8, border:'1px solid ' + (o[field] ? '#166534':'#2d4a2d'),
                        background: o[field] ? '#14532d':'#0d1710',
                        cursor:'pointer', color: o[field] ? '#4ade80':'#6b9e6b',
                        fontFamily:'sans-serif', fontSize:13,
                      }}>
                        <span style={{
                          width:18, height:18, borderRadius:4,
                          border:'2px solid ' + (o[field] ? '#4ade80':'#4a7a4a'),
                          background: o[field] ? '#4ade80':'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                        }}>
                          {o[field] && <Icon name="check" size={11} color="#14532d"/>}
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <button onClick={() => openWhatsApp([o])} style={{
                      display:'flex', alignItems:'center', gap:6, background:'#25D366',
                      color:'white', border:'none', borderRadius:8, padding:'9px 16px',
                      cursor:'pointer', fontSize:13, fontFamily:'sans-serif', fontWeight:600,
                    }}>
                      📱 Enviar solo este pedido
                    </button>
                    <button onClick={() => deleteOrder(o.id)} style={{ ...btn.danger, fontSize:13, padding:'8px 16px' }}>
                      🗑 Eliminar pedido
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
