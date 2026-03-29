import { neon } from '@neondatabase/serverless'

const sql = neon('postgresql://neondb_owner:npg_QVPIHMhn4i8e@ep-royal-queen-an29u7j4-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require')

const q = (query) => sql.query(query)

export const supabase = { from: (t) => new QB(t) }

class QB {
  constructor(t) {
    this.t=t; this._f=[]; this._o=null; this._asc=true; this._cols='*'
    this._upd=null; this._ins=null; this._del=false; this._ups=null
    this._upsOpts={}; this._single=false; this._head=false; this._cnt=null; this._lim=null
  }
  select(c,opts) { c=c||'*'; opts=opts||{}; this._cols=c; if(opts.count) this._cnt=opts.count; if(opts.head) this._head=true; return this }
  insert(d) { this._ins=d; return this }
  update(d) { this._upd=d; return this }
  delete() { this._del=true; return this }
  upsert(d,opts) { this._ups=d; this._upsOpts=opts||{}; return this }
  eq(c,v) { this._f.push({type:'eq',c:c,v:v}); return this }
  ilike(c,v) { this._f.push({type:'ilike',c:c,v:v}); return this }
  order(c,opts) { this._o=c; this._asc=(opts||{}).ascending!==false; return this }
  single() { this._single=true; return this }
  limit(n) { this._lim=n; return this }

  esc(v) {
    if(v===null||v===undefined) return 'NULL'
    if(v===true) return 'TRUE'
    if(v===false) return 'FALSE'
    return "'" + String(v).replace(/'/g, "''") + "'"
  }

  where() {
    if(!this._f.length) return ''
    const self = this
    return 'WHERE ' + this._f.map(function(f) {
      if(f.type==='eq') return f.c + " = '" + f.v + "'"
      return f.c + " ILIKE '" + f.v + "'"
    }).join(' AND ')
  }

  async then(res, rej) {
    try {
      const w = this.where()
      const ord = this._o ? ('ORDER BY ' + this._o + ' ' + (this._asc ? 'ASC' : 'DESC')) : ''
      const lim = this._lim ? ('LIMIT ' + this._lim) : ''

      if(this._del) {
        await q('DELETE FROM ' + this.t + ' ' + w)
        return res({data:null, error:null})
      }

      if(this._upd) {
        const self = this
        const sets = Object.entries(this._upd).map(function(e) { return e[0] + ' = ' + self.esc(e[1]) }).join(', ')
        await q('UPDATE ' + this.t + ' SET ' + sets + ' ' + w)
        return res({data:null, error:null})
      }

      if(this._ins) {
        const rows = Array.isArray(this._ins) ? this._ins : [this._ins]
        let last = null
        const self = this
        for(const row of rows) {
          const keys = Object.keys(row).join(', ')
          const vals = Object.values(row).map(function(v) { return self.esc(v) }).join(', ')
          const r = await q('INSERT INTO ' + this.t + ' (' + keys + ') VALUES (' + vals + ') RETURNING *')
          last = r[0]
        }
        return res({data:last, error:null})
      }

      if(this._ups) {
        const rows = Array.isArray(this._ups) ? this._ups : [this._ups]
        const conflict = this._upsOpts.onConflict || 'id'
        const self = this
        for(const row of rows) {
          const keys = Object.keys(row).join(', ')
          const vals = Object.values(row).map(function(v) { return self.esc(v) }).join(', ')
          const sets = Object.keys(row).filter(function(k) { return k!=='id' }).map(function(k) { return k + ' = EXCLUDED.' + k }).join(', ')
          await q('INSERT INTO ' + this.t + ' (' + keys + ') VALUES (' + vals + ') ON CONFLICT (' + conflict + ') DO UPDATE SET ' + sets)
        }
        return res({data:null, error:null})
      }

      if(this._head && this._cnt) {
        const r = await q('SELECT COUNT(*) as count FROM ' + this.t + ' ' + w)
        return res({count: parseInt(r[0].count), error:null})
      }

      if(this._cols.includes('order_items')) {
        const orders = await q('SELECT * FROM ' + this.t + ' ' + w + ' ' + ord + ' ' + lim)
        for(const o of orders) {
          o.order_items = await q("SELECT * FROM order_items WHERE order_id = '" + o.id + "'")
        }
        if(this._single) return res({data: orders[0]||null, error:null})
        return res({data: orders, error:null})
      }

      const r = await q('SELECT * FROM ' + this.t + ' ' + w + ' ' + ord + ' ' + lim)
      if(this._single) return res({data: r[0]||null, error:null})
      return res({data: r, error:null})

    } catch(e) {
      console.error('DB Error:', e)
      res({data:null, error:e})
    }
  }
}
