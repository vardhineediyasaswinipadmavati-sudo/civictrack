# CivicTrack — Infrastructure Lifecycle Management System

**CivicTrack** is an enterprise-grade Full Stack Development (FSD-2) platform bridging municipal grievance reporting and engineering asset lifecycle management.

Rather than treating citizen complaints as ephemeral, disposable tickets, CivicTrack:
- **Consolidates duplicate community reports** into a unified **Master Civic Issue** while preserving every citizen's original report, exact GPS coordinates, evidence photographs, and timestamp.
- **Maintains longitudinal infrastructure degradation histories** for road segments, water pipelines, streetlights, stormwater drains, and civic assets.
- **Tracks Temporary vs. Permanent repair outcomes** and calculates recurring failure frequencies (Mean Time Between Failures - MTBF).
- **Diagnoses Maintenance-Waste** from repetitive short-term patching versus capital replacement.
- **Predicts infrastructure risk** with a transparent, rule-based explainability score and visualizes condition via an interactive **GIS Infrastructure Health Map**.
- **Detects seasonal stress patterns** (monsoon drainage flooding, summer thermal pipe surges) to guide pre-emptive maintenance.

---

## Upgraded Architecture & FSD-2 Alignment

CivicTrack was upgraded from a file-based SQLite database to an enterprise **MongoDB Atlas + Mongoose ODM** architecture:

```text
React 18 + TypeScript + Vite
Tailwind CSS • Lucide Icons • Leaflet GIS • Recharts
                    |
               HTTPS / REST API
                    |
          Node.js + Express.js API
          Helmet CSP • Strict CORS
          JWT Authentication
             /           \
      Cloudinary       Mongoose ODM
          |                 |
    Image Storage      MongoDB Atlas
                       14 Collections
```

### Why MongoDB Atlas & Mongoose?

1. **Curriculum Alignment:** Directly fulfills the FSD-2 syllabus requiring NoSQL database design, schema validation, and Mongoose ODM modeling.
2. **Horizontal Scalability & Cloud Native:** Hosted on MongoDB Atlas with cloud clustering, automated failover, and connection pooling.
3. **Compound Indexing & Geospatial Queries:** Supports compound indexes for deduplication and spatial indexing.
4. **Idempotent Data Migration:** An enterprise-grade migration script (`server/src/db/migrateSqliteToMongo.js`) converts relational tables into Mongoose documents with preserved `legacy_id` references and zero record duplication on reruns.

---

## Mongoose Data Models & Relationships

CivicTrack defines 14 interconnected Mongoose models in `server/src/models/`:

| Model | Collection | Primary Responsibility |
|---|---|---|
| `Department` | `departments` | Municipal departments and contact information. |
| `User` | `users` | Accounts with citizen, staff, and admin roles. |
| `InfrastructureAsset` | `infrastructure_assets` | Public assets with GIS coordinates, condition, MTBF, and risk scores. |
| `SharedIssue` | `shared_issues` | Master civic issues grouping community reports. |
| `CitizenReport` | `citizen_reports` | Original citizen reports, GPS location, and address. |
| `ReportImage` | `report_images` | Photographic evidence records and image URLs. |
| `InfrastructureIncident` | `infrastructure_incidents` | Historical incidents associated with assets. |
| `RepairRecord` | `repair_records` | Temporary and permanent repair records, costs, and photos. |
| `StatusHistory` | `status_histories` | Audit trail of issue status transitions. |
| `CitizenVerification` | `citizen_verifications` | Citizen feedback on repair effectiveness. |
| `IssueFollow` | `issue_follows` | Citizen subscriptions to issue alerts. |
| `Notification` | `notifications` | In-app status and assignment alerts. |
| `AuditLog` | `audit_logs` | Administrator action history. |
| `PasswordReset` | `password_resets` | Secure password-reset tokens with expiry and single-use enforcement. |

---

## Cloudinary Permanent Image Storage

CivicTrack uses the official Cloudinary SDK for citizen complaint photos and staff repair evidence.

- **Production Workflow:**
  1. Citizen or staff uploads an image through `/api/reports/upload-image`.
  2. Multer holds the image in memory with a 5MB size limit and MIME-type validation.
  3. The image buffer is streamed to Cloudinary.
  4. The permanent HTTPS CDN URL is saved to MongoDB.

- **Local Development Fallback:**

  If Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) are not set, CivicTrack falls back to local storage in `server/data/uploads/` and serves files under `/uploads/`.

---

## Security Hardening

1. **Helmet & Content Security Policy (CSP):** Protects against XSS and clickjacking.
2. **CORS Protection:** Explicit origin whitelist enforcing `process.env.APP_URL` and permitted localhost development origins.
3. **Rate Limiting:**
   - Global API limiter: 300 requests per 15 minutes.
   - Authentication limiter: 30 requests per 15 minutes.
   - Upload limiter: 40 uploads per 15 minutes.
4. **JWT Security:** Production startup fails if `JWT_SECRET` is missing, empty, or using the default development fallback.
5. **Environment-Gated Demo Credentials:** Quick-fill demo account buttons are visible only in development mode or when explicitly enabled with `VITE_ALLOW_DEMO=true`.

---

## Environment Variables

Create a `.env` file in the project root or in the `server/` directory.

| Variable | Required in Production? | Default / Example | Purpose |
|---|---|---|---|
| `PORT` | No | `5000` | Port for the Express server. |
| `NODE_ENV` | Yes | `production` | Node environment. |
| `MONGODB_URI` | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/civictrack` | MongoDB Atlas connection string. |
| `MONGODB_TEST_URI` | No | `mongodb://localhost:27017/civictrack_test` | Dedicated test database. |
| `JWT_SECRET` | Yes | Must be a 32+ character random string | Secret key for JWT authentication. |
| `APP_URL` | Yes | `https://civictrack-7gf8.onrender.com` | Application URL for password-reset links and CORS. |
| `CLOUDINARY_CLOUD_NAME` | Yes | `your_cloud_name` | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | Yes | `your_api_key` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Yes | `your_api_secret` | Cloudinary API secret. |
| `SMTP_HOST` | Recommended | `smtp.sendgrid.net` | Outgoing SMTP server. |
| `SMTP_PORT` | Recommended | `587` | SMTP server port. |
| `SMTP_USER` | Recommended | `apikey` | SMTP username. |
| `SMTP_PASS` | Recommended | `your_smtp_password` | SMTP password. |
| `SMTP_FROM` | No | `CivicTrack <noreply@civictrack.org>` | Sender address. |
| `INITIAL_ADMIN_EMAIL` | No | `admin@civictrack.org` | Initial administrator email. |
| `INITIAL_ADMIN_PASSWORD` | No | `change_this_to_a_secure_password` | Initial administrator password. |
| `ALLOW_DEMO_ACCOUNTS` | No | `false` | Controls backend demo seed authorization. |

---

## Local Development Setup

### 1. Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **MongoDB:** Local MongoDB instance or MongoDB Atlas connection string.

### 2. Install Dependencies

Run from the root directory:

```bash
npm install
```

This installs root dependencies and dependencies for both `server/` and `client/`.

### 3. Configure Environment

Copy `.env.example` to `server/.env`:

```bash
cp .env.example server/.env
```

Set your `MONGODB_URI` and `JWT_SECRET`.

### 4. Seed the Database

```bash
npm run seed
```

This populates departments, infrastructure assets, historical failures, repairs, and linked citizen reports.

### 5. Run Automated Tests

```bash
npm test
```

The test suites run in isolation using `mockingoose` and Node's native `node:test` runner.

### 6. Start Development Servers

Run the backend and frontend in separate terminals:

```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000`

---

## Render Deployment Guide

CivicTrack is configured for deployment on Render.

### Web Service Settings

1. **Environment:** Node
2. **Build Command:**

   ```bash
   npm install && npm run build
   ```

3. **Start Command:**

   ```bash
   npm start
   ```

### Required Environment Variables on Render

Configure these in the Render Dashboard under **Environment**:

- `NODE_ENV`: `production`
- `MONGODB_URI`: Your MongoDB Atlas connection string.
- `JWT_SECRET`: A long, secure random string.
- `APP_URL`: `https://civictrack-7gf8.onrender.com`
- `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name.
- `CLOUDINARY_API_KEY`: Your Cloudinary API key.
- `CLOUDINARY_API_SECRET`: Your Cloudinary API secret.
- `SMTP_HOST`: SMTP server, if configured.
- `SMTP_PORT`: `587`
- `SMTP_USER`: SMTP username, if configured.
- `SMTP_PASS`: SMTP password, if configured.
- `SMTP_FROM`: Sender email address.

---

## SQLite to MongoDB Migration (Idempotent)

To migrate an existing SQLite database (`server/data/civictrack.sqlite`) to MongoDB Atlas:

```bash
npm run migrate:mongo
```

### Migration Safety & Idempotency Guarantees

- **Original Database Untouched:** Reads directly from SQLite via WebAssembly (`sql.js`) without modifying or truncating the file.
- **Idempotent Migration:** Collections check for existing records using `legacy_id` or unique keys. Re-running the script avoids duplicate records.
- **Password Reset Invalidation:** Active legacy password-reset tokens are expired during migration for security.
- **Relationship Integrity:** Preserves and maps legacy foreign keys to MongoDB `ObjectId` references.

---

## REST API Reference

| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new citizen account | Public |
| `POST` | `/api/auth/login` | Authenticate user and return JWT token | Public |
| `POST` | `/api/auth/forgot-password` | Request password reset email | Public |
| `POST` | `/api/auth/reset-password` | Reset account password with token | Public |
| `GET` | `/api/auth/me` | Fetch active user profile and unread alerts | Authenticated |
| `POST` | `/api/reports/check-duplicate` | Check nearby duplicates before submission | Authenticated |
| `POST` | `/api/reports` | Submit citizen report | Authenticated |
| `GET` | `/api/reports` | List citizen reports | Authenticated |
| `GET` | `/api/reports/:id` | Fetch single report details | Authenticated |
| `POST` | `/api/reports/upload-image` | Upload photographic evidence | Authenticated |
| `GET` | `/api/issues` | List master civic issues | Public |
| `GET` | `/api/issues/nearby` | Find master issues within GPS radius | Public |
| `GET` | `/api/issues/:id` | Get master issue details and history | Public |
| `PATCH` | `/api/issues/:id/status` | Update issue status | Staff / Admin |
| `POST` | `/api/issues/:id/assign` | Assign issue to department | Admin |
| `POST` | `/api/issues/:id/reopen` | Reopen resolved issue | Authenticated |
| `POST` | `/api/issues/:id/verify-resolution` | Record citizen feedback | Authenticated |
| `POST` | `/api/issues/:id/follow` | Toggle subscription to issue alerts | Authenticated |
| `POST` | `/api/issues/:id/merge` | Merge two master issues | Admin Only |
| `POST` | `/api/issues/:id/separate` | Separate misclassified report | Admin Only |
| `GET` | `/api/infrastructure` | List infrastructure assets with health and risk | Public |
| `GET` | `/api/infrastructure/:id` | Asset failure profile, MTBF, and timeline | Public |
| `POST` | `/api/infrastructure/:id/repairs` | Log repair details | Staff / Admin |
| `GET` | `/api/analytics/overview` | KPI overview | Public |
| `GET` | `/api/analytics/repair-effectiveness` | Repeat incident and repair metrics | Public |
| `GET` | `/api/analytics/maintenance-waste` | Maintenance expenditure and audit flags | Public |
| `GET` | `/api/analytics/seasonal-trends` | Monthly incident trends | Public |
| `GET` | `/api/analytics/department-performance` | Department resolution times and SLA | Public |

---

## License

Developed as an academic Full Stack Development (FSD-2) capstone project. Open source under the MIT License.
