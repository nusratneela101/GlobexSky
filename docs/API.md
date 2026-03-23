# GlobexSky API Documentation

**Version:** 2.0.0  
**Base URL:** `https://globexsky-backend.up.railway.app/api/v1`  
**Interactive Docs:** `/api/docs` (Swagger UI)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Codes](#error-codes)
4. [Auth Endpoints](#auth-endpoints)
5. [Products](#products)
6. [Orders](#orders)
7. [Users](#users)
8. [Payments](#payments)
9. [Search](#search)
10. [Cart & Checkout](#cart--checkout)
11. [Suppliers](#suppliers)
12. [Admin](#admin)
13. [WebSocket Events](#websocket-events)

---

## Authentication

GlobexSky uses **JWT (JSON Web Token)** for authentication.

### How to Authenticate

1. Obtain a JWT token via `POST /api/v1/auth/login`
2. Include the token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

### Token Expiry

- Access tokens expire in **1 hour**
- Use `POST /api/v1/auth/refresh` to get a new token

---

## Rate Limiting

| Endpoint Group | Limit |
|---|---|
| Auth endpoints | 10 requests / 15 minutes |
| General API | 100 requests / minute |
| Upload endpoints | 20 requests / minute |

When rate limited, the API returns `429 Too Many Requests` with a `Retry-After` header.

---

## Error Codes

| HTTP Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request / validation error |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (e.g., email already exists) |
| `422` | Unprocessable entity |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

All error responses follow this schema:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": [{ "field": "email", "message": "Invalid email format" }]
}
```

---

## Auth Endpoints

### Register

```http
POST /api/v1/auth/register
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "role": "buyer",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created. Please verify your email.",
  "userId": "uuid-here"
}
```

---

### Login

```http
POST /api/v1/auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "buyer",
    "is_verified": true
  }
}
```

---

### Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "buyer",
    "full_name": "John Doe",
    "is_verified": true
  }
}
```

---

## Products

### List Products

```http
GET /api/v1/products?page=1&limit=20&category_id=<uuid>&sort=price_asc
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Premium Widget",
      "price": 29.99,
      "currency": "USD",
      "average_rating": 4.5,
      "images": ["https://..."],
      "supplier": { "company_name": "Supplier Co.", "verified": true }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 250, "totalPages": 13 }
}
```

---

### Get Product by ID

```http
GET /api/v1/products/:id
```

---

### Create Product (Supplier only)

```http
POST /api/v1/products
Authorization: Bearer <supplier_token>
```

**Request:**
```json
{
  "title": "New Product",
  "description": "Product description",
  "price": 49.99,
  "currency": "USD",
  "category_id": "uuid",
  "stock_quantity": 100,
  "images": ["https://cloudinary.com/..."]
}
```

---

## Orders

### List Orders

```http
GET /api/v1/orders?status=confirmed&page=1
Authorization: Bearer <token>
```

---

### Place Order

```http
POST /api/v1/orders
Authorization: Bearer <token>
```

**Request:**
```json
{
  "shipping_address_id": "uuid",
  "payment_method": "stripe",
  "coupon_code": "SAVE10"
}
```

**Response (201):**
```json
{
  "success": true,
  "order": {
    "id": "order-uuid",
    "status": "pending",
    "total": 89.99,
    "payment_status": "pending"
  }
}
```

---

### Get Order by ID

```http
GET /api/v1/orders/:id
Authorization: Bearer <token>
```

---

## Users

### Get Profile

```http
GET /api/v1/users/profile
Authorization: Bearer <token>
```

---

### Update Profile

```http
PUT /api/v1/users/profile
Authorization: Bearer <token>
```

**Request:**
```json
{
  "full_name": "Jane Doe",
  "phone": "+1234567890",
  "language": "en",
  "currency": "USD"
}
```

---

## Payments

### Create Stripe PaymentIntent

```http
POST /api/v1/payments/stripe/intent
Authorization: Bearer <token>
```

**Request:**
```json
{
  "amount": 5000,
  "currency": "usd",
  "orderId": "order-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_yyy",
  "paymentIntentId": "pi_xxx"
}
```

---

### Initialize bKash Payment

```http
POST /api/v1/payments/bkash/init
Authorization: Bearer <token>
```

**Request:**
```json
{
  "amount": 500,
  "orderId": "order-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "paymentURL": "https://tokenized.sandbox.bka.sh/...",
  "paymentID": "bkash-payment-id"
}
```

---

## Search

### Full-Text Search

```http
GET /api/v1/search?q=laptop&minPrice=500&maxPrice=2000&sort=rating&page=1
```

**Response:**
```json
{
  "success": true,
  "data": [ /* products */ ],
  "total": 45,
  "page": 1,
  "suggestion": null
}
```

---

### Autocomplete

```http
GET /api/v1/search/autocomplete?q=lap&limit=5
```

---

## Cart & Checkout

### Validate Cart

```http
POST /api/v1/checkout/validate
Authorization: Bearer <token>
```

### Get Shipping Rates

```http
POST /api/v1/checkout/shipping-rates
Authorization: Bearer <token>
Content-Type: application/json

{ "country": "US", "subtotal": 150 }
```

### Place Order

```http
POST /api/v1/checkout/place-order
Authorization: Bearer <token>
Content-Type: application/json

{ "shipping_address_id": "uuid", "payment_method": "stripe" }
```

---

## Suppliers

### Get Supplier Profile

```http
GET /api/v1/suppliers/:id
```

### List Supplier Products

```http
GET /api/v1/suppliers/:id/products
```

### Dashboard Stats (Supplier)

```http
GET /api/v1/suppliers/dashboard/stats
Authorization: Bearer <supplier_token>
```

---

## Admin

All admin endpoints require authentication with `role: admin`.

### Dashboard Stats

```http
GET /api/v1/admin/dashboard/stats
Authorization: Bearer <admin_token>
```

### List Users

```http
GET /api/v1/admin/users?page=1&role=buyer
Authorization: Bearer <admin_token>
```

### Ban User

```http
PUT /api/v1/admin/users/:id/ban
Authorization: Bearer <admin_token>
```

### Feature Flags

```http
GET /api/v1/admin/features
PUT /api/v1/admin/features/:name
Authorization: Bearer <admin_token>
```

---

## WebSocket Events

Connect to the WebSocket server at `wss://globexsky-backend.up.railway.app`

### Authentication

After connecting, send:
```json
{ "type": "auth", "data": { "token": "<your_jwt_token>" } }
```

### Incoming Events (Server → Client)

| Event | Description | Payload |
|---|---|---|
| `notification` | New notification | `{ title, message, type, link }` |
| `chat` | New chat message | `{ chatId, senderId, content, timestamp }` |
| `order_update` | Order status change | `{ orderId, status, message }` |
| `price_update` | Product price changed | `{ productId, oldPrice, newPrice }` |
| `cart_update` | Cart item count changed | `{ count }` |
| `livestream` | Livestream event | `{ streamId, type, data }` |
| `presence` | User online/offline | `{ userId, status }` |

### Outgoing Events (Client → Server)

| Event | Description | Payload |
|---|---|---|
| `auth` | Authenticate connection | `{ token }` |
| `join_room` | Join a chat/order room | `{ roomId }` |
| `chat_message` | Send a chat message | `{ chatId, content }` |
| `typing` | Typing indicator | `{ chatId, isTyping }` |
| `webrtc_offer` | WebRTC call offer | `{ targetUserId, offer }` |
| `webrtc_answer` | WebRTC call answer | `{ targetUserId, answer }` |
| `webrtc_ice_candidate` | ICE candidate | `{ targetUserId, candidate }` |
| `webrtc_hangup` | End a call | `{ targetUserId }` |
