export const supabase = { from: (table) => new QB(table) }

class QB {
  constructor(table) {
    this.table = table
    this._filters = []
    this._order = null
    this._ascending = true
    this._columns = '*'
    this._update = null
    this._insert = null
    this._delete = false
    this._upsert = null
    this._upsertOptions = {}
    this._single = false
    this._head = false
    this._count = null
    this._limit = null
  }

  select(columns, options) {
    this._columns = columns || '*'
    const opts = options || {}
    if (opts.count) this._count = opts.count
    if (opts.head) this._head = true
    return this
  }

  insert(data) {
    this._insert = data
    return this
  }

  update(data) {
    this._update = data
    return this
  }

  delete() {
    this._delete = true
    return this
  }

  upsert(data, options) {
    this._upsert = data
    this._upsertOptions = options || {}
    return this
  }

  eq(column, value) {
    this._filters.push({ type: 'eq', column, value })
    return this
  }

  ilike(column, value) {
    this._filters.push({ type: 'ilike', column, value })
    return this
  }

  order(column, options) {
    this._order = column
    this._ascending = (options || {}).ascending !== false
    return this
  }

  single() {
    this._single = true
    return this
  }

  limit(number) {
    this._limit = number
    return this
  }

  async then(resolve, reject) {
    try {
      let operation = 'select'
      let data = null

      if (this._delete) operation = 'delete'
      if (this._update) {
        operation = 'update'
        data = this._update
      }
      if (this._insert) {
        operation = 'insert'
        data = this._insert
      }
      if (this._upsert) {
        operation = 'upsert'
        data = this._upsert
      }
      if (this._head && this._count) operation = 'count'

      const response = await fetch('/.netlify/functions/db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          table: this.table,
          operation,
          columns: this._columns,
          filters: this._filters,
          order: this._order,
          ascending: this._ascending,
          limit: this._limit,
          single: this._single,
          data,
          upsertOptions: this._upsertOptions
        })
      })

      const payload = await response.json()

      if (!response.ok) {
        return resolve({
          data: null,
          error: payload.error || 'Error consultando datos'
        })
      }

      return resolve(payload)
    } catch (error) {
      console.error('Client DB Error:', error)
      return resolve({ data: null, error })
    }
  }
}
