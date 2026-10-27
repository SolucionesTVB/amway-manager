import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
const xml = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function imageRows(orders,summary,mode) {
  const rows=[];
  if(mode==='rafa'){
    const products=new Map();
    for(const o of orders) for(const item of o.order_items){
      const key=String(item.product_code||'')+'|'+String(item.unit_price);
      const p=products.get(key)||{name:item.product_name||'Producto',code:item.product_code||'',qty:0,net:0};
      p.qty+=Number(item.qty)||0;p.net+=(Number(item.total)||0)*(1-0.30/1.13);products.set(key,p);
    }
    for(const p of [...products.values()].sort((a,b)=>a.name.localeCompare(b.name)))
      rows.push({name:p.name,detail:'Código: '+p.code+'  ·  Cantidad: '+p.qty+'  ·  Neto unitario: '+money(p.qty?p.net/p.qty:0),amount:money(p.net)});
  }else{
    for(const o of orders){
      rows.push({name:'Cliente: '+o.client_name,detail:'Período: '+o.period,amount:''});
      for(const p of o.order_items) rows.push({name:p.product_name||p.product_code||'Producto',detail:'Cantidad: '+p.qty,amount:money(p.total)});
    }
  }
  return rows;
}
async function pngReport(orders,summary,mode,group){
  const rows=imageRows(orders,summary,mode);
  const width=1080, pad=64, rowH=106;
  const height=Math.max(570,350+rows.length*rowH);
  if(height>16000) throw new Error('Demasiados productos para una sola imagen');
  const wrap=(value,max=54)=>{const words=String(value||'').split(/\s+/);const lines=[''];for(const w of words){let i=lines.length-1;if((lines[i]+' '+w).trim().length>max){lines.push(w)}else lines[i]=(lines[i]+' '+w).trim()}return lines.slice(0,2)};
  const content=rows.map((r,i)=>{
    const y=225+i*rowH;const name=wrap(r.name);
    return '<rect x="50" y="'+(y-28)+'" width="980" height="98" rx="12" fill="'+(i%2?'#f2f7f3':'#ffffff')+'"/>'+
    name.map((v,j)=>'<text x="72" y="'+(y+j*25)+'" font-size="24" font-weight="700" fill="#163a25">'+xml(v)+'</text>').join('')+
    '<text x="72" y="'+(y+55)+'" font-size="19" fill="#506958">'+xml(r.detail)+'</text>'+
    '<text x="1008" y="'+(y+25)+'" font-size="23" text-anchor="end" font-weight="700" fill="#163a25">'+xml(r.amount)+'</text>';
  }).join('');
  const foot=height-118;
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><rect width="100%" height="100%" fill="#ffffff"/><rect width="1080" height="154" fill="#163a25"/><text x="64" y="67" font-size="36" font-weight="700" fill="#ffffff">AMWAY MANAGER CR</text><text x="64" y="115" font-size="25" fill="#d2ead7">'+(mode==='cliente'?'PEDIDO DEL CLIENTE':'PEDIDO PARA RAFA')+'</text><text x="64" y="184" font-size="20" fill="#506958">Referencia: '+xml(group.slice(0,8).toUpperCase())+'  ·  '+xml(new Date().toLocaleDateString('es-CR'))+'</text>'+content+'<line x1="64" y1="'+(foot-25)+'" x2="1016" y2="'+(foot-25)+'" stroke="#c8d9cb" stroke-width="2"/><text x="64" y="'+(foot+28)+'" font-size="26" font-weight="700" fill="#163a25">'+(mode==='cliente'?'TOTAL A PAGAR':'NETO A PAGAR A RAFA')+'</text><text x="1016" y="'+(foot+28)+'" font-size="30" text-anchor="end" font-weight="700" fill="#163a25">'+xml(money(mode==='cliente'?summary.total:summary.neto))+'</text></svg>';
  return sharp(Buffer.from(svg)).png().toBuffer();
}


const money = n => 'CRC ' + Math.round(Number(n) || 0).toLocaleString('es-CR');
const esc = s => String(s ?? '').replace(/[\\()]/g, m => '\\' + m).replace(/[\r\n]+/g,' ').replace(/[^\x20-\xFF]/g, '?');
const line = (txt,x,y,size=10,bold=false) => 'BT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+esc(txt)+') Tj ET\n';
function pdfPages(pages) {
  const objs=[null]; const add=s=>{objs.push(s);return objs.length-1};
  const catalog=add(''); const pagesId=add('');
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageRefs=[];
  for (const content of pages) {
    const stream=Buffer.from(content,'latin1');
    const cont=add('<< /Length '+stream.length+' >>\nstream\n'+stream.toString('latin1')+'\nendstream');
    const page=add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+font+' 0 R /F2 '+fontBold+' 0 R >> >> /Contents '+cont+' 0 R >>');
    pageRefs.push(page);
  }
  objs[catalog]='<< /Type /Catalog /Pages '+pagesId+' 0 R >>';
  objs[pagesId]='<< /Type /Pages /Kids ['+pageRefs.map(i=>i+' 0 R').join(' ')+'] /Count '+pageRefs.length+' >>';
  const parts=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','latin1')]; let off=parts[0].length; const offsets=[0];
  for(let i=1;i<objs.length;i++){offsets[i]=off;const b=Buffer.from(i+' 0 obj\n'+objs[i]+'\nendobj\n','latin1');parts.push(b);off+=b.length;}
  const start=off;
  const xref='xref\n0 '+objs.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+objs.length+' /Root '+catalog+' 0 R >>\nstartxref\n'+start+'\n%%EOF';
  parts.push(Buffer.from(xref,'ascii'));return Buffer.concat(parts);
}
function buildPages(orders,summary,group,mode='rafa') {
  const pages=[];let text='',y=0;
  const start=()=>{text='0.14 0.33 0.21 rg\n';y=797;text+=line('AMWAY MANAGER CR',45,y,19,true);text+='0 0 0 rg\n';y-=25;text+=line(mode==='cliente'?'CUENTA DEL CLIENTE':'PEDIDO PARA RAFA',45,y,12,true);y-=23;text+=line('Referencia: '+group.slice(0,8).toUpperCase()+'   Fecha: '+new Date().toLocaleDateString('es-CR'),45,y,10);y-=26;text+='0.7 0.7 0.7 RG 45 '+y+' m 550 '+y+' l S\n';y-=18};
  const next=()=>{pages.push(text);start()};
  const row=(description,right,{bold=false,indent=0}={})=>{if(y<76)next();text+=line(description,45+indent,y,10,bold);text+=line(right,425,y,10,bold);y-=18};
  start();
  if(mode==='rafa') {
    // Consolidar por codigo, sin nombres ni datos de clientes.
    const productos=new Map();
    for(const o of orders) for(const item of o.order_items) {
      const code=String(item.product_code||'');
      const key=code+'|'+String(item.unit_price);
      const prev=productos.get(key)||{name:item.product_name||'Producto',code,qty:0,neto:0};
      prev.qty+=Number(item.qty)||0;
      prev.neto+=(Number(item.total)||0)*(1-0.30/1.13);
      productos.set(key,prev);
    }
    text+=line('PRODUCTO / CODIGO',45,y,9,true);
    text+=line('CANT.',338,y,9,true);
    text+=line('PRECIO NETO',398,y,9,true);
    text+=line('SUBTOTAL',493,y,9,true);y-=22;
    for(const p of [...productos.values()].sort((a,b)=>a.name.localeCompare(b.name))) {
      if(y<85)next();
      text+=line(String(p.name).slice(0,45),45,y,9);
      y-=13;
      text+=line('Codigo: '+p.code,55,y,8);
      text+=line(String(p.qty),344,y,9);
      text+=line(money(p.qty?p.neto/p.qty:0),395,y,9);
      text+=line(money(p.neto),488,y,9);
      y-=23;
    }
  } else {
    for(const o of orders) {
      if(y<145)next();
      text+=line('Cliente: '+o.client_name+'  |  Periodo: '+o.period,45,y,11,true);y-=22;
      for(const item of o.order_items) {
        const desc=(item.product_name||item.product_code||'Producto').slice(0,50);
        row(desc+'  x'+item.qty,money(item.total),{indent:8});
      }
      y-=8;
    }
  }
  if(y<180)next();
  text+='0.7 0.7 0.7 RG 45 '+y+' m 550 '+y+' l S\n';y-=25;
  if(mode==='cliente') {row('TOTAL A PAGAR POR EL CLIENTE',money(summary.total),{bold:true});} else {row('NETO A PAGAR A RAFA',money(summary.neto),{bold:true});}
  y-=20;
  text+=line(mode==='cliente'?'Detalle de productos y total de su pedido.':'Preparar el pedido segun los productos y cantidades indicados.',45,y,9);
  pages.push(text);
  return pages;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!process.env.DATABASE_URL) return res.status(503).json({error:'Base de datos no configurada'});
  const sql=neon(process.env.DATABASE_URL);
  if(req.method==='GET') {
    const id=req.query.orderId;
    if(typeof id!=='string'||!/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(id))return res.status(400).json({error:'ID inválido'});
    try {
      const history=await sql.query('SELECT id, report_group, created_at, total_ivai, subtotal_sin_iva, impuesto, ganancia, neto_pagar FROM amway_order_reports WHERE order_id=$1 ORDER BY created_at DESC LIMIT 100',[id]);
      return res.status(200).json({data:history});
    } catch(e){console.error(e);return res.status(500).json({error:'Error consultando historial'});}
  }
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
  const ids=req.body?.orderIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>35||ids.some(x=>typeof x!=='string'||!/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(x)))return res.status(400).json({error:'Selección inválida'});
  const mode=req.body?.mode==='cliente'?'cliente':'rafa';
  if(mode==='cliente' && ids.length!==1)return res.status(400).json({error:'El documento del cliente corresponde a un solo pedido'});
  const unique=[...new Set(ids)];
  try {
    const orders=await sql.query('SELECT id,client_name,period,total FROM orders WHERE id=ANY($1::uuid[]) ORDER BY created_at',[unique]);
    if(orders.length!==unique.length)return res.status(404).json({error:'Hay pedidos no encontrados'});
    let total=0,iva=0,neto=0;const snapshots=[];
    for(const o of orders) {
      o.order_items=await sql.query('SELECT product_code,product_name,qty,unit_price,total FROM order_items WHERE order_id=$1 ORDER BY product_name',[o.id]);
      const t=Number(o.total)||0;const sin=t/1.13;const tax=t-sin;const profit=sin*0.30;const pay=sin-profit+tax;
      snapshots.push({id:o.id,total:Math.round(t),subtotal:Math.round(sin),iva:Math.round(tax),ganancia:Math.round(profit),neto:Math.round(pay),items:o.order_items});
      total+=t;iva+=tax;neto+=pay;
    }
    const group=randomUUID();
    const buffer=await pngReport(orders,{total,iva,neto},mode,group);
    if(mode==='rafa')for(const snap of snapshots){
      await sql.query('INSERT INTO amway_order_reports (order_id,report_group,total_ivai,subtotal_sin_iva,impuesto,ganancia,neto_pagar,items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[snap.id,group,snap.total,snap.subtotal,snap.iva,snap.ganancia,snap.neto,JSON.stringify(snap.items)]);
    }
    res.setHeader('Content-Type','image/png');
    res.setHeader('Content-Disposition','attachment; filename="pedido-amway-'+group.slice(0,8)+'.png"');
    return res.status(200).send(buffer);
  } catch(e){console.error('PDF Amway:',e);return res.status(500).json({error:'No se pudo crear el PDF'});}
}
