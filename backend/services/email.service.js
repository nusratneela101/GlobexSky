import nodemailer from 'nodemailer';
import { PLATFORM_NAME, PLATFORM_EMAIL } from '../config/constants.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function send({ to, subject, html }) {
  return transporter.sendMail({ from: `"${PLATFORM_NAME}" <${PLATFORM_EMAIL}>`, to, subject, html });
}

export async function sendWelcomeEmail(to, name) {
  return send({
    to, subject: `Welcome to ${PLATFORM_NAME}!`,
    html: `<h1>Welcome, ${name}!</h1><p>Thank you for joining GlobexSky. Your account has been created successfully.</p>`,
  });
}

export async function sendPasswordResetEmail(to, resetUrl) {
  return send({
    to, subject: 'Reset your GlobexSky password',
    html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><a href="${resetUrl}">${resetUrl}</a>`,
  });
}

export async function sendOrderConfirmationEmail(to, order) {
  return send({
    to, subject: `Order Confirmed — #${order.id.slice(0, 8).toUpperCase()}`,
    html: `<h2>Your order has been confirmed!</h2><p>Order ID: ${order.id}</p><p>Total: $${order.total}</p>`,
  });
}

export async function sendShippingUpdateEmail(to, order) {
  return send({
    to, subject: `Your order has shipped — Tracking: ${order.tracking_number}`,
    html: `<h2>Your order is on its way!</h2><p>Tracking Number: <strong>${order.tracking_number}</strong></p>`,
  });
}

export async function sendGenericEmail(to, subject, html) {
  return send({ to, subject, html });
}
