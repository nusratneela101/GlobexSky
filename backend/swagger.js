/**
 * Globex Sky — swagger.js
 * Configures swagger-jsdoc and swagger-ui-express for OpenAPI 3.0 documentation.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GlobexSky API',
      version: '2.0.0',
      description: `
GlobexSky B2B/B2C E-Commerce Platform API

## Features
- **Authentication**: JWT-based auth with refresh tokens and social login
- **Products**: Full CRUD for products, categories, and inventory management
- **Orders**: Complete order lifecycle from cart to delivery
- **Payments**: Stripe, PayPal, bKash, Nagad, and COD integration
- **Search**: Full-text search with AI-powered recommendations
- **Suppliers**: Supplier onboarding, verification, and dashboard
- **Admin**: Comprehensive admin panel with analytics and user management
- **Real-time**: Socket.io WebSocket for live chat, notifications, and updates
- **AI**: OpenAI-powered chatbot, fraud detection, and price optimization
- **Multi-language**: 20+ languages with RTL support
- **Live Streaming**: Agora.io-based product live streams
      `.trim(),
      contact: {
        name: 'Globex International Trade Co., Ltd.',
        url: 'https://globexsky.com',
        email: 'support@globexsky.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://globexsky.com/terms',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://globexsky-backend.up.railway.app',
        description: 'Production server (Railway)',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token (obtain from /api/v1/auth/login)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error message' },
            details: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['buyer', 'supplier', 'admin', 'support'] },
            is_verified: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number', format: 'float' },
            currency: { type: 'string', default: 'USD' },
            category_id: { type: 'string', format: 'uuid' },
            supplier_id: { type: 'string', format: 'uuid' },
            stock_quantity: { type: 'integer' },
            status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            average_rating: { type: 'number', format: 'float' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            buyer_id: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
            },
            total: { type: 'number', format: 'float' },
            currency: { type: 'string', default: 'USD' },
            payment_method: { type: 'string' },
            payment_status: { type: 'string', enum: ['pending', 'paid', 'failed', 'refunded'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Products', description: 'Product catalog management' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Cart', description: 'Shopping cart' },
      { name: 'Checkout', description: 'Checkout flow' },
      { name: 'Payments', description: 'Payment processing' },
      { name: 'Search', description: 'Product search and discovery' },
      { name: 'Suppliers', description: 'Supplier management' },
      { name: 'Admin', description: 'Admin panel operations' },
      { name: 'Notifications', description: 'Push and in-app notifications' },
      { name: 'Analytics', description: 'Business analytics and reporting' },
    ],
  },
  apis: [
    './routes/*.js',
    './routes/*.routes.js',
    './controllers/*.js',
    './swagger-docs/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerUi, swaggerSpec };
