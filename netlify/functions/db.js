import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

const ALLOWED_TABLES = new Set([
  'clients',
  'orders',
  'order_items',
  'products',
  'settings'
])

const ALLOWED_OPERATIONS = new Set([
  'select',
  'insert',
  'update',
  'delete',
  'upsert',
  'count'
])

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}

function esc(value) {
  if (value === null || value === undefined) return 'NULL'
  if (value === true) return 'TRUE'
  if (value === false) return 'FALSE'
  return "'" + String(value).replace(/'/g, "''") + "'"
}

function where(filters = []) {
  if (!filters.length) return ''

  return 'WHERE ' + filters.map((filter) => {
    if (filter.type === 'eq') return `${filter.column} = ${esc(filter.value)}`
    if (filter.type === 'ilike') return `${filter.column} ILIKE ${esc(filter.value)}`
    throw new Error('Filtro no permitido')
  }).join(' AND ')
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { data: null, error: 'Método no permitido' })
  }

  try {
    if (!process.env.DATABASE_URL) {
      return json(500, { data: null, error: 'DATABASE_URL no configurada' })
    }

    const body = JSON.parse(event.body || '{}')
    const {
      table,
      operation,
      columns = '*',
      filters = [],
      order = null,
      ascending = true,
      limit = null,
      single = false,
      data = null,
      upsertOptions = {}
    } = body

    if (!ALLOWED_TABLES.has(table)) {
      return json(400, { data: null, error: 'Tabla no permitida' })
    }

    if (!ALLOWED_OPERATIONS.has(operation)) {
      return json(400, { data: null, error: 'Operación no permitida' })
    }

    const w = where(filters)
    const ord = order ? `ORDER BY ${order} ${ascending ? 'ASC' : 'DESC'}` : ''
    const lim = limit ? `LIMIT ${Number(limit)}` : ''

    if (operation === 'delete') {
      await sql.query(`DELETE FROM ${table} ${w}`)
      return json(200, { data: null, error: null })
    }

    if (operation === 'update') {
      const sets = Object.entries(data || {})
        .map(([key, value]) => `${key} = ${esc(value)}`)
        .join(', ')

      await sql.query(`UPDATE ${table} SET ${sets} ${w}`)
      return json(200, { data: null, error: null })
    }

    if (operation === 'insert') {
      const rows = Array.isArray(data) ? data : [data]
      let last = null

      for (const row of rows) {
        const keys = Object.keys(row).join(', ')
        const vals = Object.values(row).map(esc).join(', ')
        const result = await sql.query(
          `INSERT INTO ${table} (${keys}) VALUES (${vals}) RETURNING *`
        )
        last = result[0]
      }

      return json(200, { data: last, error: null })
    }

    if (operation === 'upsert') {
      const rows = Array.isArray(data) ? data : [data]
      const conflict = upsertOptions.onConflict || 'id'

      for (const row of rows) {
        const keys = Object.keys(row).join(', ')
        const vals = Object.values(row).map(esc).join(', ')
        const sets = Object.keys(row)
          .filter((key) => key !== 'id')
          .map((key) => `${key} = EXCLUDED.${key}`)
          .join(', ')

        await sql.query(
          `INSERT INTO ${table} (${keys}) VALUES (${vals}) ON CONFLICT (${conflict}) DO UPDATE SET ${sets}`
        )
      }

      return json(200, { data: null, error: null })
    }

    if (operation === 'count') {
      const result = await sql.query(`SELECT COUNT(*) as count FROM ${table} ${w}`)
      return json(200, {
        count: parseInt(result[0].count, 10),
        error: null
      })
    }

    if (columns.includes('order_items')) {
      const orders = await sql.query(`SELECT * FROM ${table} ${w} ${ord} ${lim}`)

      for (const orderRow of orders) {
        orderRow.order_items = await sql.query(
          `SELECT * FROM order_items WHERE order_id = ${esc(orderRow.id)}`
        )
      }

      return json(200, {
        data: single ? orders[0] || null : orders,
        error: null
      })
    }

    const result = await sql.query(`SELECT * FROM ${table} ${w} ${ord} ${lim}`)

    return json(200, {
      data: single ? result[0] || null : result,
      error: null
    })
  } catch (error) {
    console.error('DB Function Error:', error)
    return json(500, {
      data: null,
      error: error.message || 'Error interno'
    })
  }
}
