# External Integrations

## Database

**Service:** Microsoft SQL Server

**Purpose:** Primary persistence for users, profiles, reservations, staff operations data.

**Implementation:**
- Connection pool: `server/db.js` (`mssql` package)
- Schema reference: `server/database/System_Restaurant.sql`
- Migration helper: `server/scripts/apply-reservation-schema.js`

**Configuration (env):**
- `DB_SERVER` (default `localhost`)
- `DB_PORT` (default `1433`)
- `DB_DATABASE` (default `System_Restaurant`)
- `DB_USER`, `DB_PASSWORD`
- `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE`

**Notes:**
- `db.js` rewrites some MySQL-style syntax (`?` placeholders, `` ` `` backticks, `LIMIT 1`) for SQL Server compatibility
- `mysql2` is in `package.json` but not used in server code observed

---

## Email (SMTP / OTP)

**Service:** SMTP (default Gmail — `smtp.gmail.com:587`)

**Purpose:** Send OTP codes for email verification and password reset.

**Implementation:**
- `server/email.js` — `nodemailer` transport, `sendOtpEmail()`
- Called from `server/routes/auth.js` via `sendOtpForUser()`
- OTP lifecycle: `server/utils/otpService.js` (save, verify, cooldown, cleanup interval in `server/index.js`)

**Configuration:**
- `SMTP_USER` / `EMAIL_USER`
- `SMTP_PASS` / `EMAIL_PASS`
- `SMTP_HOST`, `SMTP_PORT`
- `SMTP_FROM` / `EMAIL_FROM`
- `isSmtpConfigured()` checked at server startup

**Dev behavior:**
- `server/utils/otpDev.js` — sample emails log OTP to console instead of sending mail

---

## Google Sign-In / OAuth

**Service:** Google Identity Services (browser) + Google token verification (server)

**Purpose:** Social login and registration.

**Frontend implementation:**
- Script: `https://accounts.google.com/gsi/client` loaded dynamically
- `src/components/auth/googleAuth.js`
- `src/components/auth/AuthCard.jsx` — Google button handlers
- `src/components/auth/GoogleAccountChooserModal.jsx`

**Backend implementation:**
- `server/utils/googleAuth.js` — `verifyGoogleAccessToken`, `verifyGoogleIdToken`
- Routes: `POST /api/auth/google`, `POST /api/auth/google-register` in `server/routes/auth.js`

**Configuration:**
- Frontend: `VITE_GOOGLE_CLIENT_ID` (`import.meta.env`)
- Backend: `GOOGLE_CLIENT_ID` (documented in `server/.env.example`)

**HTTP headers:**
- Vite dev/preview sets `Cross-Origin-Opener-Policy: same-origin-allow-popups` (required for Google popup flow)
- Express sets same COOP header on API responses

---

## REST API (internal)

**Service:** Express REST API (same repo)

**Purpose:** All frontend data mutations and reads except static menu content.

**Frontend clients:**

| Client | Base | Paths (examples) |
|--------|------|------------------|
| `src/api/httpClient.js` | `VITE_API_BASE_URL` → `/api` | Shared `request()` |
| `src/api/authApi.js` | `/api` | `/login`, `/register`, `/auth/*` |
| `src/api/profileApi.js` | `/api` | `/profile/me`, `/profile/:userId` |
| `src/services/reservationApi.js` | `/api` | `/reservations/*` |
| `src/services/staffApi.js` | `/api` | `/staff/*` |

**Backend route summary:**

### Auth (`server/routes/auth.js`)
- `POST /login`, `/register`
- `POST /auth/request-otp`, `/auth/resend-otp`, `/auth/verify-otp`
- `POST /auth/google`, `/auth/google-register`
- `POST /auth/change-password`
- `POST /auth/forgot-password/request-otp`, `resend-otp`, `verify-otp`, `reset`

### Profile (`server/routes/profile.js`)
- `GET/PUT/PATCH /profile/me`, `/:userId`
- `POST /:userId/avatar/upload` (multer)
- `PUT /:userId/avatar/system`, `/avatar/google`

### Reservations (`server/routes/reservations.js`)
- `GET /settings`, `/menu`, `/availability`
- `POST /` (create)
- `GET /my`
- `PATCH /:id/cancel`
- `POST /:id/preorder`

### Staff (`server/routes/staff.js`)
- `GET /overview`
- `GET /reservations/today`
- `GET /tables/status`
- `GET /orders/active`, `/kitchen`
- `GET /dishes`, `/best-selling`
- `GET /promotions`, `/staff`
- `GET /reports/revenue`

### Dishes (`server/routes/dishes.js`)
- `GET /preorder`

**Authentication on API:**
- Profile and reservation mutations use `resolveUserId` + `requireUserId` (user id via `X-User-Id` or body/query)
- Staff routes observed: **no auth middleware** on router — open GET endpoints when server is reachable
- Optional `Authorization: Bearer` read in `httpClient.authHeaders()` but server JWT validation not implemented in `authMiddleware.js`

---

## Static assets / uploads

**Service:** Local filesystem

**Purpose:** User avatar uploads served back to client.

**Implementation:**
- Upload directory: `server/uploads/` (static mount at `/uploads` in `server/index.js`)
- Multer handler in `server/routes/profile.js`

---

## Frontend static content (no API)

**Menu catalog:** `src/data/menuData.js` + `menuAssets.js` — customer menu does not fetch dish list from `/api/dishes` for browsing (staff/preorder paths use API).

**Staff fallback data:** `src/data/staffDashboardMockData.js` when `/api/staff/*` fails.

**Floor plan:** `src/data/floorPlanConfig.js` for reservation table board UI.

---

## Production static hosting

When `dist/` exists after `npm run build`, Express serves the Vite build and SPA fallback for non-API routes (`server/index.js`). This allows single-process deployment of API + frontend.

---

## Webhooks / background jobs

**Webhooks:** None observed.

**Background jobs:**
- OTP cleanup interval every 60s (`runOtpLifecycleCleanup` in `server/index.js`)
- Not a queue system — in-process `setInterval`

---

## Third-party browser resources

- Google Fonts (multiple families) — `@import` in `src/index.css`
- Google Identity Services script (see above)
- GSAP — npm package, not CDN

---

## Environment files

- `server/.env` — exists in repo workspace (secrets; not documented here)
- `server/.env.example` — minimal (`GOOGLE_CLIENT_ID` only in example file read)
- Frontend env: Vite `VITE_*` variables (no committed `.env` observed in mapping; may be local-only)
