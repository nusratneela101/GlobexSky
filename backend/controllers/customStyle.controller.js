/**
 * customStyle.controller.js
 * Controller for Custom CSS/JS Admin Panel
 */
import supabase from '../config/supabase.js';

const TABLE_NAME = 'admin_custom_styles';

/**
 * GET /api/v1/admin/custom-styles
 * List all custom styles (admin only)
 */
export async function listStyles(req, res, next) {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/custom-styles/:id
 * Get a single custom style by ID
 */
export async function getStyle(req, res, next) {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Custom style not found.' });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/custom-styles
 * Create a new custom style
 */
export async function createStyle(req, res, next) {
  try {
    const { name, css_content, js_content, is_active = true, applied_pages = 'all' } = req.body;
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        name,
        css_content: css_content || '',
        js_content: js_content || '',
        is_active,
        applied_pages,
        created_by: req.user?.id || null
      })
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/custom-styles/:id
 * Update an existing custom style
 */
export async function updateStyle(req, res, next) {
  try {
    const { name, css_content, js_content, is_active, applied_pages } = req.body;
    
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (css_content !== undefined) updateData.css_content = css_content;
    if (js_content !== undefined) updateData.js_content = js_content;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (applied_pages !== undefined) updateData.applied_pages = applied_pages;
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (!data) {
      return res.status(404).json({ success: false, error: 'Custom style not found.' });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/custom-styles/:id
 * Delete a custom style
 */
export async function deleteStyle(req, res, next) {
  try {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', req.params.id);
    
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.json({ success: true, message: 'Custom style deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/custom-styles/:id/toggle
 * Toggle the is_active status
 */
export async function toggleStyle(req, res, next) {
  try {
    // First get current state
    const { data: current, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select('is_active')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError || !current) {
      return res.status(404).json({ success: false, error: 'Custom style not found.' });
    }
    
    // Toggle
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        is_active: !current.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/custom-styles/active
 * Get all active custom styles (public endpoint for frontend injection)
 */
export async function getActiveStyles(req, res, next) {
  try {
    const { page } = req.query;
    
    let query = supabase
      .from(TABLE_NAME)
      .select('id, css_content, js_content, applied_pages')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    const { data, error } = await query;
    
    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    
    // Filter by page if specified
    let styles = data || [];
    if (page) {
      styles = styles.filter(s => 
        s.applied_pages === 'all' || 
        (s.applied_pages && s.applied_pages.includes(page))
      );
    }
    
    // Combine all CSS and JS
    const combinedCSS = styles.map(s => s.css_content || '').filter(Boolean).join('\n\n');
    const combinedJS = styles.map(s => s.js_content || '').filter(Boolean).join('\n\n');
    
    res.json({
      success: true,
      data: {
        css: combinedCSS,
        js: combinedJS,
        count: styles.length
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/custom-styles/css
 * Serve combined active CSS (for direct <link> injection)
 */
export async function serveCSS(req, res, next) {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('css_content')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    if (error) {
      res.setHeader('Content-Type', 'text/css');
      return res.status(500).send('/* Error loading custom styles */');
    }
    
    const css = (data || []).map(s => s.css_content || '').filter(Boolean).join('\n\n');
    
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.send(css || '/* No custom CSS */');
  } catch (err) {
    res.setHeader('Content-Type', 'text/css');
    res.status(500).send('/* Error loading custom styles */');
  }
}

/**
 * GET /api/v1/custom-styles/js
 * Serve combined active JS (for direct <script> injection)
 */
export async function serveJS(req, res, next) {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('js_content')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    if (error) {
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(500).send('// Error loading custom scripts');
    }
    
    const js = (data || []).map(s => s.js_content || '').filter(Boolean).join('\n\n');
    
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.send(js || '// No custom JS');
  } catch (err) {
    res.setHeader('Content-Type', 'application/javascript');
    res.status(500).send('// Error loading custom scripts');
  }
}
