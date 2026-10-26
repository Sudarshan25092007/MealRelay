# MealRelay — Surplus Food Recovery & Distribution Coordination Platform

> **Phase 1: Project Foundation & Backend Core**  
> Target Completion Deadline: October 27, 2026, 11:59 PM IST

---

## 1. Project Overview & Problem Statement

Millions of tons of edible, freshly prepared food from cafeterias, restaurants, messes, and event caterers are discarded daily due to a lack of immediate coordination with community organizations that can redistribute it safely. 

**MealRelay** bridges this gap as a surplus-food recovery and distribution coordination platform. Food donors publish time-limited, verifiable offers of surplus food with explicit preparation times, pickup deadlines, and consumption expiration limits. Approved NGOs and community relief shelters discover, claim, and pick up donations before the food expires.

---

## 2. Target Users

1. **Food Donors**: Restaurants, university messes, corporate cafeterias, and catering services publishing surplus meals with strict time-sensitivity.
2. **Community Relief Organizations (NGOs)**: Verified shelters, food banks, and charitable distribution networks that collect and redistribute food.
3. **Platform Administrators**: Superusers reviewing organization authenticity, monitoring compliance, and auditing critical events.

---

## 3. Phase 1 Scope & Features Implemented

Phase 1 establishes the production architecture, database layer, authentication system, and core donation workflows:

- **Entity Model & Relational Schema**: 6 core PostgreSQL models (`User`, `Organization`, `OrganizationMember`, `Donation`, `PickupVerification`, `AuditEvent`) with strict check constraints, foreign keys, cascading rules, and composite indexes.
- **Role-Based Authentication & Authorization**:
  - Secure registration for Donors and NGOs.
  - Password hashing with `bcrypt` (10 rounds).
  - Signed JSON Web Tokens (JWT) with configurable expiration.
  - Organization verification middleware preventing unapproved donors from publishing offers.
  - Strict prevention of privilege escalation (public registration cannot create `ADMIN` accounts).
- **Core Donation Lifecycle (Creation, Discovery, Details, Editing)**:
  - `POST /api/donations`: Validates required fields, units, food types, and chronological integrity (`preparedAt <= pickupDeadline <= consumeBy`, with pickup in the future).
  - `GET /api/donations`: Multi-tenant filtering (locality, food category, status, ownership) and pagination (`page`, `limit`).
  - `GET /api/donations/:id`: Safe exposure of details and audit history with access control for private/closed donations.
  - `PATCH /api/donations/:id`: Safe update of OPEN donations by the owning donor only, guarding against tampering with organization ownership or status.
- **Audit Logging System**: Automatic immutable database records for critical actions (`USER_REGISTERED`, `DONATION_CREATED`, `DONATION_UPDATED`).
- **Resilient Error Handling**: Centralized error middleware returning structured JSON error contracts without exposing stack traces, internal SQL errors, or sensitive database credentials.
- **Frontend Application Shell**:
  - React + Vite + Tailwind CSS with a clean, responsive green-and-white theme.
  - Live API integration with bearer-token session persistence.
  - Real-time donation discovery feed, custom filter bar, and pagination.
  - Dynamic donation creation form with datetime validation.
  - Detailed donation view with countdowns, donor verification, and audit logs.
  - 1-click Quick-Fill demo accounts on the login page for rapid review.

---

## 4. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Lucide Icons |
| **Backend** | Node.js (ESM), Express 4 |
| **Database & ORM** | PostgreSQL 18, Prisma 5.22.0 |
| **Validation** | Zod 3.24.1 |
| **Authentication** | bcryptjs, jsonwebtoken |
| **Testing** | Vitest 2.1.8, Supertest 7.0.0 |
| **Architecture** | Modular Monolith (separate `client/` and `server/` packages) |

---

## 5. System Architecture & Directory Structure

```text
MealRelay/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── api/                # Centralized fetch API client
│   │   ├── components/         # Navbar, DonationCard, FilterBar, Pagination, Modals
│   │   ├── context/            # AuthContext (user, organization, token)
│   │   ├── pages/              # Browse, Detail, Create, Login, Register, Dashboard
│   │   ├── App.jsx             # Main layout & router shell
│   │   └── index.css           # Tailwind typography & base styles
│   ├── package.json
│   └── vite.config.js
├── server/                     # Node.js + Express Backend
│   ├── prisma/
│   │   ├── migrations/         # Committed SQL migration history
│   │   ├── schema.prisma       # Prisma schema with 6 entities
│   │   └── seed.js             # Development demo accounts & sample donations
│   ├── src/
│   │   ├── config/             # Environment & Prisma client instances
│   │   ├── middleware/         # Auth, Authorization, Error, NotFound, RateLimiter, Validator
│   │   ├── modules/
│   │   │   ├── audit/          # Audit logging service
│   │   │   ├── auth/           # Registration, login, session endpoints
│   │   │   ├── donations/      # Creation, listing, details, update endpoints
│   │   │   └── organizations/  # Organization inspection & admin approval
│   │   ├── utils/              # Custom errors, JWT, bcrypt helpers
│   │   ├── app.js              # Express app definition & route registry
│   │   └── server.js           # Server listen & graceful shutdown handlers
│   ├── tests/                  # Automated Vitest integration tests
│   ├── package.json
│   └── vitest.config.js
├── package.json                # Root development orchestration
├── README.md                   # Complete documentation
└── .gitignore                  # Environment, build, and credentials exclusions
```

---

## 6. Database Entities & Relationships

```mermaid
erDiagram
    User ||--o{ OrganizationMember : "has"
    Organization ||--o{ OrganizationMember : "includes"
    Organization ||--o{ Donation : "publishes (DONOR)"
    Organization ||--o{ Donation : "claims (NGO)"
    Donation ||--o| PickupVerification : "verifies"
    Donation ||--o{ AuditEvent : "logs"
    User ||--o{ AuditEvent : "actors"

    User {
        string id PK
        string name
        string email UK
        string passwordHash
        UserRole role
        datetime createdAt
    }

    Organization {
        string id PK
        string name
        OrganizationType type
        ApprovalStatus approvalStatus
        string address
        string locality
    }

    OrganizationMember {
        string userId FK
        string organizationId FK
        string membershipRole
    }

    Donation {
        string id PK
        string donorOrganizationId FK
        string claimedByOrganizationId FK
        string title
        string description
        float quantity
        string unit
        FoodType foodType
        datetime preparedAt
        datetime pickupDeadline
        datetime consumeBy
        DonationStatus status
    }

    PickupVerification {
        string id PK
        string donationId FK, UK
        string codeHash
        datetime expiresAt
        datetime verifiedAt
    }

    AuditEvent {
        string id PK
        string actorUserId FK
        string donationId FK
        string action
        DonationStatus previousStatus
        DonationStatus newStatus
        jsonb metadata
        datetime createdAt
    }
```

### Database Constraints & Indexes

- **Check Constraints** (Committed in SQL migration `20261026170358_check_constraints`):
  - `chk_donation_quantity_positive`: `quantity > 0`
  - `chk_donation_timestamps`: `preparedAt <= consumeBy AND pickupDeadline <= consumeBy`
- **Composite Indexes**:
  - `Donation(status, pickupDeadline)`
  - `Donation(status, donorOrganizationId)`
  - `OrganizationMember(userId, organizationId)` (Unique)

---

## 7. Environment Variables

### Root / Server (`server/.env`)

```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/mealrelay?schema=public"
TEST_DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/mealrelay_test?schema=public"
JWT_SECRET="dev-mealrelay-jwt-secret-key-32chars-minimum-needed!"
JWT_EXPIRES_IN="7d"
CLIENT_URL="http://localhost:5173"
```

### Frontend Client (`client/.env`)

```env
VITE_API_BASE_URL="http://localhost:5000/api"
```

> **Security Note**: Never commit `.env` or files containing database passwords or JWT secrets. Templates are provided in `.env.example`.

---

## 8. Local Setup & Execution Guide

### Prerequisites

- **Node.js**: `v20.x` or later (tested on Node v25.0.0)
- **PostgreSQL**: PostgreSQL 14+ installed and running locally on port 5432

### Step 1: Install Dependencies

```bash
# Install root workspace dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
cd ..
```

### Step 2: Database Setup & Migrations

```bash
# Run migrations on development database
npm run migrate

# Seed development demo accounts and sample donations
npm run seed
```

### Step 3: Start the Application

You can start both backend and frontend concurrently from the root:

```bash
npm run dev
```

Or run them individually:

```bash
# Terminal 1: Backend API (port 5000)
cd server && npm run dev

# Terminal 2: Frontend Web App (port 5173)
cd client && npm run dev
```

Open your browser to: **`http://localhost:5173`**

---

## 9. Development Demo Accounts

The database seed provides 4 ready-to-use demo accounts (also accessible via 1-click login on the web app):

| Account Type | Email | Password | Organization | Status |
|---|---|---|---|---|
| **Approved Donor** | `donor@demo.org` | `DemoPass123!` | Green Bites Cafe & Mess | `APPROVED` |
| **Approved NGO** | `ngo@demo.org` | `DemoPass123!` | Community Harvest Trust | `APPROVED` |
| **Pending NGO** | `pending.ngo@demo.org` | `DemoPass123!` | Hope Shelter Network | `PENDING` |
| **Administrator** | `admin@demo.org` | `DemoPass123!` | MealRelay Operations Hub | `APPROVED` |

---

## 10. Automated Testing

The automated test suite runs against the dedicated `mealrelay_test` PostgreSQL database using **Vitest** and **Supertest**.

```bash
# Run tests from the project root
npm run test

# Or run directly inside the server folder
cd server && npm run test
```

### Test Coverage Summary

- [x] **Test 1**: Health endpoint succeeds (`/api/health`) and verifies PostgreSQL connectivity.
- [x] **Test 2**: Registration creates a user with a `bcrypt` password hash, not plaintext.
- [x] **Test 3**: Duplicate email registration is rejected with HTTP 409 Conflict.
- [x] **Test 4**: Public registration cannot create an `ADMIN` account.
- [x] **Test 5**: Login succeeds with valid credentials and returns safe fields.
- [x] **Test 6**: Login fails with invalid credentials (HTTP 401).
- [x] **Test 7**: Unauthenticated donation creation is rejected (HTTP 401).
- [x] **Test 8**: Non-donor (e.g. NGO) cannot publish donations (HTTP 403).
- [x] **Test 9**: Invalid quantity (<= 0) and invalid timestamps are rejected (HTTP 400).
- [x] **Test 10**: Approved donor can create an OPEN donation and creates an audit event.
- [x] **Test 11**: Cross-tenant isolation: A user cannot modify another organization's donation (HTTP 403).
- [x] **Test 12**: Unauthorized users cannot view private, closed donation records (HTTP 403).
- [x] **Test 13**: Server-side pagination, locality filtering, and category filtering work correctly.
- [x] **Test 14**: Malformed JSON produces a controlled HTTP 400 error response (`INVALID_JSON`).
- [x] **Test 15**: Owning donor can update OPEN donation details with audit tracking.

---

## 11. API Endpoint Reference

### Health & Diagnostics
- `GET /api/health` — Service uptime, timestamp, and database status check.

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new user and associated organization (`DONOR` or `NGO`).
- `POST /api/auth/login` — Authenticate and receive a JWT.
- `GET /api/auth/me` — Retrieve current authenticated user and organization profile.

### Donations (`/api/donations`)
- `POST /api/donations` — Create a new surplus food offer (Approved Donors only).
- `GET /api/donations` — Browse open donations with pagination and filters (`page`, `limit`, `locality`, `foodType`, `my`).
- `GET /api/donations/:id` — View complete donation details and audit log summary.
- `PATCH /api/donations/:id` — Edit an OPEN donation (Owning Donor only).

### Organizations (`/api/organizations`)
- `GET /api/organizations/:id` — View public organization profile.
- `PATCH /api/organizations/:id/approval` — Update organization approval status (`ADMIN` only).

---

## 12. Security Architecture

1. **Password Hashing**: Utilizes `bcryptjs` with salt rounds = 10. Passwords are never stored or logged.
2. **Data Minimization**: Password hashes and secret tokens are stripped from all API outputs via Prisma select statements and response transformers.
3. **Privilege Isolation**: Client-supplied role parameters are strictly disregarded during public registration. Organization IDs are verified server-side through membership relations rather than untrusted request headers.
4. **Rate Limiting**: Authentication endpoints are protected against brute-force attacks using `express-rate-limit`.
5. **Request Sanitization**: All request bodies and queries are validated against strict Zod schemas before hitting business logic.
6. **SQL Injection Protection**: Fully parameterized queries via Prisma ORM.

---

## 13. Features Deferred to Phase 2

As planned for Phase 2:
- Atomic donation claiming workflow for approved NGOs (`POST /api/donations/:id/claim`).
- Secure Pickup Verification via cryptographically generated 6-digit codes (`codeHash`).
- Automated scheduled background worker for expiring overdue donations (`EXPIRED` transition).
- Complete NGO claiming history dashboard and receipt generation.
- Full administrative audit inspection timeline.

---

## 14. Deployment Plan

1. **Database**: Managed PostgreSQL instance (e.g. Supabase, Neon, AWS RDS, or Render PostgreSQL).
2. **Backend**: Containerized Node.js service on Render, Railway, or Fly.io with SSL termination.
3. **Frontend**: Static single-page application deployed to Vercel, Netlify, or Cloudflare Pages with environment variable injection (`VITE_API_BASE_URL`).
4. **CI/CD Pipeline**: GitHub Actions running `npm run test` and `npm run build` on every push before automated deployment.
