/**
 * Globex Sky — EmailService (class-based wrapper)
 * Loads HTML templates from the templates/email directory and sends emails.
 * In production, integrate an SMTP provider (nodemailer/SendGrid/SES).
 * For now, email sending is logged to console as a placeholder.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class EmailService {
  constructor() {
    this.templatesDir = path.resolve(__dirname, '../../templates/email');
    this._templateCache = {};
  }

  /**
   * Load an email template and replace {{key}} placeholders.
   * Templates are cached in memory after first load.
   * @param {string} name  - Template filename without extension (e.g. 'welcome')
   * @param {Object} vars  - Key/value pairs to substitute
   * @returns {string} Rendered HTML string
   */
  loadTemplate(name, vars) {
    vars = vars || {};
    if (!this._templateCache[name]) {
      const templatePath = path.join(this.templatesDir, `${name}.html`);
      this._templateCache[name] = fs.readFileSync(templatePath, 'utf8');
    }
    let html = this._templateCache[name];
    Object.entries(vars).forEach(([key, value]) => {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value != null ? String(value) : '');
    });
    return html;
  }

  /** Format order ID to an 8-character uppercase string. */
  _formatOrderId(id) {
    return (id || '').slice(0, 8).toUpperCase();
  }

  async sendWelcome(user) {
    const html = this.loadTemplate('welcome', {
      userName: user.name || user.full_name || user.email,
      email: user.email,
    });
    return this.send(user.email, 'Welcome to GlobexSky!', html);
  }

  async sendOrderConfirmation(order) {
    const orderId = this._formatOrderId(order.id);
    const html = this.loadTemplate('order-confirmation', {
      userName: order.user_name || order.userName || '',
      orderId,
      orderDate: order.created_at
        ? new Date(order.created_at).toLocaleDateString()
        : new Date().toLocaleDateString(),
      orderTotal: order.total_amount || order.total || 0,
      items: this._renderOrderItems(order.items),
    });
    return this.send(order.user_email, `Order Confirmation #${orderId}`, html);
  }

  async sendPasswordReset(email, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://globexsky.com'}/pages/auth/reset-password.html?token=${encodeURIComponent(resetToken)}`;
    const html = this.loadTemplate('password-reset', { resetUrl });
    return this.send(email, 'Reset Your Password - GlobexSky', html);
  }

  async sendShippingNotification(order, tracking) {
    const orderId = this._formatOrderId(order.id);
    const html = this.loadTemplate('order-shipped', {
      userName: order.user_name || order.userName || '',
      orderId,
      trackingNumber: tracking.tracking_number || tracking.trackingNumber || '',
      carrier: tracking.carrier || '',
      trackingUrl: tracking.tracking_url || tracking.trackingUrl || '',
    });
    return this.send(order.user_email, `Your Order #${orderId} Has Shipped!`, html);
  }

  /**
   * Send an email. Replace this stub with nodemailer/SendGrid/SES in production.
   * @param {string} to      - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} html    - Rendered HTML body
   */
  async send(to, subject, html) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    // TODO: integrate SMTP/SendGrid/SES here
    return { success: true, to, subject };
  }

  _renderOrderItems(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items.map(item =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${item.name || ''}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${item.quantity || 1}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">$${Number(item.price || 0).toFixed(2)}</td>
      </tr>`
    ).join('');
  }
}

export default new EmailService();
