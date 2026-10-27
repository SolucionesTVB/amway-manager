import { neon } from '@neondatabase/serverless';

const tables = {
  clients: new Set(['id','name','type','phone','created_at']),
  orders: new Set(['id','client_id','client_name','client_type','period','total','entregado_tv','entregado_cliente','pagado_rafa','pagado_tv','created_at']),
  order_items: new Set(['id','order_id','product_code','product_name','unit_price','qty','total'])
};
const allowedOps = new Set(['select','count','insert','update','delete','upsert']);
const q = (id) => '"' + id.replaceAll('"','""') + '"';
const reply = (res, status, data) => res.status(status).json(data);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return reply(res,405,{data:null,error:'Método no permitido'});
  const user = process.env.AMWAY_ADMIN_USER;
  const pass = process.env.AMWAY_ADMIN_PASSWORD;
  if (!user || !pass || !process.env.DATABASE_URL) return reply(res,503,{data:null,error:'Sistema pendiente de configuración segura'});
  const expected = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
  const provided = req.headers.authorization || '';
  const crypto = await import('node:crypto');
  const a = Buffer.from(provided), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) {
    res.setHeader('WWW-Authenticate','Basic realm="Amway Manager"');
    return reply(res,401,{data:null,error:'Acceso no autorizado'});
  }

  const {table,operation='select',columns='*',filters=[],order,ascending=true,limit,single=false,data,upsertOptions={}} = req.body || {};
  if (!Object.hasOwn(tables,table) || !allowedOps.has(operation)) return reply(res,400,{data:null,error:'Tabla u operación inválida'});
  const allowed = tables[table];
  const check = (field) => typeof field === 'string' && allowed.has(field);
  const tableSql = q(table);
  let sqlText = '';
  const values = [];
  const val = (v) => { values.push(v); return '$' + values.length; };
  try {
    if (!Array.isArray(filters) || filters.length > 12) throw Error('Filtros inválidos');
    const terms = [];
    for (const f of filters) {
      if (!check(f.column) || !['eq','ilike'].includes(f.type)) throw Error('Filtro no permitido');
      terms.push(q(f.column) + (f.type === 'eq' ? ' = ' : ' ILIKE ') + val(f.value));
    }
    const where = terms.length ? ' WHERE ' + terms.join(' AND ') : '';
    const sorting = order ? (check(order) ? ' ORDER BY '+q(order)+(ascending?' ASC':' DESC') : (()=>{throw Error('Orden inválido')})()) : '';
    const nLimit = limit == null ? 500 : Number(limit);
    if (!Number.isInteger(nLimit) || nLimit < 1 || nLimit > 500) throw Error('Límite inválido');
    const row = (item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('Datos inválidos');
      const keys=Object.keys(item);
      if (!keys.length || keys.some(k=>!check(k))) throw Error('Columnas inválidas');
      return keys;
    };
    if (operation === 'count') sqlText='SELECT COUNT(*)::int AS count FROM '+tableSql+where;
    else if (operation === 'select') {
      const selected=String(columns).split(',').map(s=>s.trim()).filter(Boolean);
      const nested=selected.some(c=>/^order_items\s*\(/.test(c));
      const chosen=selected.filter(c=>!/^order_items\s*\(/.test(c));
      if (nested && table !== 'orders') throw Error('Relación inválida');
      if (chosen.some(c=>c!=='*'&&!check(c))) throw Error('Columnas inválidas');
      sqlText='SELECT '+(chosen.includes('*')?'*':chosen.map(q).join(', '))+ ' FROM '+tableSql+where+sorting+' LIMIT '+nLimit;
      if(nested && !chosen.includes('id') && !chosen.includes('*')) throw Error('Se requiere ID del pedido');
    } else {
      if (operation !== 'insert' && operation !== 'upsert' && terms.length === 0) {
        if (operation !== 'upsert') throw Error('Operación sin filtro prohibida');
      }
      if (operation === 'delete') sqlText='DELETE FROM '+tableSql+where+' RETURNING *';
      else if (operation === 'update') {
        const keys=row(data);
        sqlText='UPDATE '+tableSql+' SET '+keys.map(k=>q(k)+' = '+val(data[k])).join(', ')+where+' RETURNING *';
      } else {
        const entries=Array.isArray(data)?data:[data];
        if(entries.length<1||entries.length>100) throw Error('Límite de filas');
        let result=[];
        const sql=neon(process.env.DATABASE_URL);
        for(const item of entries) {
          const keys=row(item);
          const args=[];const markers=keys.map((k,i)=>{args.push(item[k]);return '$'+(i+1)});
          let statement='INSERT INTO '+tableSql+' ('+keys.map(q).join(', ')+') VALUES ('+markers.join(', ')+')';
          if(operation==='upsert'){
            const conflict=upsertOptions.onConflict||'id';
            if(!check(conflict)) throw Error('Conflicto inválido');
            const editable=keys.filter(k=>k!==conflict);
            statement+=' ON CONFLICT ('+q(conflict)+') '+(editable.length?'DO UPDATE SET '+editable.map(k=>q(k)+' = EXCLUDED.'+q(k)).join(', '):'DO NOTHING');
          }
          result=await sql.query(statement+' RETURNING *',args);
        }
        return reply(res,200,{data:Array.isArray(data)?result:(result[0]||null),error:null});
      }
    }
    const sql=neon(process.env.DATABASE_URL);
    const rows=await sql.query(sqlText,values);
    if(operation==='count') return reply(res,200,{count:rows[0]?.count||0,error:null});
    if(operation==='select' && table==='orders' && String(columns).includes('order_items(')) {
      for(const item of rows) item.order_items=await sql.query('SELECT * FROM order_items WHERE order_id = $1',[item.id]);
    }
    return reply(res,200,{data:single?(rows[0]||null):rows,error:null});
  } catch(err) {
    console.error('Amway DB error:',err);
    return reply(res,400,{data:null,error:'No se pudo procesar la solicitud'});
  }
}
