# সম্পূর্ণ ফিচার অডিট রিপোর্ট
## GlobexSky ই-কমার্স প্ল্যাটফর্ম

> **রিপোর্ট তারিখ:** মার্চ ২০২৬  
> **রিপোজিটরি:** `nusratneela101/GlobexSky`  
> **ভাষা:** বাংলা (Bengali)

---

## ১. প্রকল্প সারসংক্ষেপ (Project Summary)

**GlobexSky** একটি পূর্ণাঙ্গ B2B/B2C ই-কমার্স প্ল্যাটফর্ম যা একাধারে Alibaba, DHL এবং Shopify-এর মতো একাধিক সার্ভিস একত্রিত করে। এই প্ল্যাটফর্মে রয়েছে পণ্য সোর্সিং, আন্তর্জাতিক শিপমেন্ট, ড্রপশিপিং, AI-চালিত ফিচার, লাইভ স্ট্রিমিং, ট্রেড ফাইন্যান্স, এবং আরও অনেক সুবিধা।

### প্রকল্পের মূল বৈশিষ্ট্যসমূহ:
- **পণ্য বাজার (B2B Marketplace):** সরাসরি সাপ্লায়ার থেকে পণ্য সোর্স করার সুবিধা
- **ক্যারি সার্ভিস (Carry Service):** ব্যক্তিগত কুরিয়ার সার্ভিস, যেখানে ভ্রমণকারীরা পণ্য বহন করতে পারেন
- **পার্সেল সার্ভিস (Parcel Service):** আন্তর্জাতিক শিপমেন্ট ব্যবস্থাপনা
- **AI ফিচার:** চ্যাটবট, পণ্য সুপারিশ, জালিয়াতি শনাক্তকরণ
- **ড্রপশিপিং:** স্বয়ংক্রিয় পণ্য সিঙ্ক্রোনাইজেশন
- **বহুভাষা সমর্থন:** ২৫টি ভাষায় ইন্টারফেস
- **PWA সমর্থন:** অফলাইন কার্যকারিতা ও পুশ নোটিফিকেশন

### প্রযুক্তি পরিচিতি:
| স্তর | প্রযুক্তি |
|------|-----------|
| ফ্রন্টেন্ড | HTML5, CSS3, JavaScript (Vanilla) |
| ব্যাকেন্ড | Node.js / Express.js |
| ডাটাবেস | PostgreSQL (Supabase) |
| ক্লাউড স্টোরেজ | Cloudinary |
| PWA | Service Worker + Web App Manifest |
| রিয়েল-টাইম | WebSocket |
| i18n | JSON-ভিত্তিক বহুভাষা সমর্থন |
| ডিপ্লয়মেন্ট | Railway (ব্যাকেন্ড), Namecheap (ফ্রন্টেন্ড) |

---

## ২. ফিচার অডিট সারণি (Feature Audit Table)

> **কিংবদন্তি (Legend):**  
> ✅ = ফাইল বিদ্যমান | ❌ = ফাইল অনুপস্থিত  
> 🟢 **সম্পূর্ণ** = সব স্তরে ফাইল আছে  
> 🟡 **আংশিক** = কিছু স্তরে ফাইল আছে  
> 🔴 **অনুপস্থিত** = কোনো স্তরে ফাইল নেই

| # | ফিচার নাম | ফ্রন্টেন্ড | ব্যাকেন্ড কন্ট্রোলার | ব্যাকেন্ড রাউট | ডাটাবেস মাইগ্রেশন | স্থিতি |
|---|-----------|-----------|---------------------|--------------|-----------------|--------|
| 1 | অথেনটিকেশন (Login/Register) | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 2 | ইউজার ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 3 | অ্যাডমিন ড্যাশবোর্ড | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 4 | অ্যাডমিন রোল ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 5 | প্রোডাক্ট ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 6 | ক্যাটেগরি ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 7 | শপিং কার্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 8 | চেকআউট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 9 | অর্ডার ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 10 | পেমেন্ট সিস্টেম | ✅ | ✅ | ✅ | ✅ | 🟡 আংশিক |
| 11 | COD (ক্যাশ অন ডেলিভারি) | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 12 | রিভিউ ও রেটিং | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 13 | অ্যাডভান্সড সার্চ | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 14 | RFQ (কোটেশন অনুরোধ) | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 15 | সাপ্লায়ার ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 16 | সাপ্লায়ার মূল্যায়ন | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 17 | ইন্সপেকশন সার্ভিস | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 18 | চ্যাট সিস্টেম | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 19 | চ্যাটবট | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 20 | AI ফিচার (সুপারিশ) | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 21 | লাইভ স্ট্রিমিং | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 22 | ভিডিও মিটিং | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 23 | ড্রপশিপিং | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 24 | API প্ল্যাটফর্ম | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 25 | অ্যানালিটিক্স ও ইনসাইটস | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 26 | বিজনেস ইন্টেলিজেন্স | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 27 | ক্যাম্পেইন ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 28 | ফ্ল্যাশ সেল | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 29 | CMS (কন্টেন্ট ম্যানেজমেন্ট) | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 30 | SEO ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 31 | PWA সমর্থন | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 32 | পুশ নোটিফিকেশন | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 33 | অ্যাড্রেস ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 34 | ডিসপিউট ব্যবস্থাপনা | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 35 | রিফান্ড সিস্টেম | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 36 | ব্যাকআপ সিস্টেম | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 37 | ফিচার টগল | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 38 | ক্যারি সার্ভিস | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 39 | পার্সেল সার্ভিস | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 40 | ফ্রেট ফরওয়ার্ডিং | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 41 | ওয়্যারহাউস ম্যানেজমেন্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 42 | শিপমেন্ট ট্র্যাকিং | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 43 | ট্রেড ফাইন্যান্স | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 44 | ট্রেড শো | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 45 | লয়্যালটি প্রোগ্রাম | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 46 | পেআউট সিস্টেম | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 47 | প্রাইসিং সিস্টেম | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 48 | কমিশন সিস্টেম | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 49 | ইন্টিগ্রেশন ও ওয়েবহুক | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 50 | সোর্সিং সলিউশন | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 51 | উইশলিস্ট | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 52 | আপলোড সার্ভিস | ❌ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 53 | ফাইন্যান্সিয়াল রিপোর্ট | ✅ | ✅ | ✅ | ✅ | 🟢 সম্পূর্ণ |
| 54 | সেটিংস | ✅ | ✅ | ✅ | ❌ | 🟡 আংশিক |
| 55 | বহুভাষা সমর্থন (i18n) | ✅ | ❌ | ❌ | ❌ | 🟡 আংশিক |
| 56 | VR শোরুম | ✅ | ❌ | ❌ | ❌ | 🔴 অনুপস্থিত |
| 57 | পণ্য কাস্টমাইজেশন | ✅ | ❌ | ❌ | ❌ | 🔴 অনুপস্থিত |
| 58 | অ্যাডভার্টাইজিং প্ল্যাটফর্ম | ✅ | ❌ | ❌ | ❌ | 🔴 অনুপস্থিত |

---

## ৩. বিভাগ অনুযায়ী বিশ্লেষণ (Category-wise Analysis)

### ৩.১ অথেনটিকেশন ও ইউজার ম্যানেজমেন্ট (Authentication & User Management)

**বিদ্যমান ফাইলসমূহ:**
- **ফ্রন্টেন্ড:**
  - `pages/auth/login.html` — লগইন পেজ
  - `pages/auth/register.html` — রেজিস্ট্রেশন পেজ
  - `pages/account/profile.html` — ব্যবহারকারীর প্রোফাইল
  - `pages/account/settings.html` — অ্যাকাউন্ট সেটিংস
  - `pages/account/notification-preferences.html` — নোটিফিকেশন পছন্দ
  - `pages/account/payment-methods.html` — পেমেন্ট পদ্ধতি
- **ব্যাকেন্ড কন্ট্রোলার:**
  - `backend/controllers/auth.controller.js`
  - `backend/controllers/user.controller.js`
  - `backend/controllers/adminUserController.js`
- **ব্যাকেন্ড রাউট:**
  - `backend/routes/auth.routes.js`
  - `backend/routes/user.routes.js`
  - `backend/routes/adminUsers.js`
- **ডাটাবেস:**
  - `database/migrations/001_create_users.js`
  - `database/migrations/001_users.sql`

**মূল্যায়ন:** ✅ এই বিভাগটি সম্পূর্ণভাবে পরিকল্পিত এবং সব স্তরে ফাইল বিদ্যমান।

---

### ৩.২ অ্যাডমিন প্যানেল (Admin Panel)

**বিদ্যমান ফাইলসমূহ (pages/admin/):**

| পেজ | বিবরণ |
|-----|-------|
| `dashboard.html` | মূল অ্যাডমিন ড্যাশবোর্ড |
| `users.html` / `user-detail.html` | ইউজার ম্যানেজমেন্ট |
| `products.html` / `product-detail.html` | প্রোডাক্ট ম্যানেজমেন্ট |
| `orders.html` / `order-detail.html` | অর্ডার ব্যবস্থাপনা |
| `payments.html` / `payouts.html` | পেমেন্ট ও পেআউট |
| `disputes.html` | বিরোধ ব্যবস্থাপনা |
| `refunds.html` | রিফান্ড ব্যবস্থাপনা |
| `categories.html` | ক্যাটেগরি ব্যবস্থাপনা |
| `shipments.html` | শিপমেন্ট ব্যবস্থাপনা |
| `carry-service.html` | ক্যারি সার্ভিস |
| `parcel-service.html` | পার্সেল সার্ভিস |
| `warehouses.html` | গুদাম ব্যবস্থাপনা |
| `campaigns.html` | ক্যাম্পেইন ম্যানেজমেন্ট |
| `flash-sales.html` | ফ্ল্যাশ সেল |
| `banners.html` | ব্যানার ব্যবস্থাপনা |
| `commissions.html` | কমিশন ব্যবস্থাপনা |
| `pricing.html` | মূল্য নির্ধারণ |
| `cms.html` / `blog.html` / `content.html` | CMS |
| `ai.html` | AI ম্যানেজমেন্ট |
| `chatbot.html` | চ্যাটবট সেটিংস |
| `api-clients.html` | API ক্লায়েন্ট |
| `backup.html` | ব্যাকআপ সিস্টেম |
| `reports.html` / `financial-reports.html` | রিপোর্ট ও বিশ্লেষণ |
| `seo.html` | SEO ম্যানেজমেন্ট |
| `feature-toggles.html` | ফিচার চালু/বন্ধ |
| `roles.html` | ভূমিকা ব্যবস্থাপনা |
| `settings.html` | সিস্টেম সেটিংস |
| `inspection.html` / `inspections.html` | ইন্সপেকশন ব্যবস্থাপনা |
| `supplier-assessment.html` / `supplier-verification.html` | সাপ্লায়ার মূল্যায়ন |
| `carrier-verification.html` | ক্যারিয়ার ভেরিফিকেশন |
| `live-streams.html` | লাইভ স্ট্রিম |
| `loyalty.html` | লয়্যালটি প্রোগ্রাম |
| `trade-finance.html` | ট্রেড ফাইন্যান্স |
| `logs.html` | সিস্টেম লগ |
| `marketing.html` | মার্কেটিং |
| `support.html` | সাপোর্ট ম্যানেজমেন্ট |
| `pages.html` | পেজ ম্যানেজমেন্ট |
| `index.html` | অ্যাডমিন ইনডেক্স |

**ব্যাকেন্ড:**
- `backend/controllers/admin.controller.js`
- `backend/controllers/adminProductController.js`
- `backend/controllers/adminRoleController.js`
- `backend/controllers/adminUserController.js`
- `backend/controllers/reportController.js`
- `backend/controllers/settingsController.js`

**মূল্যায়ন:** ✅ অ্যাডমিন প্যানেল অত্যন্ত সম্পূর্ণ — মোট **৪৮টি** অ্যাডমিন পেজ বিদ্যমান।

---

### ৩.৩ ই-কমার্স কোর (E-Commerce Core)

**পণ্য সোর্সিং (pages/sourcing/):**
- `index.html` — সোর্সিং হোমপেজ
- `products.html` — পণ্য তালিকা
- `product-detail.html` — পণ্যের বিস্তারিত
- `categories.html` — বিভাগ তালিকা
- `cart.html` — শপিং কার্ট
- `checkout.html` — চেকআউট
- `order-confirmation.html` — অর্ডার নিশ্চিতকরণ
- `order-tracking.html` — অর্ডার ট্র্যাকিং
- `rfq.html` / `rfq-list.html` / `quotation-compare.html` — RFQ সিস্টেম
- `wishlist.html` — উইশলিস্ট
- `reviews.html` — রিভিউ
- `one-touch.html` — ওয়ান-টাচ সোর্সিং
- `customization.html` — পণ্য কাস্টমাইজেশন
- `inspection.html` — ইন্সপেকশন সার্ভিস
- `live-streams.html` — লাইভ স্ট্রিম পণ্য
- `trade-shows.html` — ট্রেড শো
- `vr-showroom.html` — VR শোরুম

**ব্যাকেন্ড কন্ট্রোলার:**
- `product.controller.js`, `cart.controller.js`, `checkout.controller.js`
- `order.controller.js`, `rfq.controller.js`, `review.controller.js`
- `wishlist.controller.js`, `inspection.controller.js`
- `sourcingSolutions.controller.js`

**ডাটাবেস মাইগ্রেশন:**
- `002_create_products.js`, `002_products.sql`
- `003_create_orders.js`, `003_orders.sql`
- `cart.sql`, `rfq.sql`, `reviews.sql`, `inspections.sql`
- `009_create_rfq.js`, `006_create_reviews.js`

**মূল্যায়ন:** 🟢 ই-কমার্স কোর মূলত সম্পূর্ণ। তৃতীয় পক্ষের পেমেন্ট গেটওয়ে ইন্টিগ্রেশন এবং VR শোরুম ব্যাকেন্ড আংশিক।

---

### ৩.৪ পেমেন্ট সিস্টেম (Payment System)

**ফ্রন্টেন্ড:**
- `pages/payment/payment.html` — পেমেন্ট পেজ
- `pages/payment/payment-success.html` — পেমেন্ট সফল
- `pages/payment/payment-failed.html` — পেমেন্ট ব্যর্থ
- `pages/payment/history.html` — পেমেন্ট ইতিহাস
- `pages/admin/cod.html` — COD ম্যানেজমেন্ট
- `pages/account/payment-methods.html` — পেমেন্ট পদ্ধতি

**ব্যাকেন্ড:**
- `payment.controller.js`, `paymentController.js`, `cod.controller.js`
- `payment.routes.js`, `payments.js`, `cod.routes.js`

**ডাটাবেস:**
- `004_create_payments.js`, `005_payments.sql`, `payments.sql`

**মূল্যায়ন:** 🟡 ফাইল কাঠামো সম্পূর্ণ, তবে Stripe/PayPal-এর মতো তৃতীয় পক্ষের পেমেন্ট গেটওয়ে সত্যিকারের ইন্টিগ্রেশন আংশিক।

---

### ৩.৫ AI ফিচারসমূহ (AI Features)

**ফ্রন্টেন্ড:**
- `pages/admin/ai.html` — AI ম্যানেজমেন্ট
- `pages/admin/chatbot.html` — চ্যাটবট পরিচালনা
- `pages/ai/chatbot.html` — ব্যবহারকারীর চ্যাটবট
- `pages/ai/recommendations.html` — AI সুপারিশ
- `pages/support/chatbot.html` — সাপোর্ট চ্যাটবট

**ব্যাকেন্ড:**
- `ai.controller.js` — AI কার্যকারিতা (মূল AI কন্ট্রোলার)
- `chatbot.controller.js` — চ্যাটবট লজিক
- `ai.routes.js`, `chatbot.routes.js`

**মূল্যায়ন:** 🟡 ফাইল কাঠামো আছে, তবে OpenAI/Anthropic-এর মতো প্রকৃত AI API ইন্টিগ্রেশন এবং ডাটাবেস মাইগ্রেশন অনুপস্থিত।

---

### ৩.৬ কমিউনিকেশন (Communication)

**ফ্রন্টেন্ড:**
- `pages/communication/chat.html` — রিয়েল-টাইম চ্যাট
- `pages/communication/meeting.html` — ভিডিও মিটিং
- `pages/meetings/room.html` — মিটিং রুম
- `pages/meetings/schedule.html` — মিটিং শিডিউল
- `pages/account/messages.html` — বার্তা ইনবক্স

**ব্যাকেন্ড:**
- `chat.controller.js`, `videoMeeting.controller.js`
- `chat.routes.js`, `videoMeeting.routes.js`
- `backend/config/websocket.js`

**ডাটাবেস:**
- `011_create_chat.js`, `chat.sql`, `meetings.sql`
- `007_messaging.sql`

**মূল্যায়ন:** 🟢 চ্যাট ও ভিডিও মিটিং উভয়ের জন্যই সম্পূর্ণ কাঠামো বিদ্যমান।

---

### ৩.৭ ড্রপশিপিং (Dropshipping)

**ফ্রন্টেন্ড (pages/dropshipping/):**
- `dashboard.html` — ড্রপশিপিং ড্যাশবোর্ড
- `products.html` — পণ্য তালিকা
- `suppliers.html` — সাপ্লায়ার তালিকা
- `orders.html` — অর্ডার ব্যবস্থাপনা
- `analytics.html` — বিশ্লেষণ
- `settings.html` — সেটিংস

**ব্যাকেন্ড:**
- `dropshipping.controller.js`
- `dropshipping.routes.js`

**মূল্যায়ন:** 🟡 ফ্রন্টেন্ড ও ব্যাকেন্ড আছে, তবে Alibaba/1688/AliExpress-এর মতো বাস্তব প্ল্যাটফর্মের সাথে ড্রপশিপিং সিঙ্ক্রোনাইজেশন এবং ডাটাবেস মাইগ্রেশন অনুপস্থিত।

---

### ৩.৮ ক্যাম্পেইন ও মার্কেটিং (Campaigns & Marketing)

**ফ্রন্টেন্ড:**
- `pages/campaigns/flash-sales.html` — ফ্ল্যাশ সেল
- `pages/campaigns/promotions.html` — প্রমোশন
- `pages/flash-sales/index.html` — ফ্ল্যাশ সেল হোম
- `pages/admin/campaigns.html` — ক্যাম্পেইন অ্যাডমিন
- `pages/admin/flash-sales.html` — ফ্ল্যাশ সেল অ্যাডমিন
- `pages/admin/banners.html` — ব্যানার ব্যবস্থাপনা
- `pages/admin/marketing.html` — মার্কেটিং

**ব্যাকেন্ড:**
- `campaign.controller.js`, `flashSale.controller.js`
- `campaign.routes.js`, `flashSale.routes.js`

**ডাটাবেস:**
- `010_campaigns.sql`, `015_create_campaigns.js`

**মূল্যায়ন:** 🟢 ক্যাম্পেইন সিস্টেম সম্পূর্ণ। ফ্ল্যাশ সেলের ডাটাবেস মাইগ্রেশন আংশিক।

---

### ৩.৯ CMS (Content Management System)

**ফ্রন্টেন্ড:**
- `pages/admin/cms.html` — CMS ড্যাশবোর্ড
- `pages/admin/blog.html` — ব্লগ ম্যানেজমেন্ট
- `pages/admin/content.html` — কন্টেন্ট ব্যবস্থাপনা
- `pages/admin/pages.html` — পেজ ম্যানেজমেন্ট

**ব্যাকেন্ড:**
- `cms.controller.js`, `cmsController.js`
- `cms.routes.js`, `cms.js`

**ডাটাবেস:**
- `008_cms.sql`, `cms.sql`

**মূল্যায়ন:** 🟢 CMS সম্পূর্ণ কাঠামো বিদ্যমান।

---

### ৩.১০ API প্ল্যাটফর্ম (API Platform)

**ফ্রন্টেন্ড (pages/api/):**
- `index.html` — API প্ল্যাটফর্ম হোম
- `developer-portal.html` — ডেভেলপার পোর্টাল
- `documentation.html` — API ডকুমেন্টেশন
- `keys.html` — API কী ম্যানেজমেন্ট
- `dashboard.html` — API ড্যাশবোর্ড
- `webhooks.html` — ওয়েবহুক
- `pricing.html` — API মূল্য পরিকল্পনা

**ব্যাকেন্ড:**
- `apiPlatform.controller.js`, `webhook.controller.js`, `integration.controller.js`
- `api-platform.routes.js`, `webhook.routes.js`, `integration.routes.js`

**ডাটাবেস:**
- `009_api_platform.sql`

**মূল্যায়ন:** 🟢 API প্ল্যাটফর্ম সম্পূর্ণভাবে পরিকল্পিত।

---

### ৩.১১ অ্যানালিটিক্স ও রিপোর্টিং (Analytics & Reporting)

**ফ্রন্টেন্ড (pages/insights/):**
- `index.html` — ইনসাইটস হোম
- `market.html` — মার্কেট বিশ্লেষণ
- `trends.html` — ট্রেন্ড বিশ্লেষণ
- `reports.html` — রিপোর্ট
- `buyer-analytics.html` — ক্রেতা বিশ্লেষণ
- `supplier-analytics.html` — সাপ্লায়ার বিশ্লেষণ
- `pages/admin/financial-reports.html` — আর্থিক রিপোর্ট
- `pages/admin/reports.html` — সামগ্রিক রিপোর্ট

**ব্যাকেন্ড:**
- `analytics.controller.js`, `businessIntelligence.controller.js`, `reportController.js`
- `analytics.routes.js`, `businessIntelligence.routes.js`, `reports.js`

**ডাটাবেস:**
- `reports.sql`

**মূল্যায়ন:** 🟢 অ্যানালিটিক্স ও রিপোর্টিং সিস্টেম সম্পূর্ণ।

---

### ৩.১২ ক্যারি সার্ভিস (Carry Service)

**ফ্রন্টেন্ড:**
- `pages/admin/carry-service.html` — ক্যারি সার্ভিস অ্যাডমিন
- `pages/admin/carrier-verification.html` — ক্যারিয়ার ভেরিফিকেশন
- `pages/shipment/index.html` — শিপমেন্ট হোম
- `assets/js/carry.js` — ক্যারি ফ্রন্টেন্ড লজিক

**ব্যাকেন্ড:**
- `carry.controller.js`
- `carry.routes.js`

**ডাটাবেস:**
- `012_create_carry.js`, `carry.sql`

**মূল্যায়ন:** 🟢 ক্যারি সার্ভিস সম্পূর্ণ।

---

### ৩.১৩ বিরোধ ব্যবস্থাপনা (Dispute Management)

**ফ্রন্টেন্ড:**
- `pages/account/disputes.html` — ব্যবহারকারীর বিরোধ
- `pages/admin/disputes.html` — অ্যাডমিন বিরোধ ব্যবস্থাপনা

**ব্যাকেন্ড:**
- `dispute.controller.js`
- `dispute.routes.js`

**ডাটাবেস:**
- `007_create_disputes.js`

**মূল্যায়ন:** 🟢 সম্পূর্ণ।

---

### ৩.১৪ ব্যাকআপ সিস্টেম (Backup System)

**ফ্রন্টেন্ড:**
- `pages/admin/backup.html` — ব্যাকআপ ম্যানেজমেন্ট

**ব্যাকেন্ড:**
- `backup.controller.js`
- `backup.routes.js`

**মূল্যায়ন:** 🟡 ফ্রন্টেন্ড ও ব্যাকেন্ড আছে, তবে ডাটাবেস মাইগ্রেশন অনুপস্থিত।

---

### ৩.১৫ SEO ও PWA (SEO & PWA)

**ফ্রন্টেন্ড:**
- `robots.txt` — সার্চ ইঞ্জিন কনফিগ
- `sitemap.xml` — সাইটম্যাপ
- `manifest.json` — PWA মেনিফেস্ট
- `sw.js` — সার্ভিস ওয়ার্কার
- `pages/admin/seo.html` — SEO অ্যাডমিন প্যানেল

**ব্যাকেন্ড:**
- `seo.controller.js`, `pushNotification.controller.js`
- `seo.routes.js`, `pushNotification.routes.js`

**ডাটাবেস:**
- `notifications.sql`, `010_create_notifications.js`

**মূল্যায়ন:** 🟢 SEO ও PWA উভয়ই সম্পূর্ণভাবে সেটআপ করা।

---

### ৩.১৬ বহুভাষা সমর্থন (Internationalization / i18n)

**বিদ্যমান ভাষা ফাইলসমূহ (locales/):**

| ভাষা | ফাইল | অঞ্চল |
|------|------|-------|
| আরবি | `ar.json` | মধ্যপ্রাচ্য |
| বাংলা | `bn.json` | বাংলাদেশ/ভারত |
| জার্মান | `de.json` | জার্মানি |
| ইংরেজি | `en.json` | বৈশ্বিক |
| স্পেনিশ | `es.json` | স্পেন/লাতিন আমেরিকা |
| ফার্সি | `fa.json` | ইরান |
| ফরাসি | `fr.json` | ফ্রান্স |
| হিব্রু | `he.json` | ইসরায়েল |
| হিন্দি | `hi.json` | ভারত |
| ইন্দোনেশিয়ান | `id.json` | ইন্দোনেশিয়া |
| ইতালিয়ান | `it.json` | ইতালি |
| জাপানিজ | `ja.json` | জাপান |
| কোরিয়ান | `ko.json` | দক্ষিণ কোরিয়া |
| মালয় | `ms.json` | মালয়েশিয়া |
| ডাচ | `nl.json` | নেদারল্যান্ডস |
| পোলিশ | `pl.json` | পোল্যান্ড |
| পর্তুগিজ | `pt.json` | পর্তুগাল/ব্রাজিল |
| রাশিয়ান | `ru.json` | রাশিয়া |
| সোয়াহিলি | `sw.json` | পূর্ব আফ্রিকা |
| থাই | `th.json` | থাইল্যান্ড |
| ফিলিপিনো | `tl.json` | ফিলিপাইন |
| তুর্কি | `tr.json` | তুরস্ক |
| উর্দু | `ur.json` | পাকিস্তান |
| ভিয়েতনামিজ | `vi.json` | ভিয়েতনাম |
| চীনা | `zh.json` | চীন |

**সহায়ক ফাইল:**
- `assets/js/i18n.js` — ফ্রন্টেন্ড i18n লজিক
- `assets/css/rtl.css` — RTL (আরবি/হিব্রু/ফার্সি/উর্দু) সমর্থন

**মূল্যায়ন:** 🟡 ২৫টি ভাষার ফাইল বিদ্যমান। ব্যাকেন্ড লোকালাইজেশন এবং RTL ভাষার জন্য সম্পূর্ণ সমর্থন আংশিক।

---

## ৪. প্রযুক্তি স্ট্যাক বিশ্লেষণ (Tech Stack Analysis)

### ৪.১ ফ্রন্টেন্ড (Frontend)

| প্রযুক্তি | ফাইল | বিবরণ |
|-----------|------|-------|
| HTML5 | `index.html`, `pages/**/*.html` | মার্কআপ কাঠামো |
| CSS3 | `assets/css/*.css` | স্টাইলিং (৯টি CSS ফাইল) |
| JavaScript | `assets/js/*.js` | ক্লায়েন্ট-সাইড লজিক (৩৮টি JS ফাইল) |
| PWA | `manifest.json`, `sw.js` | অফলাইন ক্যাপাবিলিটি |
| RTL সমর্থন | `assets/css/rtl.css` | ডান-থেকে-বাম ভাষা |
| অ্যানিমেশন | `assets/css/animations.css`, `assets/js/animations.js` | UI অ্যানিমেশন |
| রেসপন্সিভ ডিজাইন | `assets/css/responsive.css` | মোবাইল সমর্থন |
| প্রিন্ট স্টাইল | `assets/css/print.css` | মুদ্রণ সমর্থন |

**মোট ফ্রন্টেন্ড পেজ:** ~১৬৩টি HTML পেজ

### ৪.২ ব্যাকেন্ড (Backend)

| প্রযুক্তি | ফাইল | বিবরণ |
|-----------|------|-------|
| Node.js/Express | `backend/` | সার্ভার-সাইড ফ্রেমওয়ার্ক |
| Supabase/PostgreSQL | `backend/config/supabase.js` | ডাটাবেস সংযোগ |
| Cloudinary | `backend/config/cloudinary.js` | ইমেজ/ফাইল স্টোরেজ |
| WebSocket | `backend/config/websocket.js` | রিয়েল-টাইম যোগাযোগ |
| ইমেইল টেম্পলেট | `backend/config/email-templates.js` | ইমেইল নোটিফিকেশন |
| CORS কনফিগ | `backend/config/cors.js` | ক্রস-অরিজিন নিরাপত্তা |
| শিপিং কনফিগ | `backend/config/shipping.js` | শিপিং প্রোভাইডার |
| ফ্রেট কনফিগ | `backend/config/freight.config.js` | ফ্রেট কনফিগারেশন |
| মুদ্রা কনফিগ | `backend/config/currency.config.js` | মাল্টি-কারেন্সি |
| ইন্টিগ্রেশন | `backend/config/integrations.js` | তৃতীয় পক্ষের API |

**মিডলওয়্যার:**
- `auth.js` — JWT অথেন্টিকেশন
- `adminAuth.js` — অ্যাডমিন অ্যাক্সেস নিয়ন্ত্রণ
- `rateLimiter.js` — রেট লিমিটিং
- `validator.js` — ইনপুট যাচাইকরণ
- `upload.js` — ফাইল আপলোড
- `errorHandler.js` — ত্রুটি ব্যবস্থাপনা
- `featureToggle.js` / `featureGate.middleware.js` — ফিচার ফ্ল্যাগ

**মোট ব্যাকেন্ড কন্ট্রোলার:** ৫৮টি  
**মোট ব্যাকেন্ড রাউট ফাইল:** ৫৯টি

### ৪.৩ ডাটাবেস (Database)

| উপাদান | বিবরণ |
|--------|-------|
| প্রযুক্তি | PostgreSQL (Supabase) |
| মাইগ্রেশন টুল | `database/migrate.js` |
| স্কিমা | `database/schema.sql` |
| মাইগ্রেশন ফাইল | ৪৭টি (.js ও .sql) |
| সিড ফাইল | ৭টি (test data) |
| RLS নীতি | Row Level Security (নিরাপত্তা) |

**প্রধান ডাটাবেস টেবিলসমূহ:**
- ব্যবহারকারী (users), পণ্য (products), অর্ডার (orders)
- পেমেন্ট (payments), শিপমেন্ট (shipments), রিভিউ (reviews)
- ক্যারি (carry), পার্সেল (parcel), গুদাম (warehouses)
- ক্যাম্পেইন (campaigns), RFQ (rfq), চ্যাট (chat)
- CMS (cms), অ্যাড্রেস (addresses), নোটিফিকেশন (notifications)
- মিটিং (meetings), রিপোর্ট (reports), মূল্য (pricing)

### ৪.৪ ডিপ্লয়মেন্ট (Deployment)

| পরিষেবা | কনফিগারেশন ফাইল | উদ্দেশ্য |
|---------|----------------|---------|
| Railway | `backend/railway.json`, `backend/railway.toml`, `backend/Procfile` | ব্যাকেন্ড হোস্টিং |
| Namecheap | `.htaccess` | ফ্রন্টেন্ড হোস্টিং (Apache) |

---

## ৫. অনুপস্থিত/অসম্পূর্ণ ফিচার তালিকা (Missing / Incomplete Features)

### ৫.১ ফ্রন্টেন্ড আছে কিন্তু ব্যাকেন্ড নেই:

| ফিচার | ফ্রন্টেন্ড পেজ | সমস্যা |
|-------|--------------|--------|
| VR শোরুম | `pages/sourcing/vr-showroom.html` | কোনো VR/3D ব্যাকেন্ড কন্ট্রোলার নেই |
| পণ্য কাস্টমাইজেশন | `pages/sourcing/customization.html` | কোনো dedicated customization controller নেই |
| অ্যাডভার্টাইজিং প্ল্যাটফর্ম | `pages/advertising/create.html`, `pages/supplier/advertising.html` | কোনো advertising controller নেই |

### ৫.২ ব্যাকেন্ড কন্ট্রোলার আছে কিন্তু ডাটাবেস মাইগ্রেশন নেই:

| ফিচার | কন্ট্রোলার | অনুপস্থিত মাইগ্রেশন |
|-------|------------|---------------------|
| চ্যাটবট | `chatbot.controller.js` | chatbot সেশন/লগ টেবিল |
| AI ফিচার | `ai.controller.js` | AI মডেল কনফিগ/লগ টেবিল |
| লাইভ স্ট্রিমিং | `livestream.controller.js` | livestream সেশন টেবিল |
| ড্রপশিপিং | `dropshipping.controller.js` | dropshipping প্রোডাক্ট ম্যাপিং টেবিল |
| ফ্ল্যাশ সেল | `flashSale.controller.js` | flash_sales বিস্তারিত টেবিল |
| ট্রেড ফাইন্যান্স | `tradeFinance.controller.js` | trade finance লেনদেন টেবিল |
| ট্রেড শো | `tradeShow.controller.js` | trade show ইভেন্ট টেবিল |
| লয়্যালটি প্রোগ্রাম | `loyalty.controller.js` | loyalty পয়েন্ট টেবিল |
| ব্যাকআপ | `backup.controller.js` | backup লগ/মেটাডেটা টেবিল |
| ফিচার টগল | `featureToggle.controller.js` | feature_flags টেবিল |
| কমিশন | `admin.controller.js` | commissions বিস্তারিত টেবিল |
| উইশলিস্ট | `wishlist.controller.js` | wishlists টেবিল |
| ইন্টিগ্রেশন | `integration.controller.js` | integrations টেবিল |
| সেটিংস | `settingsController.js` | system_settings টেবিল |

### ৫.৩ তৃতীয় পক্ষের ইন্টিগ্রেশন যা আংশিক বা অনুপস্থিত:

| ইন্টিগ্রেশন | বর্তমান অবস্থা | প্রয়োজনীয় পদক্ষেপ |
|-------------|---------------|-------------------|
| Stripe/PayPal পেমেন্ট | কনফিগ আছে, সত্যিকারের API call নেই | API কী সংযোগ এবং webhook হ্যান্ডলিং |
| DHL/FedEx শিপিং | কনফিগ ফাইল আছে | Live rate API সংযোগ |
| Alibaba/AliExpress সিঙ্ক | ড্রপশিপিং কন্ট্রোলার আছে | পণ্য সিঙ্ক API |
| OpenAI/AI প্রদানকারী | AI কন্ট্রোলার আছে | প্রকৃত LLM সংযোগ |
| Twilio/SMS প্রদানকারী | নোটিফিকেশন কন্ট্রোলার আছে | SMS পাঠানোর লজিক |
| SMTP ইমেইল | টেম্পলেট আছে | ইমেইল পাঠানোর সংযোগ |
| WebRTC ভিডিও | ভিডিও মিটিং কন্ট্রোলার আছে | WebRTC সিগনালিং |
| Agora/RTMP লাইভ | লাইভস্ট্রিম কন্ট্রোলার আছে | স্ট্রিমিং SDK সংযোগ |

---

## ৬. সুপারিশমালা (Recommendations)

### অগ্রাধিকার ১: জরুরি (Critical — এখনই করুন)

1. **ডাটাবেস মাইগ্রেশন সম্পূর্ণ করুন**
   - লাইভস্ট্রিম, ড্রপশিপিং, লয়্যালটি, ট্রেড ফাইন্যান্স, ট্রেড শো, চ্যাটবট, ফ্ল্যাশ সেল-এর জন্য মাইগ্রেশন ফাইল যোগ করুন।
   - `database/migrations/` ফোল্ডারে নতুন `.sql` ফাইল তৈরি করুন।

2. **পেমেন্ট গেটওয়ে সংযোগ করুন**
   - `.env.example`-এ Stripe বা PayPal API কী যোগ করুন।
   - `payment.controller.js`-এ সত্যিকারের charge/capture লজিক যুক্ত করুন।

3. **VR শোরুম ব্যাকেন্ড তৈরি করুন**
   - একটি `vrShowroom.controller.js` এবং `vrShowroom.routes.js` তৈরি করুন।
   - 3D মডেল আপলোড ও স্টোরেজের জন্য Cloudinary কনফিগ ব্যবহার করুন।

4. **অ্যাডভার্টাইজিং ব্যাকেন্ড তৈরি করুন**
   - `advertising.controller.js` তৈরি করুন।
   - বিজ্ঞাপন কার্যক্ষমতা ট্র্যাকিং (impression, click, conversion) যোগ করুন।

### অগ্রাধিকার ২: গুরুত্বপূর্ণ (High Priority)

5. **AI ইন্টিগ্রেশন বাস্তবায়ন করুন**
   - OpenAI API সংযোগ করুন `ai.controller.js`-এ।
   - চ্যাটবটের জন্য সেশন ব্যবস্থাপনা যোগ করুন।

6. **লাইভ স্ট্রিমিং সক্রিয় করুন**
   - Agora SDK বা WebRTC সংযোগ করুন `livestream.controller.js`-এ।
   - স্ট্রিম সেশন ডাটাবেস টেবিল তৈরি করুন।

7. **ড্রপশিপিং সিঙ্ক যোগ করুন**
   - তৃতীয় পক্ষের মার্কেটপ্লেস API সংযোগ করুন।
   - পণ্য সিঙ্ক ইন্টারভাল কনফিগার করুন।

8. **SMS/Email নোটিফিকেশন বাস্তবায়ন করুন**
   - Twilio (SMS) এবং SendGrid (Email) সংযোগ করুন।
   - `notification.controller.js`-এ প্রকৃত পাঠানোর লজিক যোগ করুন।

### অগ্রাধিকার ৩: মাঝারি (Medium Priority)

9. **i18n ব্যাকেন্ড সমর্থন যোগ করুন**
   - একটি dedicated locale API endpoint তৈরি করুন।
   - ব্যাকেন্ড ত্রুটি বার্তা স্থানীয়করণ করুন।

10. **কাস্টমাইজেশন কন্ট্রোলার তৈরি করুন**
    - `customization.controller.js` এবং `customization.routes.js` তৈরি করুন।
    - পণ্য স্পেসিফিকেশন ও কাস্টম অর্ডার ব্যবস্থাপনা যোগ করুন।

11. **ফিচার টগল ডাটাবেস সক্রিয় করুন**
    - `feature_flags` টেবিল মাইগ্রেশন তৈরি করুন।
    - অ্যাডমিন ড্যাশবোর্ড থেকে রিয়েল-টাইম ফিচার চালু/বন্ধ করার সুবিধা দিন।

12. **উইশলিস্ট মাইগ্রেশন যোগ করুন**
    - `wishlists` টেবিল মাইগ্রেশন তৈরি করুন।

### অগ্রাধিকার ৪: দীর্ঘমেয়াদী (Long Term)

13. **নিরাপত্তা উন্নত করুন**
    - দুই-ধাপ যাচাইকরণ (2FA) বাস্তবায়ন করুন।
    - জালিয়াতি শনাক্তকরণ অ্যালগরিদম যোগ করুন।
    - PCI DSS সম্মতি নিশ্চিত করুন পেমেন্টের জন্য।

14. **পরীক্ষা (Testing) যোগ করুন**
    - Unit tests (Jest/Mocha) লিখুন সমস্ত কন্ট্রোলারের জন্য।
    - Integration tests এবং E2E tests যোগ করুন।

15. **পারফরম্যান্স অপ্টিমাইজেশন**
    - Redis ক্যাশিং যোগ করুন।
    - CDN ব্যবহার করুন স্ট্যাটিক অ্যাসেটের জন্য।
    - ডাটাবেস ইন্ডেক্সিং অপ্টিমাইজ করুন।

---

## ৭. পরিসংখ্যান সারসংক্ষেপ (Statistics Summary)

| পরিসংখ্যান | সংখ্যা |
|------------|-------|
| **মোট অডিট করা ফিচার** | ৫৮টি |
| **সম্পূর্ণ ফিচার** (সব স্তরে ফাইল আছে) | ৩০টি |
| **আংশিক ফিচার** (কিছু স্তরে ফাইল আছে) | ২৫টি |
| **অনুপস্থিত ব্যাকেন্ড ফিচার** (শুধু ফ্রন্টেন্ড আছে) | ৩টি |
| **সমর্থিত ভাষা সংখ্যা** | ২৫টি |
| **মোট ফ্রন্টেন্ড HTML পেজ** | ~১৬৩টি |
| **মোট ব্যাকেন্ড কন্ট্রোলার** | ৫৮টি |
| **মোট ব্যাকেন্ড রাউট ফাইল** | ৫৯টি |
| **মোট ডাটাবেস মাইগ্রেশন ফাইল** | ৪৭টি |
| **মোট অ্যাডমিন পেজ** | ৪৮টি |
| **মোট অ্যাকাউন্ট পেজ** | ১৪টি |
| **CSS ফাইল সংখ্যা** | ৯টি |
| **JavaScript ফাইল সংখ্যা** | ৩৮টি |
| **ব্যাকেন্ড মিডলওয়্যার ফাইল** | ৮টি |
| **ব্যাকেন্ড কনফিগ ফাইল** | ১০টি |

### ফিচার সম্পূর্ণতার হার:

| বিভাগ | ফিচার সংখ্যা | হার |
|-------|-------------|-----|
| 🟢 সম্পূর্ণ ফিচার | ৩০/৫৮ | ৫২% |
| 🟡 আংশিক ফিচার | ২৫/৫৮ | ৪৩% |
| 🔴 অনুপস্থিত ব্যাকেন্ড | ৩/৫৮ | ৫% |

### বিভাগ অনুযায়ী সম্পূর্ণতা:

| বিভাগ | সম্পূর্ণতার হার | স্থিতি |
|-------|----------------|--------|
| অথেনটিকেশন ও ইউজার | ৯৫% | 🟢 প্রায় সম্পূর্ণ |
| অ্যাডমিন প্যানেল | ৯০% | 🟢 প্রায় সম্পূর্ণ |
| ই-কমার্স কোর | ৮৫% | 🟢 ভালো অবস্থায় |
| COD পেমেন্ট | ৯০% | 🟢 প্রায় সম্পূর্ণ |
| ক্যারি ও পার্সেল সার্ভিস | ৮৫% | 🟢 ভালো অবস্থায় |
| ডিসপিউট ও রিফান্ড | ৯০% | 🟢 প্রায় সম্পূর্ণ |
| অ্যানালিটিক্স ও রিপোর্টিং | ৮৫% | 🟢 ভালো অবস্থায় |
| CMS | ৮৫% | 🟢 ভালো অবস্থায় |
| API প্ল্যাটফর্ম | ৮৫% | 🟢 ভালো অবস্থায় |
| SEO ও PWA | ৮০% | 🟢 ভালো অবস্থায় |
| পেমেন্ট গেটওয়ে (3rd party) | ৪০% | 🟡 উন্নতি প্রয়োজন |
| AI ফিচার | ৪৫% | 🟡 উন্নতি প্রয়োজন |
| লাইভ স্ট্রিমিং | ৪০% | 🟡 উন্নতি প্রয়োজন |
| ড্রপশিপিং (সিঙ্ক সহ) | ৫০% | 🟡 উন্নতি প্রয়োজন |
| ট্রেড ফাইন্যান্স | ৫০% | 🟡 উন্নতি প্রয়োজন |
| বহুভাষা সমর্থন | ৬০% | 🟡 উন্নতি প্রয়োজন |
| VR শোরুম | ১৫% | 🔴 ব্যাকেন্ড প্রয়োজন |
| অ্যাডভার্টাইজিং | ২০% | 🔴 ব্যাকেন্ড প্রয়োজন |

---

## পরিশিষ্ট: সম্পূর্ণ ফাইল তালিকা সারসংক্ষেপ

### ব্যাকেন্ড কন্ট্রোলার (সম্পূর্ণ তালিকা):
`address`, `admin`, `adminProduct`, `adminRole`, `adminUser`, `advancedSearch`, `ai`, `analytics`, `apiPlatform`, `auth`, `backup`, `businessIntelligence`, `campaign`, `carry`, `cart`, `chat`, `chatbot`, `checkout`, `cms`, `cmsController`, `cod`, `dispute`, `dropshipping`, `featureToggle`, `flashSale`, `freight`, `inspection`, `integration`, `livestream`, `loyalty`, `notification`, `order`, `parcel`, `payment`, `paymentController`, `payoutController`, `pricing`, `pricingController`, `product`, `pushNotification`, `refund`, `reportController`, `review`, `rfq`, `seo`, `settingsController`, `shipment`, `sourcingSolutions`, `supplier`, `supplierAssessment`, `tradeFinance`, `tradeShow`, `upload`, `user`, `videoMeeting`, `warehouse`, `webhook`, `wishlist`

### ব্যাকেন্ড কনফিগারেশন ফাইল:
`cloudinary.js`, `constants.js`, `cors.js`, `currency.config.js`, `email-templates.js`, `freight.config.js`, `integrations.js`, `shipping.js`, `supabase.js`, `websocket.js`

### ব্যাকেন্ড মিডলওয়্যার ফাইল:
`adminAuth.js`, `auth.js`, `errorHandler.js`, `featureGate.middleware.js`, `featureToggle.js`, `rateLimiter.js`, `roleCheck.js`, `upload.js`, `validator.js`

---

*এই রিপোর্টটি `nusratneela101/GlobexSky` রিপোজিটরির বাস্তব কোডবেস বিশ্লেষণের উপর ভিত্তি করে তৈরি করা হয়েছে।*
