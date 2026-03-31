# GlobexSky Database Setup Guide

## Overview

This directory contains the **Master Database Migration** file that creates the complete GlobexSky database in Supabase.

---

## ⚡ Quick Setup (Recommended)

Run the 4 migration files **in order**. Each file is small enough to run without timeout errors.

### Step 1 — Open Supabase SQL Editor

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your GlobexSky project
3. Click **SQL Editor** in the left sidebar
4. Click **+ New** to create a new query

### Step 2 — Run Part 1 (Core)

1. Open `database/migration-part1-core.sql`
2. Copy all the content and paste into the SQL Editor
3. Click the green **Run** button
4. You should see: `Success. No rows returned.`

### Step 3 — Run Part 2 (Commerce)

1. Click **+ New** in the SQL Editor
2. Open `database/migration-part2-commerce.sql`
3. Copy, paste, and **Run**

### Step 4 — Run Part 3 (Features)

1. Click **+ New** in the SQL Editor
2. Open `database/migration-part3-features.sql`
3. Copy, paste, and **Run**

### Step 5 — Run Part 4 (Admin & Extended Features)

1. Click **+ New** in the SQL Editor
2. Open `database/migration-part4-admin.sql`
3. Copy, paste, and **Run**

### ✅ Verify Success

After each part you should see: `Success. No rows returned.`

If you see errors, see the **Troubleshooting** section below.

> **Note:** The `master-migration.sql` file still exists for reference but is not recommended for direct use — it is very large and contains duplicate table definitions from earlier development.

---

## ✅ Verify Tables Were Created

1. In Supabase Dashboard, click **Table Editor** in the left sidebar
2. You should see all tables listed below

### Tables That Should Exist After Running

| Category | Tables |
|----------|--------|
| **Users & Auth** | `profiles`, `addresses`, `supplier_profiles`, `carrier_profiles`, `user_profiles`, `user_sessions`, `login_history` |
| **Suppliers** | `suppliers`, `supplier_documents`, `supplier_memberships`, `supplier_badges`, `supplier_plans`, `supplier_scorecards`, `supplier_scores`, `supplier_assessments`, `supplier_reviews` |
| **Products** | `categories`, `products`, `product_variants`, `product_images`, `product_attributes`, `product_views`, `wishlists` |
| **Orders** | `orders`, `order_items`, `order_status_history`, `order_timeline` |
| **Shipments** | `shipments`, `shipment_events`, `shipment_timeline`, `shipping_rates`, `shipping_destinations` |
| **Payments** | `transactions`, `payments`, `carrier_earnings`, `supplier_payouts`, `payouts`, `refunds` |
| **Cart & Checkout** | `carts`, `cart_items`, `coupons` |
| **RFQ** | `rfqs`, `quotations`, `rfq_messages`, `rfq_quotes` |
| **Messaging** | `conversations`, `messages`, `chat_rooms`, `chat_messages`, `chat_translations` |
| **Notifications** | `notifications`, `notification_preferences`, `push_subscriptions` |
| **CMS** | `pages`, `blog_posts`, `faqs`, `banners`, `templates`, `template_versions`, `email_templates` |
| **Carry Service** | `carry_requests`, `carry_items`, `carry_deliveries`, `carry_rates`, `carry_products`, `carry_service_rates` |
| **Parcels** | `parcels`, `parcel_shipments`, `parcel_tracking_events`, `parcel_pricing` |
| **Inspections** | `inspections`, `inspectors`, `inspection_reports`, `inspection_timeline`, `inspection_pricing` |
| **Meetings** | `meetings`, `video_meetings` |
| **Admin** | `admin_users`, `admin_roles`, `admin_settings`, `admin_activity_logs`, `admin_custom_styles` |
| **Analytics** | `search_analytics`, `search_logs`, `user_interactions`, `product_comparisons` |
| **Campaigns** | `campaigns`, `campaign_products`, `flash_sales`, `flash_sale_products`, `live_streams` |
| **API Platform** | `api_keys`, `api_plans`, `api_logs`, `api_pricing_tiers`, `webhooks` |
| **Platform Settings** | `platform_settings`, `site_settings`, `settings`, `system_configs`, `feature_toggles` |
| **Promotions** | `advertisements`, `sponsored_products`, `advertising_pricing` |
| **Reviews** | `reviews`, `review_images`, `review_votes`, `review_reports` |
| **Reports** | `audit_logs`, `backup_records` |
| **Escrow** | `escrow_transactions`, `escrow_milestones`, `escrow_audit_log`, `escrow_config` |
| **Image Search** | `image_search_history`, `image_search_config` |
| **Trade** | `trade_shows`, `trade_assurance_policies`, `trade_assurance_claims`, `trade_assurance_deposits`, `trade_assurance_config`, `trade_finance_applications` |
| **Loyalty** | `loyalty_points`, `loyalty_transactions`, `badge_catalog` |
| **Teams** | `teams`, `team_members`, `team_invitations`, `team_permissions`, `team_activity_log`, `team_config` |
| **E-commerce Extras** | `subscription_plans`, `commissions`, `commission_settings`, `currency_rates`, `dropshipping_products`, `dropshipping_markup` |
| **Advanced** | `sample_orders`, `customization_requests`, `rfq_matches`, `product_recommendations`, `vr_showrooms` |

---

## 🔧 Troubleshooting

### Error: `relation "auth.users" does not exist`
- This means you're not running the SQL in a Supabase project.  
- Supabase provides the `auth.users` table automatically.  
- Make sure you're connected to a Supabase project (not a plain PostgreSQL database).

### Error: `extension "uuid-ossp" does not exist`
- In the SQL Editor, run this first: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- This extension is pre-installed in Supabase, so this should not normally happen.

### Error: `duplicate key value violates unique constraint`
- The migration is safe to run multiple times. If this happens, it means some data was manually inserted.
- You can ignore this error or delete the conflicting rows first.

### Error: `permission denied for schema public`
- Go to **Project Settings → Database** and make sure you're using the `postgres` role.
- In SQL Editor, run: `SET ROLE postgres;` before running the migration.

### Some Tables Missing After Running
- Scroll through the SQL Editor output carefully — errors in the middle won't stop execution of later statements.
- Look for any red error messages and fix them, then re-run only the failing sections.

---

## 📁 File Structure

```
database/
├── migration-part1-core.sql     ← 🎯 Run FIRST: Extensions, Users, Profiles, Products
├── migration-part2-commerce.sql ← 🎯 Run SECOND: Orders, Shipments, Carry, Suppliers
├── migration-part3-features.sql ← 🎯 Run THIRD: Payments, Escrow, RFQ, Chat, Notifications
├── migration-part4-admin.sql    ← 🎯 Run FOURTH: CMS, Admin, Analytics, Inspections, Trade
├── master-migration.sql         ← (Reference only — not recommended for direct use)
├── README-SETUP.md              ← This file
├── migrations/                  ← Individual migration files (for reference)
│   ├── 001_users.sql
│   ├── 002_products.sql
│   └── ...
└── seeds/
    └── seed.sql                 ← Optional test data
```

---

## 🌱 Optional: Load Test Data

The `master-migration.sql` file contains seed data at the very end, commented out.  
To load test data, scroll to the bottom of the file and uncomment the seed section, then run it.

Or run `database/seeds/seed.sql` separately in the SQL Editor.

---

## 🔐 Row Level Security (RLS)

The master migration includes RLS policies for all tables. These are automatically applied.

RLS ensures:
- Users can only see their own data
- Suppliers can only manage their own products and orders
- Admins have full access
- Public data (products, categories) is readable by everyone

---

## 🚀 After Database Setup

1. **Configure Environment Variables** — Set your Supabase URL and anon key in:
   - Frontend: update `assets/js/supabase-config.js`
   - Backend: update `.env` with `SUPABASE_URL` and `SUPABASE_KEY`

2. **Deploy Backend** — Push to Railway (configured via `backend/railway.toml`)

3. **Deploy Frontend** — Push to Namecheap / your hosting provider

4. **Test** — Open the site and try registering a new user
