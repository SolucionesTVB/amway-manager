import { useState } from 'react'
import { CATALOG, CATEGORIES, fmt } from '../catalog.js'
import { Card, PageHeader, inputSt, Icon } from './ui.jsx'

export default function Catalog() {
  const [cat,    setCat]    = useState('Todos')
  const [search, setSearch] = useState('')

  const filtered = CATALOG.filter(p =>
    (cat === 'Todos' || p.cat === cat) &&
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search))
  )

  return (
    <div style={{ padding:28 }} className="fade-in">
      <PageHeader title="Catálogo de Productos" subtitle="Lista de precios 2026 — Precios empresario y cliente" />

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {['Todos', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding:'5px 12px', borderRadius:99, border:'none', cursor:'pointer',
            fontSize:12, fontFamily:'sans-serif',
            background: cat === c ? '#166534' : '#1a2e1a',
            color:      cat === c ? 'white'   : '#9dc89a',
          }}>{c}</button>
        ))}
        <div style={{ position:'relative', marginLeft:'auto' }}>
          <span style={{ position:'absolute', left:9, top:10, color:'#4a7a4a' }}><Icon name="search" size={14}/></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto o código..."
            style={{ ...inputSt, marginBottom:0, paddingLeft:30, width:230 }}/>
        </div>
      </div>

      <Card>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#0d1710' }}>
              {['Código','Producto','Categoría','P. Empresario','P. Cliente','Ganancia'].map(h => (
                <th key={h} style={{ padding:'11px 14px', textAlign:'left', color:'#6b9e6b', fontSize:12, fontFamily:'sans-serif', fontWeight:600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const margen = p.precioCliente - p.precioEmp
              const pct    = Math.round((margen / p.precioCliente) * 100)
              return (
                <tr key={p.id} style={{ borderTop:'1px solid #141f14' }}>
                  <td style={{ padding:'9px 14px', color:'#4a7a4a', fontSize:12, fontFamily:'monospace' }}>{p.id}</td>
                  <td style={{ padding:'9px 14px', color:'#e8f5e9', fontSize:13 }}>{p.name}</td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ background:'#1a2e1a', color:'#4ade80', borderRadius:99, fontSize:11, padding:'2px 8px', fontFamily:'sans-serif' }}>{p.cat}</span>
                  </td>
                  <td style={{ padding:'9px 14px', color:'#9dc89a', fontFamily:'sans-serif', fontSize:13 }}>{fmt(p.precioEmp)}</td>
                  <td style={{ padding:'9px 14px', color:'#e8f5e9', fontFamily:'sans-serif', fontSize:13, fontWeight:'bold' }}>{fmt(p.precioCliente)}</td>
                  <td style={{ padding:'9px 14px' }}>
                    <span style={{ color:'#34d399', fontFamily:'sans-serif', fontSize:13, fontWeight:'bold' }}>{fmt(margen)}</span>
                    <span style={{ color:'#4a7a4a', fontSize:11, marginLeft:4, fontFamily:'sans-serif' }}>({pct}%)</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding:'10px 14px', borderTop:'1px solid #1e3a1e', color:'#4a7a4a', fontSize:12, fontFamily:'sans-serif' }}>
          {filtered.length} de {CATALOG.length} productos
        </div>
      </Card>
    </div>
  )
}
