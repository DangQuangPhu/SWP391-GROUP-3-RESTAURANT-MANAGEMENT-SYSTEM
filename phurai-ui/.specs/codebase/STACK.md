# Tech Stack

**Analyzed:** 2026-06-13

## Core

- **Project name:** `phurai-ui` (package.json)
- **Type:** Single-repo full-stack app — React SPA + Express API in one `package.json`
- **Language:** JavaScript (ES modules, `"type": "module"`)
- **Runtime:** Node.js (backend), browser (frontend via Vite)
- **Package manager:** npm (`package-lock.json` present)

## Frontend

- **Framework:** React 19.2.6 + React DOM 19.2.6
- **Build tool:** Vite 8.0.12 with `@vitejs/plugin-react` 6.0.1
- **Routing:** Custom state-based routing in `src/App.jsx` (History API `pushState` / `popstate`). **React Router is not installed or used.**
- **Styling:** Plain CSS files under `src/styles/` and `src/index.css`. CSS custom properties (`:root` tokens). **Tailwind CSS is not present** (no `tailwind.config`, no Tailwind in dependencies).
- **Animation:** GSAP 3.15.0 (+ ScrollTrigger in some reservation/landing components)
- **Path alias:** `@` → `src/` (configured in `vite.config.js`)
- **State management:**
  - React `useState` / `useEffect` / `useMemo` / `useCallback` at app level (`App.jsx`)
  - `MenuCartContext` (`src/context/MenuCartContext.jsx`) for menu cart with `localStorage` persistence
  - `useUserProfile` hook for profile sync + local extended fields
  - Auth user in `localStorage` / `sessionStorage` (`phurai_auth_user`)

## Backend

- **API framework:** Express 5.2.1 (`server/index.js`)
- **Database:** Microsoft SQL Server via `mssql` 12.5.5 (`server/db.js`)
  - Default database name: `System_Restaurant`
  - Schema reference: `server/database/System_Restaurant.sql`
  - `mysql2` is listed in `package.json` but **no import found in `server/`** — appears unused
- **Auth (server):** Password hashing (`bcryptjs` via `server/utils/password.js`), OTP flow, Google token verification. User resolution via `X-User-Id` header / query / body (`server/middleware/authMiddleware.js`). **No JWT middleware observed.**
- **File uploads:** `multer` on profile avatar route (`server/routes/profile.js`)
- **Email:** `nodemailer` (`server/email.js`) for OTP emails (SMTP, default Gmail host)
- **CORS:** `cors` package; allowed origins from `APP_URL` env (default `http://localhost:5173,http://localhost:5174`)

## Testing

- **Unit / Integration / E2E:** No test framework in `package.json` (no Jest, Vitest, Playwright, Cypress)
- **Manual test docs:** `src/test-cases/auth-test-cases.md`, `src/test-cases/auth-profile-test-cases.md`
- **DB smoke script:** `server/test-db.js` (manual Node script, not npm script)

## External Services (runtime dependencies)

- **Google Identity Services:** Frontend loads `https://accounts.google.com/gsi/client`; requires `VITE_GOOGLE_CLIENT_ID`
- **Google OAuth verification:** Backend `server/utils/googleAuth.js`; requires `GOOGLE_CLIENT_ID` (see `server/.env.example`)
- **SMTP:** Gmail-compatible SMTP for OTP (`SMTP_USER`, `SMTP_PASS`, etc.)
- **SQL Server:** Local or remote instance (`DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, …)

## Development Tools

- **Linting:** ESLint 10 + `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `@eslint/js`
- **Concurrent dev:** `concurrently` — `npm run dev:full` runs API + Vite together
- **Scripts:**
  - `npm run dev` — Vite dev server (default port 5173)
  - `npm run dev:server` — Express on `PORT` or 5001
  - `npm run dev:full` — both
  - `npm run build` — Vite production build → `dist/`
  - `npm run preview` — Vite preview
  - `npm run lint` — ESLint

## Environment Variables (observed)

| Variable | Where used |
|----------|------------|
| `VITE_API_BASE_URL` | `src/api/httpClient.js` (default `http://localhost:5001/api`) |
| `VITE_GOOGLE_CLIENT_ID` | `src/components/auth/googleAuth.js`, `AuthCard.jsx` |
| `PORT` | `server/index.js` (default 5001) |
| `APP_URL` | CORS allowed origins |
| `DB_*` | `server/db.js` |
| `SMTP_*` / `EMAIL_*` | `server/email.js` |
| `GOOGLE_CLIENT_ID` | `server/.env.example` |

**Note:** `src/pages/Register.jsx` and `src/pages/VerifyEmail.jsx` default API base to `http://localhost:5000/api` when env is unset — inconsistent with `httpClient.js` (5001).
