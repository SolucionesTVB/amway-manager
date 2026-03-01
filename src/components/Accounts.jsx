import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient.js'
import { fmt } from '../catalog.js'
import { Icon, Card, Spinner, inputSt } from './ui.jsx'

function diasDesde(fecha) {
  const hoy   = new Date()
  const compra = new Date(fecha)
  return Math.floor((hoy - compra) / (1000 * 60 * 60 * 24))
}

function alertColor(pct) {
  if (pct >= 100) return '#ef4444'
  if (pct >= 80)  return '#f97316'
  if (pct >= 60)  return '#f59e0b'
  return '#4ade80'
}

export default function Accounts({ showToast }) {
  const [clients,   setClients]   = useState([])
  const [patterns,  setPatterns]  = useState([])
  const [durations, setDurations] = useState({})
  const [orders,    setOrders]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null)

  useEffect(() => {
    async function load() {
      const [
        { data: cls },
        { data: pts },
        { data: durs },
        { data: ords },
      ] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('client_reorder_patterns').select('*'),
        supabase.from('product_durations').select('*'),
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
      ])

      setClients(cls || [])
      setPatterns(pts || [])
      setOrders(ords || [])

      const durMap = {}
      ;(durs || []).forEach(d => { durMap[d.product_code] = d.duration_days })
      setDurations(durMap)

      // Actualizar patrones de recompra en base a los pedidos
      await updatePatterns(ords || [], pts || [])

      setLoading(false)
    }
    load()
  }, [])

  async function updatePatterns(ords, existingPatterns) {
    // Agrupar por cliente + producto, encontrar última compra y contar
    const map = {}
    ords.forEach(o => {
      ;(o.order_items || []).forEach(it => {
        const key = o.client_name + '|' + it.product_code
        if (!map[key]) {
          map[key] = { client_name: o.client_name, product_code: it.product_code, dates: [] }
        }
        map[key].dates.push(new Date(o.created_at))
      })
    })

    for (const key of Object.keys(map)) {
      const { client_name, product_code, dates } = map[key]
      dates.sort((a, b) => b - a)
      const last_purchase   = dates[0].toISOString().slice(0, 10)
      const purchase_count  = dates.length
      let avg_days_reorder  = null

      if (dates.length >= 2) {
        let totalDays = 0
        for (let i = 0; i < dates.length - 1; i++) {
          totalDays += Math.floor((dates[i] - dates[i+1]) / (1000 * 60 * 60 * 24))
        }
        avg_days_reorder = Math.round(totalDays / (dates.length - 1))
      }

      await supabase.from('client_reorder_patterns').upsert({
        client_name, product_code, last_purchase, purchase_count,
        avg_days_reorder,
      }, { onConflict: 'client_name,product_code' })
    }

    const { data: updated } = await supabase.from('client_reorder_patterns').select('*')
    setPatterns(updated || [])
  }

  function getClientData(clientName) {
    const clientOrders  = orders.filter(o => o.client_name.toLowerCase() === clientName.toLowerCase())
    const totalGastado  = clientOrders.reduce((s, o) => s + o.total, 0)
    const clientPats    = patterns.filter(p => p.client_name.toLowerCase() === clientName.toLowerCase())

    // Productos que necesitan reposición
    const alertas = clientPats.filter(p => {
      const diasUsados  = diasDesde(p.last_purchase)
      const duracion    = p.avg_days_reorder || durations[p.product_code] || 30
      return (diasUsados / duracion) >= 0.6
    })

    // Historial de productos comprados
    const productMap = {}
    clientOrders.forEach(o => {
      ;(o.order_items || []).forEach(it => {
        if (!productMap[it.product_code]) {
          productMap[it.product_code] = {
            name      : it.product_name,
            code      : it.product_code,
            totalQty  : 0,
            totalGasto: 0,
            veces     : 0,
          }
        }
        productMap[it.product_code].totalQty   += it.qty
        productMap[it.product_code].totalGasto += it.total
        productMap[it.product_code].veces      += 1
      })
    })

    return { totalGastado, alertas, productos: Object.values(productMap), pedidosCount: clientOrders.length }
  }

  if (loading) return <div style={{ padding:28 }}><Spinner /></div>

  const selectedClient = selected ? clients.find(c => c.name === selected) : null
  const selectedData   = selected ? getClientData(selected) : null

  return (
    <div style={{ padding:28 }} className="fade-in">
      <h1 style={{ fontSize:24, color:'#e8f5e9', margin:'0 0 4px' }}>Cuentas de Clientes</h1>
      <p style={{ color:'#6b9e6b', margin:'0 0 20px', fontFamily:'sans-serif', fontSize:14 }}>
        Historial acumulado y alertas de reposición por cliente
      </p>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '280px 1fr' : '1fr', gap:16 }}>

        {/* Lista de clientes */}
        <div>
          {clients.map(c => {
            const data     = getClientData(c.name)
            const hasAlerts = data.alertas.length > 0
            return (
              <div key={c.id} onClick={() => setSelected(selected === c.name ? null : c.name)}
                style={{
                  padding:'12px 16px', borderRadius:10, marginBottom:8, cursor:'pointer',
                  background: selected === c.name ? '#1a4a1a' : '#111d13',
                  border: selected === c.name ? '1px solid #4ade80' : '1px solid #1e3a1e',
                  transition:'all 0.15s',
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ color:'#e8f5e9', fontWeight:'bold', fontSize:14 }}>{c.name}</span>
                      {hasAlerts && (
                        <span style={{
                          background:'#ef4444', color:'white', borderRadius:99,
                          fontSize:11, padding:'1px 7px', fontFamily:'sans-serif', fontWeight:700,
                        }}>
                          {data.alertas.length} reponer
                        </span>
                      )}
                    </div>
                    <div style={{ color:'#4a7a4a', fontSize:12, fontFamily:'sans-serif', marginTop:2 }}>
                      {data.pedidosCount} pedido{data.pedidosCount !== 1 ? 's' : ''} • {fmt(data.totalGastado)}
                    </div>
                  </div>
                  <Icon name="chevron" size={14} color="#4a7a4a"/>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detalle del cliente seleccionado */}
        {selected && selectedData && (
          <div className="slide-in">

            {/* Header */}
            <Card style={{ padding:18, marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div>
                  <div style={{ color:'#e8f5e9', fontSize:20, fontWeight:'bold' }}>{selected}</div>
                  <div style={{ color:'#4a7a4a', fontSize:13, fontFamily:'sans-serif' }}>
                    {selectedClient?.type === 'empresario' ? '🏪 Empresario' : '👤 Cliente'}
                    {selectedClient?.phone ? ' • ' + selectedClient.phone : ''}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{
                  background:'none', border:'none', color:'#4a7a4a', cursor:'pointer', padding:4,
                }}>
                  <Icon name="x" size={18}/>
                </button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {[
                  { label:'Total gastado',   value: fmt(selectedData.totalGastado), color:'#4ade80' },
                  { label:'Total pedidos',   value: selectedData.pedidosCount,      color:'#9dc89a' },
                  { label:'Productos únicos',value: selectedData.productos.length,  color:'#9dc89a' },
                ].map(s => (
                  <div key={s.label} style={{ background:'#0d1710', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ color:'#4a7a4a', fontSize:11, fontFamily:'sans-serif', marginBottom:4 }}>{s.label}</div>
                    <div style={{ color:s.color, fontSize:16, fontWeight:'bold', fontFamily:'sans-serif' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Alertas de reposición */}
            {selectedData.alertas.length > 0 && (
              <Card style={{ padding:18, marginBottom:16, border:'1px solid #7f1d1d' }}>
                <div style={{ color:'#f87171', fontSize:13, fontFamily:'sans-serif', fontWeight:700, marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>
                  🔴 Productos por reponer
                </div>
                {selectedData.alertas.map(p => {
                  const diasUsados = diasDesde(p.last_purchase)
                  const duracion   = p.avg_days_reorder || durations[p.product_code] || 30
                  const pct        = Math.min(Math.round((diasUsados / duracion) * 100), 100)
                  const color      = alertColor(pct)
                  return (
                    <div key={p.product_code} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ color:'#e8f5e9', fontSize:13 }}>{p.product_code}</span>
                        <span style={{ color, fontSize:12, fontFamily:'sans-serif', fontWeight:700 }}>
                          {pct >= 100 ? '⚠️ Vencido' : pct + '% usado'}
                        </span>
                      </div>
                      <div style={{ background:'#1a2e1a', borderRadius:99, height:8, overflow:'hidden' }}>
                        <div style={{ width:pct + '%', height:'100%', background:color, borderRadius:99, transition:'width 0.5s' }}/>
                      </div>
                      <div style={{ color:'#4a7a4a', fontSize:11, fontFamily:'sans-serif', marginTop:3 }}>
                        Última compra hace {diasUsados} días • duración estimada: {duracion} días
                        {p.avg_days_reorder ? ' (aprendido del historial)' : ' (estándar Amway)'}
                      </div>
                    </div>
                  )
                })}
              </Card>
            )}

            {/* Historial de productos */}
            <Card>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e3a1e', color:'#e8f5e9', fontWeight:'bold', fontSize:14 }}>
                Historial de compras
              </div>
              {selectedData.productos
                .sort((a, b) => b.veces - a.veces)
                .map((p, idx) => {
                  const pat      = patterns.find(pt => pt.client_name.toLowerCase() === selected.toLowerCase() && pt.product_code === p.code)
                  const diasUsados = pat ? diasDesde(pat.last_purchase) : null
                  const duracion   = pat?.avg_days_reorder || durations[p.code] || 30
                  const pct        = diasUsados !== null ? Math.min(Math.round((diasUsados / duracion) * 100), 100) : 0
                  const color      = alertColor(pct)
                  return (
                    <div key={p.code} style={{
                      display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
                      borderTop: idx > 0 ? '1px solid #141f14' : 'none',
                    }}>
                      <div style={{ flex:1 }}>
                        <div style={{ color:'#e8f5e9', fontSize:13, fontWeight:'bold' }}>{p.name}</div>
                        <div style={{ color:'#4a7a4a', fontSize:11, fontFamily:'sans-serif' }}>
                          Comprado {p.veces} vez{p.veces !== 1 ? 'es' : ''} • {p.totalQty} unidades
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ color:'#4ade80', fontWeight:'bold', fontFamily:'sans-serif', fontSize:13 }}>{fmt(p.totalGasto)}</div>
                        {diasUsados !== null && (
                          <div style={{ color, fontSize:11, fontFamily:'sans-serif' }}>
                            {pct >= 100 ? '⚠️ reponer' : pct + '% consumido'}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
