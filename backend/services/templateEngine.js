import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * Render a template string by replacing {{variable}} placeholders with values.
 * Supports:
 *   - Simple variables: {{userName}}
 *   - Nested variables: {{order.id}}, {{user.address.city}}
 *   - Conditional sections: {{#if condition}}...{{/if}}
 *   - Loop sections: {{#each items}}...{{/each}} (item available as {{this}} or {{this.prop}})
 *
 * @param {string} template - Template string with placeholders
 * @param {Object} variables - Key/value pairs for substitution
 * @returns {string} Rendered string
 */
export function renderString(template, variables = {}) {
  let result = template;

  // Process {{#each array}}...{{/each}} blocks
  result = result.replace(
    /\{\{#each ([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, key, block) => {
      const list = resolvePath(key.trim(), variables);
      if (!Array.isArray(list)) return '';
      return list
        .map((item) => renderString(block, { ...variables, this: item, ...flattenItem(item) }))
        .join('');
    },
  );

  // Process {{#if condition}}...{{/if}} blocks (supports {{#if condition}}...{{else}}...{{/if}})
  result = result.replace(
    /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, block) => {
      const value = resolvePath(key.trim(), variables);
      const [truePart, falsePart = ''] = block.split('{{else}}');
      return isTruthy(value) ? renderString(truePart, variables) : renderString(falsePart, variables);
    },
  );

  // Replace {{variable}} placeholders
  result = result.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const resolved = resolvePath(key.trim(), variables);
    return resolved !== undefined && resolved !== null ? String(resolved) : '';
  });

  return result;
}

/**
 * Load an email template file, render it with variables, and return the HTML string.
 *
 * @param {string} templateName - File name without extension (e.g. 'welcome')
 * @param {Object} variables - Variables to inject
 * @returns {string} Rendered HTML
 */
export function renderEmailTemplate(templateName, variables = {}) {
  const filePath = path.join(TEMPLATES_DIR, 'email', `${templateName}.html`);
  const template = fs.readFileSync(filePath, 'utf8');
  return renderString(template, variables);
}

/**
 * Load an SMS template module (JS), call its default export with variables,
 * and return the rendered message string.
 *
 * @param {string} templateName - File name without extension (e.g. 'otp')
 * @param {Object} variables - Variables to pass
 * @returns {Promise<string>} Rendered SMS message
 */
export async function renderSmsTemplate(templateName, variables = {}) {
  const filePath = path.join(TEMPLATES_DIR, 'sms', `${templateName}.js`);
  const mod = await import(`file://${filePath}`);
  const fn = mod.default || mod[templateName];
  if (typeof fn !== 'function') {
    throw new Error(`SMS template '${templateName}' must export a default function.`);
  }
  return fn(variables);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolvePath(key, obj) {
  return key.split('.').reduce((acc, part) => {
    if (acc === null || acc === undefined) return '';
    return acc[part];
  }, obj);
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  return !!value;
}

function flattenItem(item) {
  if (typeof item !== 'object' || item === null) return {};
  return item;
}
