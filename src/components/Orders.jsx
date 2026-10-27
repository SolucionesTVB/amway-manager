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

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function calcular(valor) {
  const t = num(valor)
  const s = t / 1.13
  const im = t - s
  const g = s * 0.30
  const r = (s - g) + im

  return {
    totalIVAI: Math.round(t),
    sinImpuesto: Math.round(s),
    impuestos: Math.round(im),
    ganancia: Math.round(g),
    pagarRafa: Math.round(r)
  }
}
function buildWhatsAppMessage(orders) {
  const today = new Date().toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  const pm = {}

  orders.forEach(o => {
    ;(o.order_items || []).forEach(it => {
      const qty = num(it.qty)
      const total = num(it.total)
      const price = num(it.unit_price)

      if (pm[it.product_code]) {
        pm[it.product_code].qty += qty
        pm[it.product_code].total += total
      } else {
        pm[it.product_code] = {
          name: it.product_name,
          code: it.product_code,
          qty,
          price,
          total
        }
      }
    })
  })

  const prods = Object.values(pm).sort((a, b) => a.name.localeCompare(b.name))
  const totalIVAI = prods.reduce((s, p) => s + num(p.total), 0)
  const calc = calcular(totalIVAI)
  const clientes = [...new Set(orders.map(o => o.client_name).filter(Boolean))].join(', ')

  let msg = ''
  msg += '*PEDIDO AMWAY CR*\n'
  msg += 'Fecha: ' + today + '\n'
  if (clientes) msg += 'Clientes: ' + clientes + '\n'
  msg += 'Pedidos incluidos: ' + orders.length + '\n'
  msg += '\n'
  msg += '*PRODUCTOS*\n\n'

  prods.forEach((p, idx) => {
    msg += `${idx + 1}. *${p.name}*\n`
    msg += `   Código: ${p.code}\n`
    msg += `   Cantidad: ${p.qty}\n`
    msg += `   Precio unitario: ${fmt(p.price)}\n`
    msg += `   Subtotal: ${fmt(p.total)}\n`
    if (idx < prods.length - 1) msg += '\n'
  })

  msg += '\n\n'
  msg += '*RESUMEN*\n'
  msg += `Total pedido IVAI: ${fmt(calc.totalIVAI)}\n`
  msg += `Subtotal sin impuesto: ${fmt(calc.sinImpuesto)}\n`
  msg += `Impuestos (13%): ${fmt(calc.impuestos)}\n`
  msg += `*Total pagar a Rafa: ${fmt(calc.pagarRafa)}*\n`
  msg += '\n'
  msg += 'Por favor preparar este pedido. Gracias.\n'
  msg += '\n'
  msg += '_Enviado desde Amway Manager CR_'

  return msg
}
function PedidoCard({o,expanded,setExpanded,selected,toggleSelect,toggle,deleteOrder,setEditing,downloadPdf,sharePdf,clientPdf}) {
  const [history,setHistory]=useState(null)
  const [historyLoading,setHistoryLoading]=useState(false)
  const loadHistory=async()=>{
    setHistoryLoading(true)
    try {const r=await fetch('/api/order-pdf?orderId='+encodeURIComponent(o.id));const j=await r.json();setHistory(j.data||[])}
    catch(e){setHistory([])}
    finally{setHistoryLoading(false)}
  }
  const calc=calcular(num(o.total)),isSelected=selected.has(o.id),cerrado=esCerrado(o)
  return (
    <Card style={{border:isSelected?'1px solid #4ade80':'1px solid #1e3a1e',opacity:cerrado?0.85:1}}>
      <div style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:12}}>
        <div onClick={()=>toggleSelect(o.id)} style={{width:22,height:22,borderRadius:6,flexShrink:0,cursor:'pointer',border:'2px solid '+(isSelected?'#4ade80':'#4a7a4a'),background:isSelected?'#4ade80':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
          {isSelected&&<Icon name="check" size={13} color="#14532d"/>}
        </div>
        <div style={{flex:1,cursor:'pointer'}} onClick={()=>setExpanded(expanded===o.id?null:o.id)}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5,flexWrap:'wrap'}}>
            <span style={{fontWeight:'bold',color:'#e8f5e9',fontSize:16}}>{o.client_name}</span>
            <span style={{background:'#1a2e1a',color:'#4ade80',borderRadius:99,fontSize:11,padding:'1px 8px',fontFamily:'sans-serif'}}>{o.client_type==='empresario'?'Empresario':'Cliente'}</span>
            <span style={{color:'#4a7a4a',fontSize:12,fontFamily:'sans-serif'}}>{o.period}</span>
            {cerrado&&<span style={{background:'#14532d',color:'#4ade80',borderRadius:99,fontSize:11,padding:'1px 8px',fontFamily:'sans-serif'}}>Cerrado</span>}
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{color:'#4ade80',fontWeight:'bold',fontFamily:'sans-serif',fontSize:15}}>{fmt(o.total)}</span>
            <Badge ok={o.pagado_rafa} yes="Pagado" no="Pendiente pago"/>
            <Badge ok={o.entregado_cliente} yes="Entregado" no="Sin entregar"/>
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
                <div style={{color:'#4a7a4a',fontSize:12,fontFamily:'sans-serif'}}>Codigo: {it.product_code}</div>
              </div>
              <div style={{textAlign:'right',fontFamily:'sans-serif'}}>
                <div style={{color:'#9dc89a',fontSize:13}}>{fmt(it.unit_price)} x {it.qty}</div>
                <div style={{color:'#4ade80',fontSize:15,fontWeight:'bold'}}>{fmt(it.total)}</div>
              </div>
            </div>
          ))}
          <div style={{marginTop:12,marginBottom:16,borderRadius:8,overflow:'hidden',border:'1px solid #2d4a2d'}}>
            {[
              {label:'Cobro al cliente (IVA incluido)',value:calc.totalIVAI,color:'#9dc89a',bold:false},
              {label:'Total sin impuesto',value:calc.sinImpuesto,color:'#9dc89a',bold:false},
              {label:'Impuestos (13%)',value:calc.impuestos,color:'#f59e0b',bold:false},
              {label:'Mi ganancia (30% sin IVA)',value:calc.ganancia,color:'#34d399',bold:false},
              {label:'Pago a Amway (Rafa)',value:calc.pagarRafa,color:'#4ade80',bold:true},
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
          <div style={{marginBottom:14,padding:12,border:'1px solid #2d4a2d',borderRadius:8}}>
            <button onClick={loadHistory} style={{background:'transparent',border:'none',color:'#9dc89a',fontWeight:700,cursor:'pointer',padding:0}}>
              {historyLoading?'Cargando historial...':'Ver historial de documentos y ganancia'}
            </button>
            {history?.length===0&&<div style={{fontSize:12,color:'#6b9e6b',marginTop:8}}>Aún no se ha generado un documento para este pedido.</div>}
            {history?.map(h=><div key={h.id} style={{marginTop:10,paddingTop:9,borderTop:'1px solid #2d4a2d',fontSize:12,color:'#9dc89a',fontFamily:'sans-serif'}}>
              <div>{new Date(h.created_at).toLocaleString('es-CR')} · Referencia {h.report_group.slice(0,8).toUpperCase()}</div>
              <div>Venta: <strong>{fmt(h.total_ivai)}</strong> · Ganancia guardada: <strong>{fmt(h.ganancia)}</strong> · Neto Amway: <strong>{fmt(h.neto_pagar)}</strong></div>
            </div>)}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setEditing(o)} style={{display:'flex',alignItems:'center',gap:6,background:'#166534',color:'white',border:'none',borderRadius:8,padding:'9px 14px',cursor:'pointer',fontSize:13,fontFamily:'sans-serif',fontWeight:600}}>Editar pedido</button>
              <button onClick={()=>sharePdf([o])} style={{background:'#25D366',color:'#103b24',border:0,borderRadius:8,padding:'9px 14px',cursor:'pointer',fontWeight:700}}>Enviar a Rafa</button>
              <button onClick={()=>clientPdf(o)} style={{background:'#2563eb',color:'white',border:0,borderRadius:8,padding:'9px 14px',cursor:'pointer',fontWeight:700}}>Pedido del cliente</button>
            </div>
            <button onClick={()=>deleteOrder(o.id)} style={{...btn.danger,fontSize:13,padding:'8px 16px'}}>Eliminar</button>
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
  const deleteOrder=async(id)=>{if(!confirm('Eliminar este pedido?'))return;await supabase.from('orders').delete().eq('id',id);setOrders(prev=>prev.filter(o=>o.id!==id));setExpanded(null);setSelected(prev=>{const n=new Set(prev);n.delete(id);return n});showToast('Pedido eliminado')}
  const openWhatsApp=(ordersToSend)=>{if(ordersToSend.length===0){showToast('Selecciona al menos un pedido','error');return};const msg=buildWhatsAppMessage(ordersToSend);window.open('https://wa.me/'+AMWAY_WHATSAPP+'?text='+encodeURIComponent(msg),'_blank')}
  const downloadPdf=async(ordersToSend)=>{
    if(ordersToSend.length===0){showToast('Selecciona al menos un pedido','error');return}
    try{
      const response=await fetch('/api/order-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderIds:ordersToSend.map(o=>o.id)})})
      if(!response.ok){const error=await response.json();throw new Error(error.error||'Error creando imagen')}
      const blob=await response.blob();const url=URL.createObjectURL(blob)
      const a=document.createElement('a');a.href=url;a.download='pedido-amway-'+new Date().toISOString().slice(0,10)+'.png';document.body.appendChild(a);a.click();a.remove()
      setTimeout(()=>URL.revokeObjectURL(url),5000)
      showToast('Imagen generada y cálculo guardado en historial')
    }catch(error){showToast(error.message||'Error al generar imagen','error')}
  }
  const sharePdf=async(ordersToSend)=>{
    if(!ordersToSend.length){showToast('Selecciona al menos un pedido','error');return}
    try{
      const response=await fetch('/api/order-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderIds:ordersToSend.map(o=>o.id)})})
      if(!response.ok){const j=await response.json();throw new Error(j.error||'Error creando documento')}
      const blob=await response.blob()
      const file=new File([blob],'pedido-amway-'+new Date().toISOString().slice(0,10)+'.png',{type:'image/png'})
      if(navigator.share && navigator.canShare?.({files:[file]})){
        await navigator.share({files:[file],title:'Pedido Amway',text:'Pedido de productos con neto a pagar'})
        showToast('Documento preparado para compartir')
      }else{
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove()
        setTimeout(()=>URL.revokeObjectURL(url),5000)
        showToast('Imagen descargada: adjúntalo en WhatsApp como foto')
      }
    }catch(e){if(e.name!=='AbortError')showToast(e.message||'No se pudo compartir','error')}
  }
  const clientPdf=async(o)=>{
    try{
      const response=await fetch('/api/order-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderIds:[o.id],mode:'cliente'})})
      if(!response.ok)throw Error((await response.json()).error||'Error al crear el documento')
      const file=new File([await response.blob()],'pedido-'+o.client_name.replace(/[^a-zA-Z0-9]/g,'-')+'.png',{type:'image/png'})
      if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Pedido de '+o.client_name})
      else {const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);showToast('Pedido descargado, adjúntalo al WhatsApp del cliente')}
    }catch(e){if(e.name!=='AbortError')showToast(e.message||'Error del documento','error')}
  }
  const activos=orders.filter(o=>!esCerrado(o))
  const archivados=orders.filter(o=>esCerrado(o))
  const visible=activos.filter(o=>{if(filter==='pendiente_pago')return !o.pagado_rafa;if(filter==='pendiente_entrega')return !o.entregado_cliente;return true}).filter(o=>search===''||o.client_name.toLowerCase().includes(search.toLowerCase()))
  const selectedOrders=orders.filter(o=>selected.has(o.id))
  const totalSelIVAI=selectedOrders.reduce((s,o)=>s+num(o.total),0)
  const calcSel=totalSelIVAI>0?calcular(totalSelIVAI):null
  const productosRafa=Object.values(selectedOrders.flatMap(o=>o.order_items||[]).reduce((acc,it)=>{
    const key=String(it.product_code)+'|'+String(it.unit_price)
    if(!acc[key])acc[key]={code:it.product_code,name:it.product_name,qty:0,neto:0}
    acc[key].qty+=num(it.qty)
    acc[key].neto+=num(it.total)*(1-0.30/1.13)
    return acc
  },{})).sort((a,b)=>a.name.localeCompare(b.name))

  const cardProps={expanded,setExpanded,selected,toggleSelect,toggle,deleteOrder,setEditing,downloadPdf,sharePdf,clientPdf}
  return (
    <div style={{padding:28}} className="fade-in">
      <h1 style={{fontSize:24,color:'#e8f5e9',margin:'0 0 4px'}}>Pedidos</h1>
      <p style={{color:'#6b9e6b',margin:'0 0 20px',fontFamily:'sans-serif',fontSize:14}}>Seleccioná pedidos para Rafa; cada cliente recibe únicamente su propio pedido</p>
      {calcSel?(
        <div style={{background:'#111d13',border:'1px solid #2d4a2d',borderRadius:12,padding:18,marginBottom:20}}>
          <div style={{color:'#9dc89a',fontSize:12,fontFamily:'sans-serif',fontWeight:700,marginBottom:12,textTransform:'uppercase',letterSpacing:1}}>Resumen — {selected.size} pedido{selected.size!==1?'s':''} seleccionado{selected.size!==1?'s':''}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12}}>
            <div style={{background:'#10251b',border:'1px solid #236b45',borderRadius:12,padding:16}}>
              <strong style={{color:'#d8f8e1'}}>1. Envío de pedido a Rafa</strong>
              <div style={{color:'#87ba9b',fontSize:12,marginTop:6}}>Productos y precio neto a pagar</div>
              <div style={{fontSize:24,fontWeight:700,color:'#4ade80',margin:'12px 0'}}>{fmt(calcSel.pagarRafa)}</div>
              <div style={{borderTop:'1px solid #236b45',paddingTop:10,marginBottom:14,overflowX:'auto'}}>
                <div style={{display:'grid',gridTemplateColumns:'minmax(160px,1fr) 50px 90px 100px',gap:5,color:'#87ba9b',fontSize:10,fontWeight:700,marginBottom:8}}>
                  <span>Producto</span><span>Cant.</span><span>Precio neto</span><span>Subtotal</span>
                </div>
                {productosRafa.map(p=><div key={p.code+'-'+p.neto} style={{display:'grid',gridTemplateColumns:'minmax(160px,1fr) 50px 90px 100px',gap:5,alignItems:'center',padding:'8px 0',borderTop:'1px solid #1d4532',fontFamily:'sans-serif',fontSize:11,color:'#d8f8e1'}}>
                  <span style={{overflowWrap:'normal',wordBreak:'normal',lineHeight:1.5}}>{p.name}<div style={{fontSize:10,color:'#87ba9b'}}>{p.code}</div></span>
                  <span>{p.qty}</span>
                  <span>{fmt(p.qty?p.neto/p.qty:0)}</span>
                  <strong>{fmt(p.neto)}</strong>
                </div>)}
              </div>
              <button onClick={()=>sharePdf(selectedOrders)} style={{width:'100%',background:'#25D366',color:'#103b24',border:0,borderRadius:8,padding:11,fontWeight:700,cursor:'pointer'}}>Compartir con Rafa</button>
              <button onClick={()=>downloadPdf(selectedOrders)} style={{width:'100%',background:'#1a3d29',color:'#dcfce7',border:'1px solid #236b45',borderRadius:8,padding:10,marginTop:8,cursor:'pointer'}}>Descargar imagen de Rafa</button>
            </div>
            <div style={{background:'#111d31',border:'1px solid #244978',borderRadius:12,padding:16}}>
              <strong style={{color:'#dbeafe'}}>2. Envío a cada cliente</strong>
              <div style={{color:'#9cb9e8',fontSize:12,marginTop:6}}>Cada cliente recibe sus productos y precio de venta</div>
              <div style={{fontSize:24,fontWeight:700,color:'#93c5fd',margin:'12px 0'}}>{fmt(calcSel.totalIVAI)}</div>
              {selectedOrders.map(o=><button key={o.id} onClick={()=>clientPdf(o)} style={{width:'100%',background:'#1d4ed8',color:'white',border:0,borderRadius:8,padding:10,marginTop:7,cursor:'pointer',textAlign:'left'}}>{o.client_name} · {fmt(o.total)} · Compartir</button>)}
            </div>
            <div style={{background:'#28200f',border:'1px solid #765d28',borderRadius:12,padding:16}}>
              <strong style={{color:'#fde68a'}}>3. Mi ganancia</strong>
              <div style={{color:'#e5c98e',fontSize:12,marginTop:6}}>Solo control interno · 30% del subtotal sin IVA</div>
              <div style={{fontSize:24,fontWeight:700,color:'#fbbf24',margin:'12px 0'}}>{fmt(calcSel.ganancia)}</div>
              {selectedOrders.map(o=><div key={o.id} style={{display:'flex',justifyContent:'space-between',gap:8,padding:'7px 0',borderBottom:'1px solid #554321',fontSize:12,color:'#fde68a'}}><span>{o.client_name}</span><strong>{fmt(calcular(o.total).ganancia)}</strong></div>)}
            </div>
          </div>
        </div>
      ):(
        <div style={{background:'#111d13',border:'2px dashed #2d4a2d',borderRadius:12,padding:16,marginBottom:20,textAlign:'center'}}>
          <div style={{color:'#4a7a4a',fontFamily:'sans-serif',fontSize:14}}>Marca los pedidos con el checkbox para ver el resumen y enviarlos a Amway</div>
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
            Pedidos cerrados / archivados ({archivados.length})
          </button>
          {verArchivados&&<div style={{display:'flex',flexDirection:'column',gap:10}} className="slide-in">{archivados.map(o=><PedidoCard key={o.id} o={o} {...cardProps}/>)}</div>}
        </div>
      )}
      {editing&&<EditOrder order={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}} showToast={showToast}/>}
    </div>
  )
}
