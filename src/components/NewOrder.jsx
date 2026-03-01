import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient.js'
import { CATALOG, CATEGORIES, fmt } from '../catalog.js'
import { Icon, Card, PageHeader, btn, inputSt, labelSt } from './ui.jsx'

function calcular(totalIVAI) {
  const sinImpuesto = totalIVAI / 1.13
  const impuestos   = totalIVAI - sinImpuesto
  const ganancia    = sinImpuesto * 0.30
  const pagarRafa   = (sinImpuesto - ganancia) + impuestos
  return {
    totalIVAI  : Math.round(totalIVAI),
    sinImpuesto: Math.round(sinImpuesto),
    impuestos  : Math.round(impuestos),
    ganancia   : Math.round(ganancia),
    pagarRafa  : Math.round(pagarRafa),
  }
}

export default function NewOrder({ setView, showToast }) {
  const [clientName, setClientName] = useState('')
  const [clientType, setClientType] = useState('cliente')
  const [period,     setPeriod]     = useState(() => new Date().toISOString().slice(0, 7))
  const [items,      setItems]      = useState([])
  const [catFilter,  setCatFilter]  = useState('Todos')
  const [search,     setSearch]     = useState('')
  const [qtys,       setQtys]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [clients,    setClients]    = useState([])

  useEffect(() => {
    supabase.from('clients').select('name').order('name').then(({ data }) => {
      if (data) setClients(data.map(c => c.name))
    })
  }, [])

  const filtered = CATALOG.filter(p =>
    (catFilter === 'Todos' || p.cat === catFilter) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search))
  )

  const addItem = (p) => {
    const q     = parseInt(qtys[p.id] || 1)
    const price = clientType === 'empresario' ? p.precioEmp : p.precioCliente
    setItems(prev => {
      const idx = prev.findIndex(i => i.product_code === p.id)
      if (idx >= 0) {
        return prev.map((it, i) => i === idx
          ? { ...it, qty: it.qty + q, total: (it.qty + q) * price }
          : it)
      }
      return [...prev, { product_code: p.id, product_name: p.name, unit_price: price, qty: q, total: q * price }]
    })
    showToast(`${p.name} agregado ✓`)
  }

  const removeItem = (code) => setItems(prev => prev.filter(i => i.product_code !== code))

  const updateQty = (code, newQ) => {
    if (newQ < 1) return
    setItems(prev => prev.map(i =>
      i.product_code === code ? { ...i, qty: newQ, total: newQ * i.unit_price } : i
    ))
  }

  const total = items.reduce((s, i) => s + i.total, 0)
  const calc  = total > 0 ? calcular(total) : null

  const handleSave = async () => {
    if (!clientName.trim()) { showToast('Ingresá el nombre del cliente', 'error'); return }
    if (items.length === 0) { showToast('Agregá al menos un producto', 'error');   return }
    setSaving(true)

    let clientId = null
    const { data: existing } = await supabase
      .from('clients').select('id').ilike('name', clientName.trim()).single()

    if (existing) {
      clientId = existing.id
    } else {
      const { data: newClient } = await supabase
        .from('clients').insert({ name: clientName.trim(), type: clientType }).select('id').single()
      clientId = newClient?.id
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({ client_id: clientId, client_name: clientName.trim(), client_type: clientType, period, total })
      .select('id').single()

    if (error || !order) { showToast('Error al guardar el pedido', 'error'); setSaving(false); return }

    await supabase.from('order_items').insert(items.map(i => ({ ...i, order_id: order.id })))

    showToast('✅ Pedido guardado correctamente')
    setView('orders')
  }

  return (
    <div style={{ padding:28 }} className="fade-in">
      <PageHeader title="Nuevo Pedido" subtitle="Seleccioná productos y completá los datos del cliente" />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 390px', gap:20, alignItems:'start' }}>

        {/* Catálogo */}
        <Card>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #1e3a1e' }}>
            <div style={{ fontWeight:'bold', color:'#e8f5e9', marginBottom:10 }}>Catálogo de Productos</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {['Todos', ...CATEGORIES].map(c => (
                <button key={c} onClick={() => setCatFilter(c)} style={{
                  padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer',
                  fontSize:11, fontFamily:'sans-serif',
                  background: catFilter === c ? '#166534' : '#1a2e1a',
                  color:      catFilter === c ? 'white'   : '#9dc89a',
                }}>{c}</button>
              ))}
            </div>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:9, top:10, color:'#4a7a4a' }}><Icon name="search" size={14}/></span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto o código..."
                style={{ ...inputSt, marginBottom:0, paddingLeft:30 }}/>
            </div>
          </div>
          <div style={{ maxHeight:440, overflow:'auto' }}>
            {filtered.map(p => (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderBottom:'1px solid #141f14' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:'#e8f5e9' }}>{p.name}</div>
                  <div style={{ fontSize:11, color:'#4a7a4a', fontFamily:'sans-serif' }}>
                    Emp: {fmt(p.precioEmp)} | Cliente: {fmt(p.precioCliente)}
                  </div>
                </div>
                <input type="number" min="1" defaultValue="1"
                  onChange={e => setQtys(q => ({ ...q, [p.id]: e.target.value }))}
                  style={{ width:48, padding:'4px', background:'#0d1710', border:'1px solid #2d4a2d', borderRadius:6, color:'#e8f5e9', textAlign:'center', fontSize:13, fontFamily:'sans-serif' }}/>
                <button onClick={() => addItem(p)} style={{ ...btn.base, padding:'5px 12px', fontSize:12 }}>+ Agregar</button>
              </div>
            ))}
          </div>
        </Card>

        {/* Panel derecho */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Datos del pedido */}
          <Card style={{ padding:18 }}>
            <div style={{ fontWeight:'bold', color:'#e8f5e9', marginBottom:14 }}>Datos del Pedido</div>

            <label style={labelSt}>Nombre del cliente</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              list="client-list" placeholder="Ej: María, Johan, Shirley..."
              style={inputSt}/>
            <datalist id="client-list">
              {clients.map(c => <option key={c} value={c}/>)}
            </datalist>

            <label style={labelSt}>Tipo de precio</label>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {[{v:'cliente',l:'👤 Precio Cliente'},{v:'empresario',l:'🏪 Precio Empresario'}].map(t => (
                <button key={t.v} onClick={() => setClientType(t.v)} style={{
                  flex:1, padding:'8px', borderRadius:8, border:'1px solid #2d4a2d', cursor:'pointer',
                  fontSize:13, fontFamily:'sans-serif',
                  background: clientType === t.v ? '#166534' : '#0d1710',
                  color:      clientType === t.v ? 'white'   : '#9dc89a',
                }}>{t.l}</button>
              ))}
            </div>

            <label style={labelSt}>Período</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={inputSt}/>
          </Card>

          {/* Productos seleccionados */}
          <Card>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e3a1e', color:'#e8f5e9', fontWeight:'bold', fontSize:14 }}>
              Productos ({items.length})
            </div>
            {items.length === 0 && (
              <div style={{ padding:20, textAlign:'center', color:'#4a7a4a', fontSize:13, fontFamily:'sans-serif' }}>
                Agregá productos del catálogo ←
              </div>
            )}
            {items.map(it => (
              <div key={it.product_code} style={{ padding:'8px 12px', borderBottom:'1px solid #141f14', display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#e8f5e9' }}>{it.product_name}</div>
                  <div style={{ fontSize:11, color:'#4a7a4a', fontFamily:'sans-serif' }}>{fmt(it.unit_price)} × {it.qty}</div>
                </div>
                <input type="number" min="1" value={it.qty}
                  onChange={e => updateQty(it.product_code, parseInt(e.target.value))}
                  style={{ width:42, padding:'3px', background:'#0d1710', border:'1px solid #2d4a2d', borderRadius:5, color:'#e8f5e9', textAlign:'center', fontSize:12 }}/>
                <span style={{ color:'#4ade80', fontWeight:'bold', fontSize:13, fontFamily:'sans-serif', minWidth:75, textAlign:'right' }}>{fmt(it.total)}</span>
                <button onClick={() => removeItem(it.product_code)} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', padding:3 }}>
                  <Icon name="x" size={14}/>
                </button>
              </div>
            ))}
          </Card>

          {/* Resumen financiero — igual que en el Excel */}
          {calc && (
            <Card style={{ overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e3a1e', color:'#9dc89a', fontWeight:700, fontSize:12, textTransform:'uppercase', letterSpacing:1 }}>
                Resumen financiero
              </div>
              {[
                { label:'Total pedido IVAI',  value: calc.totalIVAI,   color:'#9dc89a', bold:false },
                { label:'Total sin impuesto', value: calc.sinImpuesto, color:'#9dc89a', bold:false },
                { label:'Impuestos (13%)',    value: calc.impuestos,   color:'#f59e0b', bold:false },
                { label:'Ganancia (30%)',     value: calc.ganancia,    color:'#34d399', bold:false },
                { label:'Total pagar a Rafa', value: calc.pagarRafa,   color:'#4ade80', bold:true  },
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
            </Card>
          )}

          <button onClick={handleSave} disabled={saving} style={{ ...btn.base, width:'100%', padding:'14px', fontSize:16, opacity: saving ? 0.6 : 1 }}>
            {saving ? '⏳ Guardando...' : '💾 Guardar Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
