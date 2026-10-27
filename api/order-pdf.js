import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

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
function buildPages(orders,summary,group) {
  const pages=[];let text='',y=0;
  const start=()=>{text='0.14 0.33 0.21 rg\n';y=797;text+=line('AMWAY MANAGER CR',45,y,19,true);text+='0 0 0 rg\n';y-=25;text+=line('PEDIDO PARA PREPARACION',45,y,12,true);y-=23;text+=line('Referencia: '+group.slice(0,8).toUpperCase()+'   Fecha: '+new Date().toLocaleDateString('es-CR'),45,y,10);y-=26;text+='0.7 0.7 0.7 RG 45 '+y+' m 550 '+y+' l S\n';y-=18};
  const next=()=>{pages.push(text);start()};
  const row=(description,right,{bold=false,indent=0}={})=>{if(y<76)next();text+=line(description,45+indent,y,10,bold);text+=line(right,425,y,10,bold);y-=18};
  start();
  for(const o of orders) {
    if(y<145)next();
    text+=line('Cliente: '+o.client_name+'  |  Periodo: '+o.period,45,y,11,true);y-=22;
    for(const item of o.order_items) {
      const desc=(item.product_name||item.product_code||'Producto').slice(0,50);
      row(desc+'  x'+item.qty,money(item.total),{indent:8});
    }
    y-=8;
  }
  if(y<180)next();
  text+='0.7 0.7 0.7 RG 45 '+y+' m 550 '+y+' l S\n';y-=25;
  row('Total del pedido, IVA incluido',money(summary.total),{bold:true});
  row('Impuesto incluido (13%)',money(summary.iva));
  y-=10;
  row('NETO A PAGAR A AMWAY',money(summary.neto),{bold:true});
  y-=20;
  text+=line('Preparar el pedido segun los productos y cantidades indicados.',45,y,9);
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
    const buffer=pdfPages(buildPages(orders,{total,iva,neto},group));
    for(const snap of snapshots){
      await sql.query('INSERT INTO amway_order_reports (order_id,report_group,total_ivai,subtotal_sin_iva,impuesto,ganancia,neto_pagar,items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[snap.id,group,snap.total,snap.subtotal,snap.iva,snap.ganancia,snap.neto,JSON.stringify(snap.items)]);
    }
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition','attachment; filename="pedido-amway-'+group.slice(0,8)+'.pdf"');
    return res.status(200).send(buffer);
  } catch(e){console.error('PDF Amway:',e);return res.status(500).json({error:'No se pudo crear el PDF'});}
}
