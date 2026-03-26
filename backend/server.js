/**
 * Globex Sky Backend — server.js
 * Main entry point: Express server with all middleware, routes, and health check.
 */

import 'dotenv/config';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import corsConfig from './config/cors.js';
import websocketConfig from './config/websocket.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { ipBlocker, xssSanitiser, requestLogger, authLimiter, apiLimiter } from './middleware/security.middleware.js';

import authRoutes from './routes/auth.routes.js';
import socialAuthRoutes from './routes/socialAuth.routes.js';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import shipmentRoutes from './routes/shipment.routes.js';
import carryRoutes from './routes/carry.routes.js';
import parcelRoutes from './routes/parcel.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import adminRoutes from './routes/admin.routes.js';
import pricingRoutes from './routes/pricing.routes.js';
import inspectionRoutes from './routes/inspection.routes.js';
import rfqRoutes from './routes/rfq.routes.js';
import reviewRoutes from './routes/review.routes.js';
import chatRoutes from './routes/chat.routes.js';
import chatExtRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notification.routes.js';
import cmsRoutes from './routes/cms.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import advertisingRoutes from './routes/advertising.routes.js';
import livestreamRoutes from './routes/livestream.routes.js';
import apiPlatformRoutes from './routes/api-platform.routes.js';
import dropshippingRoutes from './routes/dropshipping.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import disputeRoutes from './routes/dispute.routes.js';
import refundRoutes from './routes/refund.routes.js';
import codRoutes from './routes/cod.routes.js';
import warehouseRoutes from './routes/warehouse.routes.js';


import cartRoutes from './routes/cart.routes.js';
import checkoutRoutes from './routes/checkout.routes.js';
import addressRoutes from './routes/address.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import tradeFinanceRoutes from './routes/tradeFinance.routes.js';
import tradeShowRoutes from './routes/tradeShow.routes.js';
import sourcingSolutionsRoutes from './routes/sourcingSolutions.routes.js';
import freightRoutes from './routes/freight.routes.js';
import supplierAssessmentRoutes from './routes/supplierAssessment.routes.js';
import businessIntelligenceRoutes from './routes/businessIntelligence.routes.js';
import flashSaleRoutes from './routes/flashSale.routes.js';
import chatbotRoutes from './routes/chatbot.routes.js';
import loyaltyRoutes from './routes/loyalty.routes.js';
import videoMeetingRoutes from './routes/videoMeeting.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import pushNotificationRoutes from './routes/pushNotification.routes.js';
import advancedSearchRoutes from './routes/advancedSearch.routes.js';
import backupRoutes from './routes/backup.routes.js';
import systemLogsRoutes from './routes/systemLogs.routes.js';
import seoRoutes from './routes/seo.routes.js';
import featureToggleRoutes from './routes/featureToggle.routes.js';
import templateRoutes from './routes/templateRoutes.js';
import integrationRoutes from './routes/integration.routes.js';
import aiRoutes from './routes/ai.routes.js';
import configRoutes from './routes/config.routes.js';
import adminConfigRoutes from './routes/admin/config.routes.js';
import adminUsersRoutes from './routes/adminUsers.js';
import adminProductsRoutes from './routes/adminProducts.js';
import adminSettingsRoutes from './routes/settings.js';
import adminRolesRoutes from './routes/adminRoles.js';
import adminCmsRoutes from './routes/cms.js';
import { ticketRouter as supportTicketRouter, kbRouter as adminKbRouter } from './routes/supportTicket.routes.js';
import vrRoutes from './routes/vr.routes.js';
import verificationRoutes from './routes/verification.routes.js';
import paymentsRoutes from './routes/payments.js';
import adminPricingRoutes from './routes/pricing.js';
import reportsRoutes from './routes/reports.js';
import payoutsRoutes from './routes/payouts.js';

import { swaggerUi, swaggerSpec } from './swagger.js';
import { initializeWebSocket } from './services/websocket.service.js';
import { initializeWebRTC } from './services/webrtc.service.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// ─── Socket.io Setup ──────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, websocketConfig.options);
initializeWebSocket(io);
initializeWebRTC(io);

// Make io accessible to route handlers via req.app.get('io')
app.set('io', io);

// ─── Core Middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(corsConfig);
app.use(ipBlocker);
app.use(requestLogger);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(globalRateLimiter);
app.use(xssSanitiser);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Globex Sky API is running', timestamp: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}/auth`, authLimiter, authRoutes);
app.use(`${API}/auth`, authLimiter, socialAuthRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/suppliers`, supplierRoutes);
app.use(`${API}/shipments`, shipmentRoutes);
app.use(`${API}/carry`, carryRoutes);
app.use(`${API}/parcels`, parcelRoutes);
app.use(`${API}/payments`, paymentRoutes);

app.use(`${API}/config`, configRoutes);

// New detailed admin routes (registered before generic /admin to take precedence)
app.use(`${API}/admin/config`, adminConfigRoutes);
app.use(`${API}/admin/users`, adminUsersRoutes);
app.use(`${API}/admin/products`, adminProductsRoutes);
app.use(`${API}/admin/settings`, adminSettingsRoutes);
app.use(`${API}/admin/roles`, adminRolesRoutes);
app.use(`${API}/admin/cms`, adminCmsRoutes);

app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/pricing`, pricingRoutes);
app.use(`${API}/inspections`, inspectionRoutes);
app.use(`${API}/rfq`, rfqRoutes);
app.use(`${API}/reviews`, reviewRoutes);
app.use(`${API}/chat`, chatRoutes);
app.use(`${API}/chat/ext`, chatExtRoutes);
app.use(`${API}/notifications`, notificationRoutes);
app.use(`${API}/cms`, cmsRoutes);
app.use(`${API}/campaigns`, campaignRoutes);
app.use(`${API}/advertising`, advertisingRoutes);
app.use(`${API}/livestreams`, livestreamRoutes);
app.use(`${API}/api-platform`, apiPlatformRoutes);
app.use(`${API}/dropshipping`, dropshippingRoutes);
app.use(`${API}/analytics`, analyticsRoutes);
app.use(`${API}/disputes`, disputeRoutes);
app.use(`${API}/refunds`, refundRoutes);
app.use(`${API}/cod`, codRoutes);
app.use(`${API}/warehouses`, warehouseRoutes);


app.use(`${API}/cart`, cartRoutes);
app.use(`${API}/checkout`, checkoutRoutes);
app.use(`${API}/addresses`, addressRoutes);
app.use(`${API}/wishlist`, wishlistRoutes);

app.use(`${API}/upload`, uploadRoutes);
app.use(`${API}/webhooks`, webhookRoutes);
app.use(`${API}/push`, pushNotificationRoutes);
app.use(`${API}/trade-finance`, tradeFinanceRoutes);
app.use(`${API}/trade-shows`, tradeShowRoutes);
app.use(`${API}/sourcing-solutions`, sourcingSolutionsRoutes);
app.use(`${API}/freight`, freightRoutes);
app.use(`${API}/supplier-assessment`, supplierAssessmentRoutes);
app.use(`${API}/business-intelligence`, businessIntelligenceRoutes);
app.use(`${API}/flash-sales`, flashSaleRoutes);
app.use(`${API}/chatbot`, chatbotRoutes);
app.use(`${API}/loyalty`, loyaltyRoutes);
app.use(`${API}/video-meetings`, videoMeetingRoutes);
app.use(`${API}/search`, advancedSearchRoutes);
app.use(`${API}/backup`, backupRoutes);
app.use(`${API}/seo`, seoRoutes);
app.use(`${API}/feature-toggles`, featureToggleRoutes);
app.use(`${API}/templates`, templateRoutes);
app.use(`${API}/integrations`, integrationRoutes);
app.use(`${API}/ai`, aiRoutes);
app.use(`${API}/vr`, vrRoutes);
app.use(`${API}/verification`, verificationRoutes);

app.use(`${API}/payments/gateway`, paymentsRoutes);
app.use(`${API}/admin/pricing`, adminPricingRoutes);
app.use(`${API}/admin/reports`, reportsRoutes);
app.use(`${API}/admin/payouts`, payoutsRoutes);

// Swagger docs available at /api/docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => { res.json(swaggerSpec); });

// ─── 404 & Error Handlers ────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`🚀 Globex Sky API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

export default app;