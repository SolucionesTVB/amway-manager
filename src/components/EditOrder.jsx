import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient.js'
import { CATALOG, CATEGORIES, fmt } from '../catalog.js'
import { Icon, Card, btn, inputSt } from './ui.jsx'

function calcular(t) {
  const s = t/1.13, im = t-s, g = s*0.30, r = (s-g)+im
  return { totalIVAI:Math.round(t), sinImpuesto:Math.round(s), impuestos:Math.round(im), ganancia:Math.round(g), pagarRafa:Math.round(r) }
}

export default function EditOrder({ order, onClose, onSaved, showToast }) {
  const [items,setItems]=useState([])
  const [catFilter,setCatFilter]=useState('Todos')
  const [search,setSearch]=useState('')
  const [qtys,setQtys]=useState({})
  const [saving,setSaving]=useState(false)

  useEffect(()=>{ setItems((order.order_items||[]).map(it=>({...it}))) },[order])

  const filtered = CATALOG.filter(p=>(catFilter==='Todos'||p.cat===catFilter)&&(search===''||p.name.toLowerCase().includes(search.toLowerCase())||p.id.includes(search)))

  const addItem = (p) => {
    const q=parseInt(qtys[p.id]||1)
    const price=order.client_type==='empresario'?p.precioEmp:p.precioCliente
    setItems(prev=>{
      const idx=prev.findIndex(i=>i.product_code===p.id)
      if(idx>=0) return prev.map((it,i)=>i===idx?{...it,qty:it.qty+q,total:(it.qty+q)*price}:it)
      return [...prev,{product_code:p.id,product_name:p.name,unit_price:price,qty:q,total:q*price}]
    })
    showToast(p.name+' agregado')
  }

  const removeItem=(code)=>setItems(prev=>prev.filter(i=>i.product_code!==code))
  const updateQty=(code,newQ)=>{
    if(newQ<1)return
    setItems(prev=>prev.map(i=>i.product_code===code?{...i,qty:newQ,total:newQ*i.unit_price}:i))
  }

  const total=items.reduce((s,i)=>s+i.total,0)
  const calc=total>0?calcular(total):null

  const handleSave=async()=>{
    if(items.length===0){showToast('El pedido no puede quedar vacio','error');return}
    setSaving(true)
    await supabase.from('order_items').delete().eq('order_id',order.id)
    await supabase.from('order_items').insert(items.map(i=>({order_id:order.id,product_code:i.product_code,product_name:i.product_name,unit_price:i.unit_price,qty:i.qty,total:i.total})))
    await supabase.from('orders').update({total}).eq('id',order.id)
    showToast('Pedido actualizado')
    onSaved()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:20}}>
      <div style={{background:'#111d13',borderRadius:16,border:'1px solid #2d4a2d',width:'100%',maxWidth:900,maxHeight:'90vh',overflow:'auto'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #1e3a1e',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{color:'#e8f5e9',fontWeight:'bold',fontSize:18}}>Editar Pedido</div>
            <div style={{color:'#4a7a4a',fontSize:13,fontFamily:'sans-serif'}}>{order.client_name} - {order.period}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#4a7a4a',cursor:'pointer'}}><Icon name="x" size={22}/></button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16,padding:16}}>
          <Card>
            <div style={{padding:'12px 14px',borderBottom:'1px solid #1e3a1e'}}>
              <div style={{color:'#e8f5e9',fontWeight:'bold',marginBottom:8,fontSize:13}}>Agregar productos</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                {['Todos',...CATEGORIES].map(c=>(
                  <button key={c} onClick={()=>setCatFilter(c)} style={{padding:'2px 8px',borderRadius:99,border:'none',cursor:'pointer',fontSize:10,fontFamily:'sans-serif',background:catFilter===c?'#166534':'#1a2e1a',color:catFilter===c?'white':'#9dc89a'}}>{c}</button>
                ))}
              </div>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:8,top:9,color:'#4a7a4a'}}><Icon name="search" size={13}/></span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto..." style={{...inputSt,marginBottom:0,paddingLeft:28,fontSize:13}}/>
              </div>
            </div>
            <div style={{maxHeight:360,overflow:'auto'}}>
              {filtered.map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:'1px solid #141f14'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:'#e8f5e9'}}>{p.name}</div>
                    <div style={{fontSize:10,color:'#4a7a4a',fontFamily:'sans-serif'}}>{order.client_type==='empresario'?fmt(p.precioEmp):fmt(p.precioCliente)}</div>
                  </div>
                  <input type="number" min="1" defaultValue="1" onChange={e=>setQtys(q=>({...q,[p.id]:e.target.value}))} style={{width:42,padding:'3px',background:'#0d1710',border:'1px solid #2d4a2d',borderRadius:5,color:'#e8f5e9',textAlign:'center',fontSize:12}}/>
                  <button onClick={()=>addItem(p)} style={{...btn.base,padding:'4px 10px',fontSize:11}}>+ Agregar</button>
                </div>
              ))}
            </div>
          </Card>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Card>
              <div style={{padding:'10px 14px',borderBottom:'1px solid #1e3a1e',color:'#e8f5e9',fontWeight:'bold',fontSize:13}}>Productos ({items.length})</div>
              {items.map(it=>(
                <div key={it.product_code} style={{padding:'7px 10px',borderBottom:'1px solid #141f14',display:'flex',alignItems:'center',gap:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:'#e8f5e9'}}>{it.product_name}</div>
                    <div style={{fontSize:10,color:'#4a7a4a',fontFamily:'sans-serif'}}>{fmt(it.unit_price)} x {it.qty}</div>
                  </div>
                  <input type="number" min="1" value={it.qty} onChange={e=>updateQty(it.product_code,parseInt(e.target.value))} style={{width:38,padding:'2px',background:'#0d1710',border:'1px solid #2d4a2d',borderRadius:5,color:'#e8f5e9',textAlign:'center',fontSize:11}}/>
                  <span style={{color:'#4ade80',fontWeight:'bold',fontSize:12,fontFamily:'sans-serif',minWidth:65,textAlign:'right'}}>{fmt(it.total)}</span>
                  <button onClick={()=>removeItem(it.product_code)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',padding:2}}><Icon name="x" size={13}/></button>
                </div>
              ))}
            </Card>
            {calc&&(
              <Card style={{overflow:'hidden'}}>
                <div style={{padding:'10px 14px',borderBottom:'1px solid #1e3a1e',color:'#9dc89a',fontWeight:700,fontSize:11,textTransform:'uppercase',letterSpacing:1}}>Resumen</div>
                {[
                  {label:'Total IVAI',value:calc.totalIVAI,color:'#9dc89a',bold:false},
                  {label:'Sin impuesto',value:calc.sinImpuesto,color:'#9dc89a',bold:false},
                  {label:'Impuestos (13%)',value:calc.impuestos,color:'#f59e0b',bold:false},
                  {label:'Ganancia (30%)',value:calc.ganancia,color:'#34d399',bold:false},
                  {label:'Total pagar a Rafa',value:calc.pagarRafa,color:'#4ade80',bold:true},
                ].map((row,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 14px',background:row.bold?'#1a4a1a':i%2===0?'#0d1710':'#111d13',borderTop:i>0?'1px solid #1e3a1e':'none'}}>
                    <span style={{color:row.bold?'#e8f5e9':'#9dc89a',fontFamily:'sans-serif',fontSize:12,fontWeight:row.bold?700:400}}>{row.label}</span>
                    <span style={{color:row.color,fontFamily:'sans-serif',fontSize:row.bold?15:13,fontWeight:row.bold?700:600}}>{fmt(row.value)}</span>
                  </div>
                ))}
              </Card>
            )}
            <button onClick={handleSave} disabled={saving} style={{...btn.base,width:'100%',padding:'12px',fontSize:15,opacity:saving?0.6:1}}>
              {saving?'Guardando...':'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
