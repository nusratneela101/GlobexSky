import supabase from '../config/supabase.js';

/** GET /api/v1/addresses — List all addresses for authenticated user */
export async function listAddresses(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
}

/** POST /api/v1/addresses — Create a new address */
export async function createAddress(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      label, full_name, phone,
      address_line1, address_line2,
      city, state, postal_code, country,
      is_default_shipping, is_default_billing,
    } = req.body;

    // If setting as default, unset existing defaults first
    if (is_default_shipping) {
      await supabase
        .from('addresses')
        .update({ is_default_shipping: false })
        .eq('user_id', userId);
    }
    if (is_default_billing) {
      await supabase
        .from('addresses')
        .update({ is_default_billing: false })
        .eq('user_id', userId);
    }

    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        label: label || 'Home',
        full_name,
        phone,
        address_line1,
        address_line2: address_line2 || null,
        street: address_line1, // maintain backward compatibility
        city,
        state: state || null,
        postal_code,
        country,
        is_default_shipping: is_default_shipping || false,
        is_default_billing: is_default_billing || false,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

/** GET /api/v1/addresses/:id — Get a single address */
export async function getAddress(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ success: false, error: 'Address not found.' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** PUT /api/v1/addresses/:id — Update an address */
export async function updateAddress(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      label, full_name, phone,
      address_line1, address_line2,
      city, state, postal_code, country,
      is_default_shipping, is_default_billing,
    } = req.body;

    const { data: existing } = await supabase
      .from('addresses')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (!existing) return res.status(404).json({ success: false, error: 'Address not found.' });

    if (is_default_shipping) {
      await supabase
        .from('addresses')
        .update({ is_default_shipping: false })
        .eq('user_id', userId)
        .neq('id', req.params.id);
    }
    if (is_default_billing) {
      await supabase
        .from('addresses')
        .update({ is_default_billing: false })
        .eq('user_id', userId)
        .neq('id', req.params.id);
    }

    const updates = {};
    if (label !== undefined) updates.label = label;
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    if (address_line1 !== undefined) updates.address_line1 = address_line1;
    if (address_line2 !== undefined) updates.address_line2 = address_line2;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (postal_code !== undefined) updates.postal_code = postal_code;
    if (country !== undefined) updates.country = country;
    if (is_default_shipping !== undefined) updates.is_default_shipping = is_default_shipping;
    if (is_default_billing !== undefined) updates.is_default_billing = is_default_billing;

    const { data, error } = await supabase
      .from('addresses')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

/** DELETE /api/v1/addresses/:id — Delete an address */
export async function deleteAddress(req, res, next) {
  try {
    const { data: existing } = await supabase
      .from('addresses')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!existing) return res.status(404).json({ success: false, error: 'Address not found.' });

    const { error } = await supabase.from('addresses').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, message: 'Address deleted.' });
  } catch (err) { next(err); }
}
