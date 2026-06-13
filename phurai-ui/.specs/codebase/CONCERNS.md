# Concerns

Actionable findings from brownfield mapping. Each item cites evidence in the repo.

---

## Critical — Security & access control

### 1. Staff API endpoints lack authentication/authorization

**Evidence:** `server/routes/staff.js` registers multiple `GET` routes with no `authMiddleware` or role checks. Any client that can reach the API can read operational data (reservations, revenue, staff list, etc.).

**Impact:** Data exposure in any network where the API is reachable.

**Fix direction:** Add session/JWT middleware; enforce role (`Manager`, `Staff`, …) per route before returning data.

### 2. User identity for protected routes relies on `X-User-Id` header

**Evidence:** `server/middleware/authMiddleware.js` comment: *"JWT/session can replace the dev fallbacks later"*. `resolveUserId` accepts header, query, or body user id without cryptographic proof.

**Impact:** Client can impersonate another user id on profile/reservation endpoints if server is exposed.

**Fix direction:** Issue signed tokens at login; validate on every protected route; remove trusting raw `X-User-Id` in production.

### 3. Frontend stores auth user in localStorage/sessionStorage without observed token enforcement

**Evidence:** `phurai_auth_user` in `httpClient.js`; Bearer token lookup exists but login flow primarily persists user object. Staff gate on frontend only checks `currentUser.roleName` in `StaffDashboard.jsx`.

**Impact:** UI access control is bypassable; does not protect API.

**Fix direction:** Align with server-side auth; treat frontend role checks as UX only.

---

## High — Routing & product structure

### 4. `/manager` route planned but not implemented in App router

**Evidence:**
- `getPageFromPath()` in `App.jsx` has no `/manager` branch → unknown paths return `notFound`
- `NotFound.jsx` contains `isManagerRoute = lowerPath.startsWith("/manager")` and manager-specific messaging
- User context: preparing to split Manager Dashboard to `/manager`

**Impact:** Navigating to `/manager` today shows 404/restricted UX, not a manager dashboard.

**Fix direction:** Add `/manager` mapping (or migrate from `/staff`) when implementing React Router or extend `getPageFromPath`.

### 5. Manager and Staff share single `/staff` entry

**Evidence:** `StaffDashboard.jsx` serves both roles; `resolveRole()` distinguishes manager vs staff for nav and sections only.

**Impact:** URL does not reflect role separation; harder to deep-link manager-only workflows.

**Fix direction:** Planned `/manager` route should clarify whether it reuses `StaffDashboard` or forks layout.

### 6. `AdminDashboard` exists but is not wired

**Evidence:** `src/pages/admin/AdminDashboard.jsx` is a stub; not imported in `App.jsx`. `/admin` paths only handled in `NotFound.jsx` copy.

**Impact:** Dead code; confusing for contributors expecting admin portal.

**Fix direction:** Wire route or remove until needed.

### 7. No React Router despite multi-portal growth

**Evidence:** All routing in `App.jsx` state + manual path lists; nested settings paths work via pathname string but no route config file.

**Impact:** Adding `/manager`, nested staff views, and guards will increase `App.jsx` complexity and duplicate logic with `NotFound.jsx`.

**Fix direction:** Migration to React Router (user-noted as future work) should centralize path → component → guard mapping.

---

## Medium — Configuration & consistency

### 8. Inconsistent default API base URL (5000 vs 5001)

**Evidence:**
- `httpClient.js` default: `http://localhost:5001/api`
- `Register.jsx`, `VerifyEmail.jsx` default: `http://localhost:5000/api`
- `server/index.js` default port: `5001`

**Impact:** Legacy pages fail against default dev server if `VITE_API_BASE_URL` unset.

**Fix direction:** Standardize on 5001 or use shared `httpClient` in all pages.

### 9. `mysql2` dependency appears unused

**Evidence:** In `package.json` dependencies; `server/db.js` uses `mssql` only.

**Impact:** Unnecessary install surface / confusion about DB engine.

**Fix direction:** Remove if confirmed unused, or document if reserved for future migration.

### 10. Documentation vs code: Tailwind CSS

**Evidence:** `CLAUDE.md` specifies Tailwind; project uses plain CSS files, no Tailwind config or package.

**Impact:** AI/contributor guidance mismatch.

**Fix direction:** Update project docs to reflect CSS-module-style approach, or adopt Tailwind deliberately.

### 11. Customer menu uses static `menuData.js`, not live dish API

**Evidence:** `Menu.jsx` driven by `src/data/menuData.js`; staff/preorder uses `/api/dishes` and `/api/reservations/menu`.

**Impact:** Menu changes require frontend data edits; risk of drift from DB menu used in reservations/staff.

**Fix direction:** Plan API-backed customer menu or sync pipeline.

---

## Medium — Code health & dead code

### 12. Orphan / duplicate page components

**Evidence (not imported by `App.jsx`):**
- `src/pages/auth/LoginPage.jsx`
- `src/pages/auth/Login.jsx`, `Register.jsx`
- `src/pages/customer/Reservation.jsx`
- `src/pages/admin/AdminDashboard.jsx` (stub)

**Impact:** Maintenance burden; risk of editing wrong file.

**Fix direction:** Delete or wire up; consolidate auth on `AuthModal` pattern.

### 13. Duplicate auth route mounting

**Evidence:** `server/index.js` mounts `authRoutes` at both `/api` and `/api/auth`.

**Impact:** Works but doubles surface area; harder to reason about canonical paths.

**Fix direction:** Document canonical paths in API spec; consider single mount prefix.

### 14. Staff dashboard silently falls back to mock data

**Evidence:** `staffApi.js` `staffGet()` catches errors and returns mock data without user-visible distinction except `dishSource` for dishes.

**Impact:** Operators may see demo data during outages without clear warning (partial: loading error toast on Promise.all failure only).

**Fix direction:** Global banner when `source === "mock"`; stricter error UI.

---

## Low — Testing & quality gates

### 15. No automated tests

**Evidence:** No test framework in `package.json`; only `src/test-cases/*.md` manual docs.

**Impact:** Regressions likely as portals split and auth hardens.

**Fix direction:** Add Vitest + Supertest minimum for auth, reservations, staff auth guards.

### 16. ESLint only as automated gate

**Evidence:** `npm run lint` exists; no `test` script.

**Impact:** Build can succeed with broken runtime behavior.

---

## Uncertain — needs verification before acting

### 17. Whether production deploys API and SPA together

**Evidence:** Express serves `dist/` when present — suggests combined deploy is supported, but no deployment config was mapped in this pass.

**Action:** Confirm deployment target (Vite-only static vs `dev:server` combined).

### 18. Full contents of `server/.env.example`

**Evidence:** Only `GOOGLE_CLIENT_ID` found in example file; DB and SMTP vars used in code but not all listed in example.

**Action:** Expand `.env.example` for onboarding (documentation task, not code change in this step).

### 19. Role names in production database

**Evidence:** Code expects `"Manager"`, `"Restaurant Staff"`, `"Kitchen Staff"`, `"Admin"`, `"Customer"` — exact DB seed values not verified in this mapping.

**Action:** Cross-check `System_Restaurant.sql` seed data before role-based route guards.

---

## Summary priority for `/manager` split

When implementing the Manager route separation, touch points already in codebase:

1. `App.jsx` — `getPageFromPath`, `handleNavigate`, portal chrome flags
2. `StaffDashboard.jsx` — `resolveRole`, access guard
3. `staffNav.js` — `managerOnly` items
4. `NotFound.jsx` — `/manager` messaging (ahead of router)
5. `server/routes/staff.js` — server-side authorization (currently missing)

Without server auth, splitting `/manager` on the frontend alone will not secure manager operations.
