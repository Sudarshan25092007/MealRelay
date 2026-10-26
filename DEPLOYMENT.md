# MealRelay — Production Deployment & Operations Guide

> **Target Architecture:** GitHub (Source Control & Continuous Deployment) · Neon (Managed PostgreSQL) · Render (Node.js & Express API) · Vercel (React & Vite Frontend) · Prisma ORM

---

## 1. Architecture Overview

MealRelay uses a decoupled, three-tier architecture designed for reliability, strict data consistency, and operational safety:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant Vercel as Vercel (React + Vite SPA)
    participant Render as Render (Node.js + Express API)
    participant Neon as Neon (Serverless PostgreSQL)

    User->>Vercel: 1. Load web application (HTTPS)
    User->>Render: 2. API Request with JWT (HTTPS /api/...)
    Note over Render: Rate limiting, Security headers, Zod validation
    Render->>Neon: 3. Query / Transaction (Prisma pooled TCP with TLS)
    Neon-->>Render: 4. Committed state & audit record
    Render-->>User: 5. JSON Response { success: true, data: ... }
```

### Component Responsibilities
- **GitHub (`https://github.com/Sudarshan25092007/MealRelay.git`)**: Acts as the central source of truth for all source code. Connects directly to Vercel and Render for automated, continuous git-push deployments.
- **Neon (Managed PostgreSQL 18)**: Serverless, cloud-hosted relational database. Enforces primary/foreign key constraints, unique indexes, and handles multi-row transactional updates for atomic donation claims and status transitions.
- **Render (Backend Web Service)**: Runs the Node.js/Express REST API in a secure container. Enforces route-level authentication, authorization (`DONOR`, `NGO`, `ADMIN`), cryptographic HMAC pickup-code generation, and in-process background donation expiration.
- **Vercel (Frontend Hosting)**: Serves the optimized production Vite bundle over global edge networks. Handles client-side Single Page Application (SPA) routing via `vercel.json` rewrites.
- **Prisma ORM (v5.22.0)**: Manages database migrations (`prisma migrate deploy`), type-safe database queries, and database connection pooling.

---

## 2. Prerequisites

Before starting the deployment process, ensure you have:

### Accounts
1. **GitHub Account**: Access to push to [https://github.com/Sudarshan25092007/MealRelay.git](https://github.com/Sudarshan25092007/MealRelay.git).
2. **Neon Account**: [https://neon.tech](https://neon.tech) (Free tier available).
3. **Render Account**: [https://render.com](https://render.com) (Free tier available).
4. **Vercel Account**: [https://vercel.com](https://vercel.com) (Hobby / Free tier available).

### Local Software Requirements
- **Node.js**: v18.0.0 or later (v20+ recommended).
- **npm**: v9.0.0 or later.
- **Git**: v2.30.0 or later installed and configured with your credentials.
- **PostgreSQL Client (Optional)**: `psql` for database inspection if desired.

### Expected Repository Structure
```
MealRelay/
├── .env.example              # Workspace root template
├── .gitignore                # Protects environment secrets and dependencies
├── README.md                 # Product documentation
├── DEPLOYMENT.md             # This deployment guide
├── package.json              # Workspace root scripts
├── client/                   # Frontend React + Vite application
│   ├── .env.example          # Frontend environment template
│   ├── .gitignore            # Client ignore rules
│   ├── index.html            # Application entry HTML
│   ├── package.json          # Frontend dependencies & scripts
│   ├── vercel.json           # Vercel SPA routing rewrite rules
│   ├── vite.config.js        # Vite build configuration
│   └── src/                  # Components, context, pages, api client
└── server/                   # Backend Express + Node.js API
    ├── .env.example          # Server environment template
    ├── package.json          # Backend dependencies, postinstall & scripts
    ├── prisma/
    │   ├── schema.prisma     # Prisma data models & relational schema
    │   ├── migrations/       # Version-controlled SQL migration history
    │   └── seed.js           # Development demo seed script (disabled in prod)
    └── src/                  # Express app, modules, middleware, config
```

---

## 3. Local Pre-Deployment Checks

Run these commands locally to verify that all code compiles, tests pass, and Git is in a clean state before initiating deployment.

```bash
# 1. Navigate to the repository root
cd MealRelay

# 2. Verify all dependencies are installed
npm install
npm --prefix server install
npm --prefix client install

# 3. Execute the full automated test suite (57 integration tests)
npm run test

# 4. Execute the frontend production build
npm run build

# 5. Check Git status and verify no unwanted files are staged
git status
```

**Expected Results:**
- `npm run test`: All 57 tests pass (`phase2.test.js`, `api.test.js`, `admin.test.js`).
- `npm run build`: Vite finishes building `client/dist` in under 1 second with zero errors.
- `git status`: Only expected tracked files appear.

---

## 4. GitHub Setup

### Step 4.1: Verify Remote Configuration
Check whether the remote repository is already configured:

```bash
git remote -v
```

- **If no remote is listed**, connect your local repository to GitHub:
  ```bash
  git remote add origin https://github.com/Sudarshan25092007/MealRelay.git
  ```
- **If `origin` is already set**, verify it points to `https://github.com/Sudarshan25092007/MealRelay.git`. To correct it if needed:
  ```bash
  git remote set-url origin https://github.com/Sudarshan25092007/MealRelay.git
  ```

### Step 4.2: Verify Secret Exclusion
Before pushing, ensure that your local `.env` files are not staged:

```bash
git check-ignore .env server/.env client/.env client/.env.local server/.env.test
```
*Every file above must be printed by the command, confirming it is ignored.*

### Step 4.3: Push Code to GitHub
Ensure the current branch is `master` or `main`:

```bash
# Check current branch
git branch --show-current

# Push commits to GitHub (replace master with main if you use main)
git push -u origin master
```

---

## 5. Neon PostgreSQL Database Setup

### Step 5.1: Create a Project in Neon
1. Log in to [Neon Console](https://console.neon.tech).
2. Click **New Project**.
3. Name your project: `mealrelay-production`.
4. Select Postgres version: **16** or **17/18** (matches current PostgreSQL standards).
5. Choose a region closest to your Render server (e.g., `US East (Ohio)` or `AWS Frankfurt` if using European hosting).
6. Click **Create Project**.

### Step 5.2: Retrieve the Connection String
1. On your Neon Project Dashboard, navigate to the **Connection Details** card.
2. Select database: `neondb` (default) or create a database named `mealrelay`.
3. Select role: `neondb_owner` (or your chosen user).
4. Set the connection toggle to **Pooled connection** (recommended for production Node.js applications with multiple workers).
5. Copy the connection string. It will look similar to:
   ```text
   postgresql://mealrelay_user:SECRET_PASSWORD@ep-sample-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
6. **Important**: Ensure `?sslmode=require` is present at the end of the URL. Neon requires TLS encryption for all incoming connections.

---

## 6. Render Backend Deployment

### Step 6.1: Create a Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Select **Build and deploy from a Git repository**.
4. Connect your GitHub account and select repository: `Sudarshan25092007/MealRelay`.
5. Configure the service settings:

| Setting | Value | Rationale |
| :--- | :--- | :--- |
| **Name** | `mealrelay-api` | Identifies your backend service URL (`https://mealrelay-api.onrender.com`). |
| **Region** | Same region as Neon (e.g. `Ohio, USA`) | Minimizes database query latency. |
| **Branch** | `master` (or `main`) | The branch containing production code. |
| **Root Directory** | `server` | **Critical**: Points Render to the Express project directory. |
| **Runtime** | `Node` | Standard Node.js LTS environment. |
| **Build Command** | `npm install && npx prisma generate && npx prisma migrate deploy` | Installs dependencies, generates the Prisma client, and applies migrations before start. |
| **Start Command** | `npm start` | Executes `node src/server.js`. |
| **Plan Type** | `Free` (or `Starter` for production) | Free tier available. |

### Step 6.2: Configure Render Environment Variables
Under the **Environment Variables** section of your new Web Service, add:

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production error suppression and security headers. |
| `DATABASE_URL` | `postgresql://user:pass@ep-pooler.neon.tech/neondb?sslmode=require` | Your Neon pooled connection string. |
| `JWT_SECRET` | *(Random 64-char string)* | Strong cryptographic key. Generate via `openssl rand -hex 32`. |
| `JWT_EXPIRES_IN` | `7d` | Token expiration period. |
| `CLIENT_URL` | `https://meal-relay.vercel.app` | Your Vercel frontend URL (without trailing slash). |

> **Note on PORT:** Render automatically injects the `PORT` environment variable and routes web traffic to it. MealRelay reads `config.port` from `process.env.PORT` and binds to `0.0.0.0`, fulfilling Render's networking requirements.

### Step 6.3: Health Check Path
In Render **Advanced Settings**:
- Set **Health Check Path** to: `/api/health`.
- Render will ping `/api/health` during deployments to confirm that Express is running and database connectivity is verified before directing live traffic.

### Step 6.4: Initial Admin Provisioning (One-Time)
Because `server/prisma/seed.js` purposefully aborts when `NODE_ENV === 'production'` to protect real users, create your initial administrative account through the Render **Shell** tab once the service is live:

```bash
# In the Render Web Service Shell:
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createAdmin() {
  const hash = await bcrypt.hash('ReplaceWithAStrongAdminPassword123!', 10);
  const org = await prisma.organization.create({
    data: {
      name: 'MealRelay Operational Hub',
      type: 'NGO',
      approvalStatus: 'APPROVED',
      address: '1 Operational Way',
      locality: 'Central Hub'
    }
  });
  const user = await prisma.user.create({
    data: {
      name: 'Platform Administrator',
      email: 'admin@yourdomain.com',
      passwordHash: hash,
      role: 'ADMIN'
    }
  });
  await prisma.organizationMember.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      membershipRole: 'OWNER'
    }
  });
  console.log('Production Admin account created successfully!');
  await prisma.\$disconnect();
}
createAdmin().catch(console.error);
"
```

---

## 7. Vercel Frontend Deployment

### Step 7.1: Import Project in Vercel
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository: `Sudarshan25092007/MealRelay`.
4. Configure the project:

| Setting | Value | Rationale |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Vercel detects Vite automatically. |
| **Root Directory** | `client` | **Critical**: Tells Vercel that frontend code lives in `client/`. |
| **Build Command** | `npm run build` (or default `vite build`) | Builds output to `client/dist`. |
| **Output Directory** | `dist` | Default Vite distribution directory. |
| **Install Command** | `npm install` | Installs frontend dependencies. |

### Step 7.2: Configure Frontend Environment Variables
Under **Environment Variables**, add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://mealrelay.onrender.com/api` | The public base URL of your deployed Render backend (with `/api`). |

> **Important:** Do NOT add `DATABASE_URL` or `JWT_SECRET` in Vercel! Frontend environment variables are public and bundled directly into client JavaScript.

### Step 7.3: Deploy
Click **Deploy**. Vercel will clone the repository, install dependencies, run `vite build`, and publish your app to a `*.vercel.app` domain.

---

## 8. Frontend/Backend Connection & CORS Verification

Once both Vercel and Render are deployed:

1. Copy your assigned Vercel URL (`https://meal-relay.vercel.app`).
2. Go to your **Render Dashboard** -> `mealrelay` -> **Environment Variables**.
3. Update `CLIENT_URL` to match your exact Vercel URL without a trailing slash:
   ```text
   CLIENT_URL=https://meal-relay.vercel.app
   ```
4. If you use custom domains or preview deployments, provide comma-separated values:
   ```text
   CLIENT_URL=https://meal-relay.vercel.app,https://www.mealrelay.org
   ```
5. Click **Save Changes**. Render will automatically trigger a rolling redeployment with the updated CORS configuration.

---

## 9. Production Verification Checklist

Follow this end-to-end verification checklist against your live deployment:

- [ ] **1. Service & Health Verification**: Open `https://mealrelay.onrender.com/api/health` in a browser. Confirm response:
  ```json
  { "status": "ok", "service": "MealRelay API", "database": "connected" }
  ```
- [ ] **2. Frontend Load & Routing**: Visit `https://your-vercel-url.vercel.app`. Verify the home page displays the browse feed, search filters, and clean product branding.
- [ ] **3. SPA Refresh Test**: Navigate to `/dashboard` or any sub-route, and press `Ctrl+F5` (Hard Reload). Verify that `client/vercel.json` serves the page without a 404 error.
- [ ] **4. Donor Registration & Approval Gate**:
  - Register a new organization with type **Food Donor**.
  - Log in. Verify that the welcome banner shows `PENDING` approval status.
  - Verify that the `+ Post Surplus` button is disabled or hidden, and that attempt to post surplus is rejected.
- [ ] **5. Admin Console & Approval Workflow**:
  - Log in as the administrator created in Step 6.4.
  - Click **Admin Console** in the top navigation bar.
  - Locate the newly registered donor under the **Pending Review** tab.
  - Click **Approve**. Confirm status badge updates to `APPROVED`.
- [ ] **6. Surplus Food Publishing**:
  - Log back in as the approved Food Donor.
  - Click **Post Surplus**. Create a food offer with title, quantity, vegetarian/non-veg type, preparation time, pickup deadline (+4 hours), and consume-by limit.
  - Verify the donation appears in **My Postings** with status `OPEN`.
- [ ] **7. NGO Registration & Claim**:
  - In an incognito window, register an **NGO / Shelter** organization.
  - Use the Admin Console to approve the NGO.
  - As the approved NGO, browse the feed, select the donor's surplus offer, and click **Claim Surplus Batch**.
  - Verify instant reservation confirmation. Verify that attempting to claim a second time produces an already-claimed conflict message.
- [ ] **8. Handover Verification Handshake**:
  - As the owning Donor, open the claimed donation details. Click **Reveal Verification Code** to view the 6-digit code.
  - In the NGO session, enter the 6-digit code in the **Complete Pickup at Collection** field.
  - Confirm successful completion. Status updates to `COMPLETED`.
  - Try submitting the code again: verify it is rejected with a 409 conflict (single-use enforcement).
- [ ] **9. Explicit Cancellation & Expiry**:
  - Create a second donation as the donor. Cancel it and specify a cancellation reason. Verify status transitions to `CANCELLED` and audit event logs reason.
- [ ] **10. Audit History Timeline**:
  - Open any completed or cancelled donation as an authorized participant.
  - Verify the timeline displays all recorded actions (`DONATION_CREATED`, `DONATION_CLAIMED`, `DONATION_COMPLETED`) without exposing secret hashes.

---

## 10. Common Failures & Remediation

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **CORS error in browser console** (`No 'Access-Control-Allow-Origin' header`) | Render's `CLIENT_URL` does not match the Vercel domain, or has a trailing slash. | In Render Environment Variables, set `CLIENT_URL` to your exact Vercel URL (e.g. `https://mealrelay.vercel.app` without `/`). |
| **Prisma client missing** (`Cannot find module '@prisma/client'`) | Prisma client was not generated during deployment build. | Ensure Render Build Command is `npm install && npx prisma generate && npx prisma migrate deploy`. `server/package.json` includes `"postinstall": "prisma generate"`. |
| **Database connection error** (`Can't reach database server at ...`) | Neon database has gone to sleep, SSL is missing, or IP is blocked. | Verify connection string includes `?sslmode=require`. Ensure pooled connection string is used. |
| **Frontend calls `http://localhost:5000`** | `VITE_API_BASE_URL` was not configured in Vercel before building. | In Vercel Project Settings -> Environment Variables, add `VITE_API_BASE_URL` pointing to your Render backend `/api`. **Trigger a new deployment** (Vite bundles variables at build time). |
| **Direct URL refresh returns 404 on Vercel** | Missing Single Page Application rewrite rules. | Verify `client/vercel.json` exists with the `rewrites` configuration to `/index.html`. |
| **First request is slow (50-60 seconds)** | Render free tier web service spins down after 15 minutes of inactivity. | Expected behavior on Render free tier. Subsequent requests are fast. Upgrade to Render Starter ($7/mo) to eliminate cold starts. |
| **Database migration failed** (`P3009: migrate found failed migrations`) | Schema was modified manually or migration order was corrupted. | Run `npx prisma migrate status` to view state. Do not edit applied migration files. |

---

## 11. Security Checklist

- [x] **No Version-Controlled Secrets**: `.env`, `.env.test`, `.env.local`, and private keys are ignored by Git.
- [x] **Password Protection**: User passwords hashed with `bcryptjs` (salt rounds: 10). Plaintext passwords never stored.
- [x] **Cryptographic Codes**: Handover codes derived using HMAC-SHA256. Only SHA-256 hash stored in database. Timing-safe comparison prevents timing attacks. Locked after 5 failed attempts.
- [x] **Protected Admin Roles**: Normal users cannot self-promote to `ADMIN` through registration or request payloads.
- [x] **Production Seed Protection**: `server/prisma/seed.js` checks `if (process.env.NODE_ENV === 'production') return;` to prevent demo accounts from overwriting live data.
- [x] **Security Headers**: Standard headers active on all Express responses (`nosniff`, `DENY` clickjacking protection, XSS protection, `strict-origin-when-cross-origin`, and HSTS).
- [x] **Rate Limiting**: Auth endpoints throttled to 30 requests/15m; general API throttled to 300 requests/15m.
- [x] **Zero Stack Trace Leaks**: Express error middleware returns controlled error messages in production.

---

## 12. Maintenance, Logs & Continuous Delivery

### Continuous Deployment via GitHub
- Any commit pushed to the `master` branch triggers automatic deployments on both **Vercel** and **Render**.
- To deploy a bug fix or feature:
  ```bash
  git add .
  git commit -m "fix: description of fix"
  git push origin master
  ```

### Inspecting Live Logs
- **Backend Logs**: Open your [Render Dashboard](https://dashboard.render.com) -> `mealrelay-api` -> **Logs**. Monitor real-time request logs, health checks, and cron worker ticks.
- **Frontend Logs**: Open your [Vercel Dashboard](https://vercel.com) -> `mealrelay` -> **Deployments** -> select active deployment -> **Build Logs** or **Runtime Logs**.

### Applying New Database Schema Changes
1. Modify `server/prisma/schema.prisma` locally.
2. Generate migration locally: `npm --prefix server run prisma:migrate`
3. Commit the new migration directory under `server/prisma/migrations/`.
4. Push to GitHub:
   ```bash
   git add server/prisma/
   git commit -m "feat: add field to schema"
   git push origin master
   ```
5. Render's build command automatically executes `npx prisma migrate deploy` before launching the new code.

---

## 13. Free Tier Costs & Limitations

MealRelay can be deployed using the free tiers of Neon, Render, and Vercel. However, note provider-specific policies:

| Service | Free Tier Capabilities | Known Limitations |
| :--- | :--- | :--- |
| **Neon** | 0.5 GB storage, serverless autoscaling, pooled connections. | Computes sleep after 5 minutes of zero traffic. Resumes automatically on next connection (<1 second). |
| **Render** | 512 MB RAM, shared CPU, free web service. | Spins down after 15 minutes of inactivity; takes ~50s to wake up on first request. Free outbound bandwidth limits apply. |
| **Vercel** | 100 GB bandwidth, global CDN, automated SSL. | Non-commercial Hobby terms apply. Limited to personal use and testing. |
| **GitHub** | Unlimited public/private repositories, GitHub Actions included. | Subject to standard account usage limits. |

*Note: Free-tier policies and terms are determined by the respective service providers and may change over time.*

---

## 14. Official Documentation References

- [Vercel Documentation (Vite Deployment)](https://vercel.com/docs/frameworks/vite)
- [Render Documentation (Node.js & Express)](https://docs.render.com/web-services)
- [Neon Documentation (Prisma with Neon)](https://neon.tech/docs/guides/prisma)
- [Prisma Documentation (Prisma Migrate Deploy)](https://www.prisma.io/docs/concepts/components/prisma-migrate/production-troubleshooting)
- [Vite Documentation (Building for Production)](https://vite.dev/guide/build.html)
- [GitHub Documentation (Managing Remotes)](https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories)

---

## 15. Final Quick-Start Release Checklist

From an untouched clone of the repository:

```bash
# 1. Clone repository
git clone https://github.com/Sudarshan25092007/MealRelay.git
cd MealRelay

# 2. Local verification
npm install && npm --prefix server install && npm --prefix client install
npm run test
npm run build

# 3. Create Neon database -> copy pooled connection string with ?sslmode=require

# 4. Deploy Render Web Service:
#    - Root Directory: server
#    - Build Command: npm install && npx prisma generate && npx prisma migrate deploy
#    - Start Command: npm start
#    - Add ENV: NODE_ENV, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_URL

# 5. Deploy Vercel Project:
#    - Root Directory: client
#    - Framework: Vite
#    - Add ENV: VITE_API_BASE_URL (points to Render URL + /api)

# 6. Update Render CLIENT_URL with your Vercel URL -> Save

# 7. Visit Vercel domain -> Verify /api/health -> Complete manual checklist
```
