import supabase from '../config/supabase.js';

/**
 * Full-text product search using Supabase's textSearch.
 */
export async function searchProducts(query, { page = 1, limit = 20, category_id } = {}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let q = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .textSearch('title', query, { type: 'websearch' })
    .eq('status', 'active')
    .range(from, to);

  if (category_id) q = q.eq('category_id', category_id);

  const { data, error, count } = await q;
  if (error) throw error;
  return { data, total: count, page, limit };
}

/**
 * Search suppliers by company name.
 */
export async function searchSuppliers(query) {
  const { data, error } = await supabase
    .from('supplier_profiles')
    .select('*')
    .ilike('company_name', `%${query}%`)
    .eq('verified', true)
    .limit(20);
  if (error) throw error;
  return data;
}
