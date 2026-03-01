import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient.js'
import { fmt } from '../catalog.js'
import { Icon, Badge, Card, Spinner, btn, inputSt } from './ui.jsx'
import EditOrder from './EditOrder.jsx'

const AMWAY_WHATSAPP = '50670507023'
const FILTERS = [
  { v:'todos', l:'Todos' },
  { v:'pendiente_pago', l:'Sin cobrar' },
  { v:'pendiente_entrega', l:'Sin entregar' },
]
const STATUS_FIELDS = [
  { field:'entregado_tv',      label:'Entregado a TV'      },
  { field:'entregado_cliente', label:'Entregado al cliente'},
  { field:'pagado_rafa',       label:'Pagado a mi (Rafa)'  },
  { field:'pagado_tv',         label:'Pagado a TV'         },
]
function esCerrado(o) { return o.entregado_tv && o.entregado_cliente && o.pagado_rafa && o.pagado_tv }
function calcular(t) {
  const s=t/1.13,im=t-s,g=s*0.30,r=(s-g)+im
  return { totalIVAI:Math.round(t),sinImpuesto:Math.round(s),impuestos:Math.round(im),ganancia:Math.round(g),pagarRafa:Math.round(r) }
}
function buildWhatsAppMessage(orders) {
  const today=new Date().toLocaleDateString('es-CR',{day:'2-digit',month:'long',year:'numeric'})
  const pm={}
  orders.forEach(o=>{;(o.order_items||[]).forEach(it=>{if(pm[it.product_code]){pm[it.product_code].qty+=it.qty;pm[it.product_code].total+=it.total}else{pm[it.product_code]={name:it.product_name,code:it.product_code,qty:it.qty,price:it.unit_price,total:it.total}}})})
  const prods=Object.values(pm),totalIVAI=prods.reduce((s,p)=>s+p.total,0),calc=calcular(totalIVAI)
  const clientes=[...new Set(orders.map(o=>o.client_name))].join(', ')
  let msg='🛒 *PEDIDO AMWAY - '+today+'*\n'+'━━━━━━━━━━━━━━━━━━━━\n'+'👥 Clientes: '+clientes+'\n'+'━━━━━━━━━━━━━━━━━━━━\n\n'+'*PRODUCTOS:*\n'
  prods.forEach(p=>{msg+='• '+p.name+'\n'+'  Cod: '+p.code+' | Cant: '+p.qty+' | '+fmt(p.price)+' c/u\n'})
  msg+='\n━━━━━━━━━━━━━━━━━━━━\n📋 *RESUMEN:*\nTotal pedido IVAI:   '+fmt(calc.totalIVAI)+'\nTotal sin impuesto:  '+fmt(calc.sinImpuesto)+'\nImpuestos (13%):     '+fmt(calc.impuestos)+'\n━━━━━━━━━━━━━━━━━━━━\n💵 *Total pagar a Rafa: '+fmt(calc.pagarRafa)+'*\n━━━━━━━━━━━━━━━━━━━━\n_Enviado desde Amway Manager CR_ ✅'
  return msg
}
function PedidoCard({o,expanded,setExpanded,selected,toggleSelect,toggle,deleteOrder,openWhatsApp,setEditing}) {
  const calc=calcular(o.total),isSelected=selected.has(o.id),cerrado=esCerrado(o)
  return (
    <Card style={{border:isSelected?'1px solid #4ade80':'1px solid #1e3a1e',opacity:cerrado?0.85:1}}>
      <div style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:12}}>
        <div onClick={()=>toggleSelect(o.id)} style={{width:22,height:22,borderRadius:6,flexShrink:0,cursor:'pointer',border:'2px solid '+(isSelected?'#4ade80':'#4a7a4a'),background:isSelected?'#4ade80':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
          {isSelected&&<Icon name="check" size={13} color="#14532d"/>}
        </div>
        <div style={{flex:1,cursor:'pointer'}} onClick={()=>setExpanded(expanded===o.id?null:o.id)}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5,flexWrap:'wrap'}}>
            <span style={{fontWeight:'bold',color:'#e8f5e9',fontSize:16}}>{o.client_name}</span>
            <span style={{background:'#1a2e1a',color:'#4ade80',borderRadius:99,fontSize:11,padding:'1px 8px',fontFamily:'sans-serif'}}>{o.client_type==='empresario'?'🏪 Empresario':'👤 Cliente'}</span>
            <span style={{color:'#4a7a4a',fontSize:12,fontFamily:'sans-serif'}}>{o.period}</span>
            {cerrado&&<span style={{background:'#14532d',color:'#4ade80',borderRadius:99,fontSize:11,padding:'1px 8px',fontFamily:'sans-serif'}}>✓ Cerrado</span>}
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{color:'#4ade80',fontWeight:'bold',fontFamily:'sans-serif',fontSize:15}}>{fmt(o.total)}</span>
            <Badge ok={o.pagado_rafa} yes="✓ Pagado" no="Pendiente pago"/>
            <Badge ok={o.entregado_cliente} yes="✓ Entregado" no="Sin entregar"/>
          </div>
        </div>
        <span onClick={()=>setExpanded(expanded===o.id?null:o.id)} style={{color:'#4a7a4a',transform:expanded===o.id?'rotate(180deg)':'none',transition:'0.2s',cursor:'pointer'}}>
          <Icon name="chevron" size={18}/>
        </span>
      </div>
      {expanded===o.id&&(
        <div style={{borderTop:'1px solid #1e3a1e',padding:'18px'}} className="slide-in">
          <div style={{color:'#9dc89a',fontSize:12,fontFamily:'sans-serif',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>Productos del pedido</div>
          {(o.order_items||[]).map((it,idx)=>(
            <div key={it.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:idx%2===0?'#0d1710':'#111d13',borderRadius:8,marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{color:'#e8f5e9',fontSize:14,fontWeight:'bold',marginBottom:2}}>{it.product_name}</div>
                <div style={{color:'#4a7a4a',fontSize:12,fontFamily:'sans-serif'}}>Código: {it.product_code}</div>
              </div>
              <div style={{textAlign:'right',fontFamily:'sans-serif'}}>
                <div style={{color:'#9dc89a',fontSize:13}}>{fmt(it.unit_price)} × {it.qty}</div>
                <div style={{color:'#4ade80',fontSize:15,fontWeight:'bold'}}>{fmt(it.total)}</div>
              </div>
            </div>
          ))}
          <div style={{marginTop:12,marginBottom:16,borderRadius:8,overflow:'hidden',border:'1px solid #2d4a2d'}}>
            {[
              {label:'Total pedido IVAI',value:calc.totalIVAI,color:'#9dc89a',bold:false},
              {label:'Total sin impuesto',value:calc.sinImpuesto,color:'#9dc89a',bold:false},
              {label:'Impuestos (13%)',value:calc.impuestos,color:'#f59e0b',bold:false},
              {label:'Ganancia (30%)',value:calc.ganancia,color:'#34d399',bold:false},
              {label:'Total pagar a Rafa',value:calc.pagarRafa,color:'#4ade80',bold:true},
            ].map((row,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'10px 16px',background:row.bold?'#1a4a1a':i%2===0?'#0d1710':'#111d13',borderTop:i>0?'1px solid #1e3a1e':'none'}}>
                <span style={{color:row.bold?'#e8f5e9':'#9dc89a',fontFamily:'sans-serif',fontSize:13,fontWeight:row.bold?700:400}}>{row.label}</span>
                <span style={{color:row.color,fontFamily:'sans-serif',fontSize:row.bold?17:14,fontWeight:row.bold?700:600}}>{fmt(row.value)}</span>
              </div>
            ))}
          </div>
          <div style={{color:'#9dc89a',fontSize:12,fontFamily:'sans-serif',fontWeight:700,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>Estados</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginBottom:16}}>
            {STATUS_FIELDS.map(({field,label})=>(
              <button key={field} onClick={()=>toggle(field,o.id,o[field])} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:8,border:'1px solid '+(o[field]?'#166534':'#2d4a2d'),background:o[field]?'#14532d':'#0d1710',cursor:'pointer',color:o[field]?'#4ade80':'#6b9e6b',fontFamily:'sans-serif',fontSize:13}}>
                <span style={{width:18,height:18,borderRadius:4,border:'2px solid '+(o[field]?'#4ade80':'#4a7a4a'),background:o[field]?'#4ade80':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {o[field]&&<Icon name="check" size={11} color="#14532d"/>}
                </span>
                {label}
              </button>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setEditing(o)} style={{display:'flex',alignItems:'center',gap:6,background:'#166534',color:'white',border:'none',borderRadius:8,padding:'9px 14px',cursor:'pointer',fontSize:13,fontFamily:'sans-serif',fontWeight:600}}>✏️ Editar pedido</button>
              <button onClick={()=>openWhatsApp([o])} style={{display:'flex',alignItems:'center',gap:6,background:'#25D366',color:'white',border:'none',borderRadius:8,padding:'9px 14px',cursor:'pointer',fontSize:13,fontFamily:'sans-serif',fontWeight:600}}>📱 Enviar a Amway</button>
            </div>
            <button onClick={()=>deleteOrder(o.id)} style={{...btn.danger,fontSize:13,padding:'8px 16px'}}>🗑 Eliminar</button>
          </div>
        </div>
      )}
    </Card>
  )
}
export default function Orders({showToast}) {
  const [orders,setOrders]=useState([])
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('todos')
  const [search,setSearch]=useState('')
  const [expanded,setExpanded]=useState(null)
  const [selected,setSelected]=useState(new Set())
  const [verArchivados,setVerArchivados]=useState(false)
  const [editing,setEditing]=useState(null)
  const load=useCallback(async()=>{setLoading(true);const{data}=await supabase.from('orders').select('*, order_items(*)').order('created_at',{ascending:false});setOrders(data||[]);setLoading(false)},[])
  useEffect(()=>{load()},[load])
  const toggleSelect=(id)=>setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const toggle=async(field,id,current)=>{await supabase.from('orders').update({[field]:!current}).eq('id',id);setOrders(prev=>prev.map(o=>o.id===id?{...o,[field]:!current}:o));showToast('Estado actualizado')}
  const deleteOrder=async(id)=>{if(!confirm('¿Eliminar este pedido?'))return;await supabase.from('orders').delete().eq('id',id);setOrders(prev=>prev.filter(o=>o.id!==id));setExpanded(null);setSelected(prev=>{const n=new Set(prev);n.delete(id);return n});showToast('Pedido eliminado')}
  const openWhatsApp=(ordersToSend)=>{if(ordersToSend.length===0){showToast('Selecciona al menos un pedido','error');return};const msg=buildWhatsAppMessage(ordersToSend);window.open('https://wa.me/'+AMWAY_WHATSAPP+'?text='+encodeURIComponent(msg),'_blank')}
  const sendSelected=()=>openWhatsApp(orders.filter(o=>selected.has(o.id)))
  const activos=orders.filter(o=>!esCerrado(o))
  const archivados=orders.filter(o=>esCerrado(o))
  const visible=activos.filter(o=>{if(filter==='pendiente_pago')return !o.pagado_rafa;if(filter==='pendiente_entrega')return !o.entregado_cliente;return true}).filter(o=>search===''||o.client_name.toLowerCase().includes(search.toLowerCase()))
  const selectedOrders=orders.filter(o=>selected.has(o.id))
  const totalSelIVAI=selectedOrders.reduce((s,o)=>s+o.total,0)
  const calcSel=totalSelIVAI>0?calcular(totalSelIVAI):null
  const cardProps={expanded,setExpanded,selected,toggleSelect,toggle,deleteOrder,openWhatsApp,setEditing}
  return (
    <div style={{padding:28}} className="fade-in">
      <h1 style={{fontSize:24,color:'#e8f5e9',margin:'0 0 4px'}}>Pedidos</h1>
      <p style={{color:'#6b9e6b',margin:'0 0 20px',fontFamily:'sans-serif',fontSize:14}}>Marcá los pedidos con el checkbox y envialos a Amway por WhatsApp</p>
      {calcSel?(
        <div style={{background:'#111d13',border:'1px solid #2d4a2d',borderRadius:12,padding:18,marginBottom:20}}>
          <div style={{color:'#9dc89a',fontSize:12,fontFamily:'sans-serif',fontWeight:700,marginBottom:12,textTransform:'uppercase',letterSpacing:1}}>Resumen — {selected.size} pedido{selected.size!==1?'s':''} seleccionado{selected.size!==1?'s':''}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
            {[{label:'Total IVAI',value:calcSel.totalIVAI,color:'#9dc89a'},{label:'Sin impuesto',value:calcSel.sinImpuesto,color:'#9dc89a'},{label:'Impuestos (13%)',value:calcSel.impuestos,color:'#f59e0b'},{label:'Ganancia (30%)',value:calcSel.ganancia,color:'#34d399'},{label:'Total pagar a Rafa',value:calcSel.pagarRafa,color:'#4ade80'}].map(r=>(
              <div key={r.label} style={{background:'#0d1710',borderRadius:8,padding:'10px 14px'}}>
                <div style={{color:'#4a7a4a',fontSize:11,fontFamily:'sans-serif',marginBottom:4}}>{r.label}</div>
                <div style={{color:r.color,fontSize:15,fontWeight:'bold',fontFamily:'sans-serif'}}>{fmt(r.value)}</div>
              </div>
            ))}
          </div>
          <button onClick={sendSelected} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,background:'#25D366',color:'white',border:'none',borderRadius:10,padding:'14px',cursor:'pointer',fontSize:16,fontFamily:'sans-serif',fontWeight:700,boxShadow:'0 4px 16px rgba(37,211,102,0.3)'}}>
            📱 Enviar pedidos seleccionados a Amway por WhatsApp
          </button>
        </div>
      ):(
        <div style={{background:'#111d13',border:'2px dashed #2d4a2d',borderRadius:12,padding:16,marginBottom:20,textAlign:'center'}}>
          <div style={{color:'#4a7a4a',fontFamily:'sans-serif',fontSize:14}}>☑️ Marcá los pedidos con el checkbox para ver el resumen y enviarlos a Amway</div>
        </div>
      )}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        {FILTERS.map(f=>(
          <button key={f.v} onClick={()=>setFilter(f.v)} style={{padding:'6px 14px',borderRadius:99,border:'none',cursor:'pointer',fontSize:13,fontFamily:'sans-serif',background:filter===f.v?'#166534':'#1a2e1a',color:filter===f.v?'white':'#9dc89a'}}>{f.l}</button>
        ))}
        <div style={{position:'relative',marginLeft:'auto'}}>
          <span style={{position:'absolute',left:9,top:10,color:'#4a7a4a'}}><Icon name="search" size={14}/></span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente..." style={{...inputSt,marginBottom:0,paddingLeft:30,width:200}}/>
        </div>
      </div>
      {loading&&<Spinner/>}
      {!loading&&visible.length===0&&<div style={{textAlign:'center',padding:40,color:'#4a7a4a',fontFamily:'sans-serif'}}>No hay pedidos activos</div>}
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
        {visible.map(o=><PedidoCard key={o.id} o={o} {...cardProps}/>)}
      </div>
      {archivados.length>0&&(
        <div>
          <button onClick={()=>setVerArchivados(!verArchivados)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',background:'#0d1710',border:'1px solid #1e3a1e',borderRadius:10,padding:'12px 16px',cursor:'pointer',color:'#4a7a4a',fontFamily:'sans-serif',fontSize:14,marginBottom:verArchivados?10:0}}>
            <span style={{transform:verArchivados?'rotate(180deg)':'none',transition:'0.2s'}}><Icon name="chevron" size={16}/></span>
            📦 Pedidos cerrados / archivados ({archivados.length})
          </button>
          {verArchivados&&<div style={{display:'flex',flexDirection:'column',gap:10}} className="slide-in">{archivados.map(o=><PedidoCard key={o.id} o={o} {...cardProps}/>)}</div>}
        </div>
      )}
      {editing&&<EditOrder order={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}} showToast={showToast}/>}
    </div>
  )
}
