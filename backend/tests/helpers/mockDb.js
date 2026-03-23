/**
 * Mock Supabase/database client with in-memory data store for testing without a real DB.
 */

const inMemoryDb = {};

function createQueryBuilder(tableName) {
  const table = (inMemoryDb[tableName] = inMemoryDb[tableName] || []);
  let _filters = [];
  let _limit = null;
  let _orderField = null;
  let _orderAsc = true;
  let _head = false;
  let _count = false;
  let _insertRows = null;
  let _updateData = null;
  let _upsertRows = null;

  const applyFilters = (rows) => {
    return rows.filter((row) => {
      return _filters.every(({ field, op, value }) => {
        if (op === 'eq') return row[field] === value;
        if (op === 'neq') return row[field] !== value;
        if (op === 'gte') return row[field] >= value;
        if (op === 'lte') return row[field] <= value;
        if (op === 'gt') return row[field] > value;
        if (op === 'lt') return row[field] < value;
        return true;
      });
    });
  };

  const builder = {
    select(fields, opts = {}) {
      if (opts.count) _count = true;
      if (opts.head) _head = true;
      return builder;
    },
    eq(field, value) {
      _filters.push({ field, op: 'eq', value });
      return builder;
    },
    neq(field, value) {
      _filters.push({ field, op: 'neq', value });
      return builder;
    },
    gte(field, value) {
      _filters.push({ field, op: 'gte', value });
      return builder;
    },
    lte(field, value) {
      _filters.push({ field, op: 'lte', value });
      return builder;
    },
    gt(field, value) {
      _filters.push({ field, op: 'gt', value });
      return builder;
    },
    lt(field, value) {
      _filters.push({ field, op: 'lt', value });
      return builder;
    },
    order(field, { ascending = true } = {}) {
      _orderField = field;
      _orderAsc = ascending;
      return builder;
    },
    limit(n) {
      _limit = n;
      return builder;
    },
    insert(rows) {
      _insertRows = Array.isArray(rows) ? rows : [rows];
      return builder;
    },
    update(data) {
      _updateData = data;
      return builder;
    },
    upsert(rows, opts = {}) {
      _upsertRows = Array.isArray(rows) ? rows : [rows];
      return builder;
    },
    delete() {
      return builder;
    },
    single() {
      return Promise.resolve((() => {
        let rows = applyFilters(table);
        if (_count) return { data: rows[0] || null, count: rows.length, error: null };
        if (_insertRows) {
          const inserted = _insertRows.map((r, i) => ({ id: `mock-id-${Date.now()}-${i}`, ...r }));
          table.push(...inserted);
          return { data: inserted[0] || null, error: null };
        }
        if (_updateData) {
          rows.forEach((row) => Object.assign(row, _updateData));
          return { data: rows[0] || null, error: rows.length === 0 ? { message: 'Not found' } : null };
        }
        return { data: rows[0] || null, error: rows.length === 0 ? { message: 'Row not found' } : null };
      })());
    },
    maybeSingle() {
      return Promise.resolve((() => {
        let rows = applyFilters(table);
        if (_insertRows) {
          const inserted = _insertRows.map((r, i) => ({ id: `mock-id-${Date.now()}-${i}`, ...r }));
          table.push(...inserted);
          return { data: inserted[0] || null, error: null };
        }
        return { data: rows[0] || null, error: null };
      })());
    },
    then(resolve) {
      return Promise.resolve((() => {
        let rows = applyFilters(table);
        if (_count || _head) return { data: rows, count: rows.length, error: null };
        if (_insertRows) {
          const inserted = _insertRows.map((r, i) => ({ id: `mock-id-${Date.now()}-${i}`, ...r }));
          table.push(...inserted);
          return { data: inserted, error: null };
        }
        if (_upsertRows) {
          const upserted = _upsertRows.map((r, i) => ({ id: `mock-id-${Date.now()}-${i}`, ...r }));
          upserted.forEach((row) => {
            const idx = table.findIndex((r) => r.id === row.id);
            if (idx >= 0) table[idx] = row;
            else table.push(row);
          });
          return { data: upserted, error: null };
        }
        if (_updateData) {
          rows.forEach((row) => Object.assign(row, _updateData));
          return { data: rows, error: null };
        }
        if (_orderField) {
          rows = [...rows].sort((a, b) => {
            const aVal = a[_orderField];
            const bVal = b[_orderField];
            return _orderAsc ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
          });
        }
        if (_limit !== null) rows = rows.slice(0, _limit);
        return { data: rows, error: null };
      })()).then(resolve);
    },
  };

  return builder;
}

const mockSupabase = {
  from: (tableName) => createQueryBuilder(tableName),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Invalid token' } }),
    signUp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  },
  _reset() {
    Object.keys(inMemoryDb).forEach((k) => delete inMemoryDb[k]);
  },
};

export { mockSupabase, inMemoryDb };
export default mockSupabase;
