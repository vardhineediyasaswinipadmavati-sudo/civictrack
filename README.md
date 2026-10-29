# CivicTrack — Infrastructure Lifecycle Management System

**CivicTrack** is an academic Full Stack Development (FSD) capstone platform that bridges the gap between conventional citizen complaint portals and municipal engineering asset management. 

Instead of treating civic grievances as disposable tickets that are closed and forgotten, CivicTrack:
- **Consolidates duplicate community reports** into a single physical **Master Civic Issue** while preserving every citizen's original report, evidence photos, and timestamp.
- **Maintains longitudinal infrastructure degradation histories** for every road segment, luminaire, water pipeline, and stormwater culvert.
- **Tracks Temporary vs. Permanent repair outcomes** and calculates repeat failure rates (Mean Time Between Failures - MTBF).
- **Diagnoses Maintenance-Waste** from repetitive short-term patching versus capital engineering replacement.
- **Predicts infrastructure risk** with a transparent, rule-based explainability score and visualizes condition via an interactive **GIS Infrastructure Health Map**.
- **Detects seasonal stress patterns** (monsoon drainage flooding, summer thermal pipe surges) to guide pre-emptive maintenance.

---

## 🌟 Core Differentiators

| Traditional Complaint Portals | CivicTrack Lifecycle Management System |
|---|---|
| 10 citizens reporting the same pothole creates 10 disconnected work tickets | Consolidates reports into Master Issue `CT-101`, grouping community concern while retaining each citizen's original evidence. |
| Issues marked "Resolved" disappear from institutional memory | Resolved tickets link to an asset profile (e.g. `RD-204`) tracking repeat failures across months and years. |
| No tracking of whether a repair actually held up | Classifies work as **Temporary** vs. **Permanent** and measures recurrence cycles (e.g., cold patch failed in 42 days). |
| Total complaints mistaken for distinct infrastructure failures | Distinguishes **Total Citizen Reports (9)** from **Unique Civic Issues (5)** and **Physical Incidents (4)**. |
| Reactive response to citizen frustration | **Risk Prediction Engine** and **GIS Health Map** identify degrading assets before catastrophic failure. |

---

## 👥 Role-Based Access Control & Demo Accounts

CivicTrack includes 1-click login buttons on the login screen for instant evaluation:

| Role | Demo Email | Password | Primary Capabilities |
|---|---|---|---|
| **Citizen** | `citizen.alice@example.com` | `citizen123` | Submit complaints with Leaflet map pin, receive duplicate suggestions before submission, confirm existing issues, follow master tickets, verify repair effectiveness, reopen returning problems. |
| **Department Staff** | `roads.staff@civictrack.org` | `staff123` | View assigned department work orders, update status, complete repairs with temporary/permanent classification, materials, cost, and before/after photos. |
| **Civic Authority / Admin** | `admin@civictrack.org` | `admin123` | Manage municipal issue inventory, reassign departments, merge duplicate master issues with audit logging, separate misclassified reports, monitor high-risk assets, and review department SLA compliance. |

*(Additional seeded citizens: `citizen.bob@example.com`, `citizen.carol@example.com`, `citizen.david@example.com`, `citizen.elena@example.com` — all password `citizen123`)*

---

## 🛠️ Technology Stack

- **Frontend**:
  - React 18 + TypeScript + Vite
  - Tailwind CSS (Civic Tech Navy/Blue color system)
  - React Router DOM v6 (Role-protected routes)
  - Leaflet & React-Leaflet (GIS Health Map & Map Picker)
  - Recharts (Repair outcome comparisons, maintenance waste, seasonal area charts)
  - Lucide React (Accessible iconography)
- **Backend**:
  - Node.js & Express.js
  - SQLite Relational Database Engine (`sql.js` pure WebAssembly / zero external daemon setup)
  - JWT Authentication + bcryptjs password hashing
  - Multer for photographic evidence storage
  - Native `node:test` automated test suite

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Node.js v18+ (tested on Node v24.20.0)
- npm v9+

### 2. Install Dependencies
```bash
# Install root, server, and client packages
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### 3. Seed Database
Run the demonstration seed script to populate realistic municipal departments, infrastructure assets, historical failure cycles, temporary/permanent repairs, and linked citizen reports:
```bash
npm run seed
```

### 4. Run Automated Test Suite
Verify that all 8 core differentiation tests pass:
```bash
npm test
```
*Tests pass with 100% success across duplicate linking, report data preservation, separation of nearby issues, admin merging audit trails, recurrence sequences, distinct reporting metrics, and role protection.*

### 5. Build & Start Application
```bash
# Build the React frontend
npm run build

# Start the full-stack server (serves API and React client on port 5000)
npm start
```
Open **[http://localhost:5000](http://localhost:5000)** in your web browser.

---

## 📋 Walkthrough of Section 12 Demonstration Scenario

The database comes pre-seeded to showcase the exact 9-step scenario required by the specification:

1. **Independent Citizen Reporting**: Citizens Alice Chen, Bob Miller, Carol Davis, and David Patel independently observe and report a hazardous pothole cluster on Oak Avenue near the bus stop.
2. **Duplicate Detection & Suggestion Screen**: When subsequent citizens submit their complaint, CivicTrack identifies geographic proximity (within 150m) and category match, prompting the user with the **Existing Issue Suggestion Screen**.
3. **Report Linking & Data Preservation**: The citizens confirm the match. All four reports are connected to Master Issue **`CT-101`**, while retaining each citizen's unique description, exact coordinates, and evidence photographs.
4. **Single Consolidated Ticket**: Roads Maintenance lead Marcus Vance receives one consolidated work ticket **`CT-101`** rather than four disjointed complaints.
5. **Synchronized Status Updates**: When status moves to *In Progress*, all 4 citizens receive notifications in their dashboard.
6. **Temporary vs Permanent Repair Tracking**: Marcus Vance logs a quick temporary cold patch ($850). The system flags that the asset received a temporary holding fix.
7. **Recurrence Tracking**: 42 days later, water infiltration re-opens the cavity. A new incident is recorded, automatically advancing the recurrence sequence to 4.
8. **Infrastructure Failure Profile**: Inspecting Asset **`RD-204`** reveals the full history: 3 prior temporary patches totaling $5,350, an average MTBF of 42 days, and a rule-based risk score elevated to **Critical (82/100)**.
9. **Separate Nearby Issues**: Meanwhile, a sunken utility manhole ring at 2750 Oak Ave (**`CT-102`**) located 250m north is recognized as a separate utility casting fault and is **not** merged with the pothole cluster.

---

## 📡 REST API Documentation

| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new citizen account | Public |
| `POST` | `/api/auth/login` | Authenticate user & return JWT | Public |
| `GET` | `/api/auth/me` | Fetch active user profile & unread alerts | Authenticated |
| `POST` | `/api/reports/check-duplicate` | Check nearby duplicates before submission | Authenticated |
| `POST` | `/api/reports` | Submit citizen report (new or link to existing) | Authenticated |
| `GET` | `/api/reports` | List citizen reports (supports `mineOnly=true`) | Authenticated |
| `GET` | `/api/reports/:id` | Fetch single report details with original evidence | Authenticated |
| `POST` | `/api/reports/upload-image` | Upload photographic evidence | Authenticated |
| `GET` | `/api/issues` | List master civic issues (filterable by category, status) | Public |
| `GET` | `/api/issues/nearby` | Find issues within GPS radius | Public |
| `GET` | `/api/issues/:id` | Get master issue details, linked reports, & history | Public |
| `PATCH` | `/api/issues/:id/status` | Update issue status & notify linked citizens | Staff / Admin |
| `POST` | `/api/issues/:id/assign` | Assign issue to municipal department | Admin |
| `POST` | `/api/issues/:id/reopen` | Reopen resolved issue with justification | Authenticated |
| `POST` | `/api/issues/:id/verify-resolution` | Record citizen feedback on repair effectiveness | Authenticated |
| `POST` | `/api/issues/:id/follow` | Toggle subscription to issue alerts | Authenticated |
| `POST` | `/api/issues/:id/merge` | Merge two master issues with audit log | Admin Only |
| `POST` | `/api/issues/:id/separate` | Separate misclassified report into new issue | Admin Only |
| `GET` | `/api/infrastructure` | List infrastructure assets with health & risk | Public |
| `GET` | `/api/infrastructure/:id` | Dedicated asset failure profile, MTBF, & timeline | Public |
| `POST` | `/api/infrastructure/:id/repairs` | Log repair (temporary vs permanent, cost, photos) | Staff / Admin |
| `GET` | `/api/analytics/overview` | KPI overview (reports vs issues, high-risk assets) | Public |
| `GET` | `/api/analytics/repair-effectiveness` | Repeat incident rate & temporary vs permanent metrics | Public |
| `GET` | `/api/analytics/maintenance-waste` | Maintenance expenditure & engineering audit flags | Public |
| `GET` | `/api/analytics/seasonal-trends` | Monthly incident trends by category | Public |
| `GET` | `/api/analytics/department-performance`| Department resolution times, SLA %, & evidence % | Public |

---

## 🛡️ License

Developed as an academic Full Stack Development project. Open source under the MIT License.
