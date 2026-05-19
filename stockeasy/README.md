# StockEasy — Inventory Management System

A simple, vendor-friendly inventory management app built with **Next.js** and **PostgreSQL (Neon)**. Deploy to Vercel in under 10 minutes for free.

---

## Features

- ✅ Add products with SKU, category, price, unit
- ✅ Record **inflow** (purchases / received stock)
- ✅ Record **outflow** (sales / issued stock)
- ✅ Edit / delete products manually
- ✅ Low stock alerts
- ✅ Full transaction log with filters
- ✅ Works on mobile and desktop
- ✅ 100% free to deploy (Vercel + Neon free tiers)

---

## Deploy to Vercel (Step-by-Step)

### Step 1 — Get a free PostgreSQL database (Neon)

1. Go to **https://neon.tech** and sign up for free
2. Click **"New Project"** → give it a name (e.g. `stockeasy`)
3. Once created, click **"Connection string"** and copy the URL
   - It looks like: `postgres://user:password@ep-xxx.neon.tech/neondb?sslmode=require`
4. Save this URL — you'll need it in Step 3

### Step 2 — Push code to GitHub

1. Go to **https://github.com** → click **"New repository"**
2. Name it `stockeasy`, keep it private or public
3. On your computer, open terminal in this folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stockeasy.git
git push -u origin main
```

### Step 3 — Deploy on Vercel

1. Go to **https://vercel.com** → sign up / log in with GitHub
2. Click **"Add New Project"** → import your `stockeasy` repo
3. Before clicking Deploy, click **"Environment Variables"** and add:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | (paste the Neon connection string from Step 1) |

4. Click **"Deploy"** — wait ~2 minutes
5. Your app is live at `https://stockeasy-xxx.vercel.app` 🎉

---

## Run Locally (Development)

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env.local
# Edit .env.local and add your DATABASE_URL

# 3. Start the dev server
npm run dev

# 4. Open http://localhost:3000
```

---

## Project Structure

```
stockeasy/
├── pages/
│   ├── index.js          # Main UI (React)
│   ├── _app.js           # App wrapper
│   └── api/
│       ├── products.js   # GET all, POST new product
│       ├── products/
│       │   └── [id].js   # PUT edit, DELETE product
│       ├── inflow.js     # POST stock inflow
│       ├── outflow.js    # POST stock outflow
│       └── transactions.js # GET transaction log
├── lib/
│   └── db.js             # Database connection + schema init
├── styles/
│   └── globals.css       # All styles
├── .env.example          # Template for env vars
└── package.json
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products |
| POST | `/api/products` | Add new product |
| PUT | `/api/products/:id` | Edit product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/inflow` | Record stock inflow |
| POST | `/api/outflow` | Record stock outflow |
| GET | `/api/transactions` | Get transaction log |

---

## Tech Stack

- **Frontend**: React + Next.js (Pages Router)
- **Backend**: Next.js API Routes (serverless)
- **Database**: PostgreSQL via [Neon](https://neon.tech) (serverless Postgres)
- **Deployment**: [Vercel](https://vercel.com) (free tier)

---

## Troubleshooting

**"Database connection failed"**
→ Check your `DATABASE_URL` in Vercel environment variables. Make sure it includes `?sslmode=require` at the end.

**"A product with this SKU already exists"**
→ Each SKU must be unique. Either enter a different SKU or leave it blank to auto-generate one.

**Products not showing after deploy**
→ The database tables are created automatically on first request. Try refreshing once.
