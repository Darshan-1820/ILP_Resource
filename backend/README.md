# ILP Backend — Render.com Deployment

## What This Is

Express.js API powering the ILP Study Guide: Firebase Auth verification, Razorpay payments, device locking, content gating, and admin dashboard.

## Deploy on Render.com

### 1. Create a Web Service

- Go to [https://dashboard.render.com](https://dashboard.render.com)
- Click **New → Web Service**
- Connect the GitHub repo (`ILP_Resource`)
- Set **Root Directory** to `backend`

### 2. Configure Build & Start

| Setting        | Value             |
|----------------|-------------------|
| Runtime        | **Node**          |
| Build Command  | `npm install`     |
| Start Command  | `node server.js`  |

### 3. Set Environment Variables

Go to the **Environment** tab in Render and add these:

| Variable                   | Description                                                    |
|---------------------------|----------------------------------------------------------------|
| `PORT`                    | Render sets this automatically — leave blank or set `3001`     |
| `FRONTEND_URL`            | Your frontend URL, e.g. `https://ilpguide.org`                |
| `ADMIN_EMAIL`             | Gmail used for admin access (Darshan's email)                  |
| `FIREBASE_SERVICE_ACCOUNT`| Full JSON string of your Firebase service account key          |
| `RAZORPAY_KEY_ID`         | Razorpay live Key ID (starts with `rzp_live_`)                 |
| `RAZORPAY_KEY_SECRET`     | Razorpay live Key Secret                                       |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret from Razorpay Dashboard → Webhooks              |

**FIREBASE_SERVICE_ACCOUNT format:** Paste the entire service account JSON as a single-line string. Render handles it as-is — no base64 encoding needed.

### 4. Deploy

Click **Create Web Service**. Render will run `npm install` and start `node server.js`.

### 5. Verify

Hit the health endpoint:

```
GET https://your-render-url.onrender.com/api/health
```

Should return:

```json
{ "status": "ok", "timestamp": "..." }
```

### 6. Set Up Razorpay Webhook (Optional but Recommended)

In the Razorpay Dashboard:

1. Go to **Settings → Webhooks → Add New Webhook**
2. URL: `https://your-render-url.onrender.com/api/payment/webhook`
3. Secret: Use the same value you set in `RAZORPAY_WEBHOOK_SECRET`
4. Events: Select `payment.captured`

This acts as a backup payment verification (server-to-server), in case the frontend verify call fails.

## API Endpoints

| Method | Path                         | Auth     | Description                    |
|--------|------------------------------|----------|--------------------------------|
| GET    | `/api/health`                | None     | Health check                   |
| POST   | `/api/auth/register-device`  | Firebase | Register device on login       |
| GET    | `/api/auth/check-device`     | Firebase | Validate current device        |
| GET    | `/api/user/status`           | Firebase | Get payment/user status        |
| POST   | `/api/payment/create-order`  | Firebase | Create Razorpay order          |
| POST   | `/api/payment/verify`        | Firebase | Verify payment signature       |
| POST   | `/api/payment/webhook`       | Razorpay | Webhook backup verification    |
| GET    | `/api/content/:page`         | Firebase | Serve locked content (paid)    |
| GET    | `/api/admin/stats`           | Admin    | Dashboard stats                |
| GET    | `/api/admin/users`           | Admin    | User list                      |
| GET    | `/api/admin/payments`        | Admin    | Recent payments                |

## Local Development

```bash
cd backend
cp .env.example .env
# Fill in real values in .env
npm install
npm run dev
```

The dev server uses `--watch` for auto-restart on file changes.
