# Globex Sky Backend

Node.js + Express backend API for the Globex Sky global B2B sourcing and shipment platform.

## Stack

| Layer     | Technology                              |
|-----------|----------------------------------------|
| Server    | Node.js 18+ / Express 4                |
| Database  | Supabase (PostgreSQL + Auth)           |
| Storage   | Cloudinary                             |
| Email     | Nodemailer (SMTP)                      |
| Hosting   | Railway                                |

---

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Fill in all values in .env
```

Required variables:
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (from Supabase dashboard)
- `SUPABASE_ANON_KEY` — Anon/public key
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `FRONTEND_URL` — e.g. `https://globexsky.com`
- `JWT_SECRET` — Long random string

### 3. Set up the database

Run the migrations in order in the Supabase SQL editor:

```
database/migrations/001_users.sql
database/migrations/002_products.sql
database/migrations/003_orders.sql
database/migrations/004_shipments.sql
database/migrations/005_payments.sql
database/migrations/006_pricing.sql
database/migrations/007_messaging.sql
database/migrations/008_cms.sql
database/migrations/009_api_platform.sql
database/migrations/010_campaigns.sql
database/migrations/011_rls_policies.sql
```

Or run the combined schema:
```
database/schema.sql
```

Then seed the database:
```
database/seeds/seed.sql
```

### 4. Run the server

```bash
# Development
npm run dev

# Production
npm start
```

The server starts on `http://localhost:5000`.

Health check: `GET /health`

---

## API Structure

All endpoints follow the pattern: `POST|GET|PUT|PATCH|DELETE /api/v1/<resource>`

### Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

Errors:
```json
{
  "success": false,
  "error": "Error message"
}
```

### Authentication

Include the Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Available API Routes

| Resource        | Base Path                    |
|-----------------|------------------------------|
| Auth            | `/api/v1/auth`               |
| Users           | `/api/v1/users`              |
| Products        | `/api/v1/products`           |
| Orders          | `/api/v1/orders`             |
| Suppliers       | `/api/v1/suppliers`          |
| Shipments       | `/api/v1/shipments`          |
| Carry           | `/api/v1/carry`              |
| Parcels         | `/api/v1/parcels`            |
| Payments        | `/api/v1/payments`           |
| Pricing         | `/api/v1/pricing`            |
| Inspections     | `/api/v1/inspections`        |
| RFQ             | `/api/v1/rfq`                |
| Reviews         | `/api/v1/reviews`            |
| Chat            | `/api/v1/chat`               |
| Notifications   | `/api/v1/notifications`      |
| CMS             | `/api/v1/cms`                |
| Campaigns       | `/api/v1/campaigns`          |
| Livestreams     | `/api/v1/livestreams`        |
| API Platform    | `/api/v1/api-platform`       |
| Dropshipping    | `/api/v1/dropshipping`       |
| Analytics       | `/api/v1/analytics`          |
| Upload          | `/api/v1/upload`             |
| Webhooks        | `/api/v1/webhooks`           |
| Admin           | `/api/v1/admin`              |

---

## Railway Deployment

1. Push the `backend/` folder to a Railway project
2. Set all environment variables in Railway dashboard
3. Railway auto-detects Node.js and runs `npm start`
4. The `railway.toml` configures health checks and restart policy

---

## Frontend Integration

The frontend automatically detects the environment:

- **Development**: connects to `http://localhost:5000/api/v1`
- **Production**: connects to `https://globexsky-backend.up.railway.app/api/v1`

See `assets/js/config.js` to update the production URL.

Include these scripts in HTML pages (before other JS):

```html
<script src="/assets/js/config.js"></script>
<script src="/assets/js/api.js"></script>
<script src="/assets/js/auth.js"></script>
```

Use `window.API` for all backend calls:

```javascript
// Login
const result = await API.auth.login(email, password);

// List products
const { data } = await API.products.list({ category: 'electronics' });

// Create order
const order = await API.orders.create({ items, shipping_address_id });
```
