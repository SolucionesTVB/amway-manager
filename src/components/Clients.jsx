import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient.js'
import { fmt } from '../catalog.js'
import { Card, PageHeader, Spinner, btn, inputSt, labelSt, Icon } from './ui.jsx'

export default function Clients({ showToast }) {
  const [clients, setClients] = useState([])
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [name,    setName]    = useState('')
  const [type,    setType]    = useState('cliente')
  const [phone,   setPhone]   = useState('')

  const load = useCallback(async () => {
    const [{ data: c }, { data: o }] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('orders').select('client_name, total, pagado_rafa'),
    ])
    setClients(c || [])
    setOrders(o  || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addClient = async () => {
    if (!name.trim()) return
    const exists = clients.find(c => c.name.toLowerCase() === name.trim().toLowerCase())
    if (exists) { showToast('Ya existe ese cliente', 'error'); return }

    const { data } = await supabase
      .from('clients')
      .insert({ name: name.trim(), type, phone: phone.trim() || null })
      .select()
      .single()

    if (data) {
      setClients(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)))
      setName(''); setPhone('')
      showToast('Cliente agregado ✓')
    }
  }

  const deleteClient = async (id) => {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clients').delete().eq('id', id)
    setClients(prev => prev.filter(c => c.id !== id))
    showToast('Cliente eliminado')
  }

  const statsFor = (clientName) => {
    const co  = orders.filter(o => o.client_name.toLowerCase() === clientName.toLowerCase())
    const tot = co.reduce((s, o) => s + o.total, 0)
    const pen = co.filter(o => !o.pagado_rafa).reduce((s, o) => s + o.total, 0)
    return { count: co.length, total: tot, pending: pen }
  }

  return (
    <div style={{ padding:28 }} className="fade-in">
      <PageHeader title="Clientes y Distribuidores" subtitle="Gestioná tu red de clientes Amway" />

      {/* Agregar */}
      <Card style={{ padding:18, marginBottom:20 }}>
        <div style={{ fontWeight:'bold', color:'#e8f5e9', marginBottom:14 }}>Agregar nuevo</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 200px 180px auto', gap:10, alignItems:'end' }}>
          <div>
            <label style={labelSt}>Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre completo..."
              onKeyDown={e => e.key === 'Enter' && addClient()}
              style={{ ...inputSt, marginBottom:0 }}/>
          </div>
          <div>
            <label style={labelSt}>Teléfono (opcional)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="8888-8888"
              style={{ ...inputSt, marginBottom:0 }}/>
          </div>
          <div>
            <label style={labelSt}>Tipo</label>
            <select value={type} onChange={e => setType(e.target.value)}
              style={{ ...inputSt, marginBottom:0 }}>
              <option value="cliente">👤 Cliente</option>
              <option value="empresario">🏪 Empresario/Dist.</option>
            </select>
          </div>
          <button onClick={addClient} style={{ ...btn.base, whiteSpace:'nowrap' }}>+ Agregar</button>
        </div>
      </Card>

      {loading && <Spinner />}

      {!loading && (
        <Card>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#0d1710' }}>
                {['Nombre','Teléfono','Tipo','Pedidos','Total compras','Pendiente','Acción'].map(h => (
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', color:'#6b9e6b', fontSize:12, fontFamily:'sans-serif', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={7} style={{ padding:30, textAlign:'center', color:'#4a7a4a', fontFamily:'sans-serif' }}>No hay clientes todavía</td></tr>
              )}
              {clients.map(c => {
                const s = statsFor(c.name)
                return (
                  <tr key={c.id} style={{ borderTop:'1px solid #141f14' }}>
                    <td style={{ padding:'10px 14px', color:'#e8f5e9', fontSize:14, fontWeight:'bold' }}>{c.name}</td>
                    <td style={{ padding:'10px 14px', color:'#6b9e6b', fontSize:13, fontFamily:'sans-serif' }}>{c.phone || '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ background:'#1a2e1a', color:'#4ade80', borderRadius:99, fontSize:11, padding:'2px 9px', fontFamily:'sans-serif' }}>
                        {c.type === 'empresario' ? '🏪 Empresario' : '👤 Cliente'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', color:'#9dc89a', fontFamily:'sans-serif', fontSize:13 }}>{s.count}</td>
                    <td style={{ padding:'10px 14px', color:'#4ade80', fontWeight:'bold', fontFamily:'sans-serif', fontSize:13 }}>{fmt(s.total)}</td>
                    <td style={{ padding:'10px 14px' }}>
                      {s.pending > 0
                        ? <span style={{ color:'#f87171', fontWeight:'bold', fontFamily:'sans-serif', fontSize:13 }}>{fmt(s.pending)}</span>
                        : <span style={{ color:'#4ade80', fontSize:13, fontFamily:'sans-serif' }}>✓ Al día</span>
                      }
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={() => deleteClient(c.id)} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer', padding:4 }}>
                        <Icon name="trash" size={15}/>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
