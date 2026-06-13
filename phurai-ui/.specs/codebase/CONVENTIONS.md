# Code Conventions

Conventions observed from representative files across `src/` and `server/`. This documents **what the codebase does today**, not ideal targets.

## Naming Conventions

### Files

- **React components:** PascalCase `.jsx` — e.g. `StaffDashboard.jsx`, `AuthModal.jsx`, `MenuCartFab.jsx`
- **Hooks:** camelCase with `use` prefix — `useUserProfile.js`, `useScrollReveal.js`
- **Utilities / services / API:** camelCase `.js` — `httpClient.js`, `reservationApi.js`, `authHelpers.js`
- **Static data:** camelCase `.js` — `menuData.js`, `staffDashboardMockData.js`, `staffNav.js`
- **Server modules:** camelCase `.js` — `authMiddleware.js`, `otpService.js`, `profileService.js`
- **CSS:** kebab-case or camelCase under `src/styles/` — `staff-dashboard.css`, `authModal.css`

### Components & functions

- **Default export** for page and component files: `export default StaffDashboard`
- **Named exports** for API functions and utilities: `export function fetchKpis()`, `export const API_BASE_URL`
- **Handler naming:** `handleNavigate`, `handleAuthSuccess`, `onOpenAuth` (prefix `handle` / `on` for callbacks)

### Variables & constants

- **React state:** camelCase — `activePage`, `isAuthenticated`, `currentUser`
- **Storage keys:** prefixed string constants — `phurai_auth_user`, `phurai_menu_cart`, `phurai:user-profile:{id}`
- **CSS classes:** BEM-like blocks — `auth-card__title`, `not-found-page__button`, staff portal `sfx-*` prefix
- **Server SQL:** snake_case column names in queries (`user_id`, `role_name`); mapped to camelCase on frontend via `mapApiUserToFrontend`

### Role strings

- **API / DB:** `role_name` values like `"Manager"`, `"Restaurant Staff"`, `"Kitchen Staff"`, `"Customer"`, `"Admin"`
- **Staff UI internal:** lowercase slug — `"manager"`, `"staff"` via `resolveRole()` in `StaffDashboard.jsx`

## Import Style

**Path alias:** `@/` maps to `src/` (Vite `resolve.alias`).

**Typical order in JSX files:**
1. React imports
2. Side-effect CSS imports (`@/styles/...`)
3. Page/component imports
4. API/services/data/utils/hooks

**Example from `App.jsx`:**
```javascript
import { useEffect, useMemo, useState } from "react";
import "@/styles/home.css";
import Home from "@/pages/customer/Home";
// ...
import { clearAuthUser, getProfile, loadAuthUser, mapApiUserToFrontend, saveAuthUser } from "@/api";
```

**Server:** ES module `import` with explicit `.js` extensions.

## Component Patterns

- **Functional components only** — no class components found
- **Props destructuring** in function signature
- **Conditional render** via `activePage === "home" && <Home />` in `App.jsx` (not `<Routes>`)
- **Compound auth flow** inside `AuthModal` using local `view` state (`AUTH`, `OTP`, `FORGOT`, `RESET`)
- **Portal modals:** `createPortal` in `AuthModal.jsx` for document body overlay
- **Staff sections:** switch on `view` string in `StaffDashboard.renderSection()`

## Styling Conventions

- **No Tailwind** — class names map to rules in dedicated CSS files
- **Design tokens** in `src/index.css` `:root` (`--color-primary`, `--font-family`, …)
- **Per-feature CSS** imported at page or component level
- **Staff dashboard** uses prefixed utility classes (`sfx-loading`, `sfx-table`, `sfx-span`)

## API Conventions

### Request paths

- Client `request("/login")` → `${API_BASE_URL}/login` where base already ends with `/api`
- Staff service uses paths like `/staff/overview` (resolved to `/api/staff/overview`)

### Response shape (common)

- Success often: `{ success: true, data: ... }` on staff routes
- Errors: `{ message: "..." }` or `{ success: false, message: "..." }`
- User payloads snake_case from SQL; frontend normalizes via `mapApiUserToFrontend`

### Auth headers

- `Authorization: Bearer <token>` if token keys exist in storage (`phurai_token`, `token`, `authToken`)
- Profile routes also send `X-User-Id` via `profileRequestHeaders(userId)`

## Error Handling

**Frontend `httpClient.request`:**
- Network failure → `createApiError("Cannot connect to server.", { code: "NETWORK_ERROR" })`
- Non-OK HTTP → message from JSON `message` or validation `errors`
- HTML error pages sanitized to generic messages

**Staff API:**
- try/catch in `staffGet` → silent fallback to mock data

**Backend:**
- try/catch in route handlers → `res.status(4xx/5xx).json({ message })`

## Comments & Documentation

- **File-level banner comments** in services/mock data (`staffApi.js`, `staffDashboardMockData.js`)
- **JSDoc** sporadic — e.g. `authMiddleware.js`, `reservationApi.js`, deprecated markers in `authApi.js`
- **Inline comments** for non-obvious business rules (role mapping, OTP dev mode, SQL rewrites in `db.js`)

## Type Safety

- **JavaScript only** — no TypeScript source in `src/` or `server/`
- `@types/react` in devDependencies for editor support only
- Prop types / Zod not used on frontend

## Git / project docs mismatch

`CLAUDE.md` mentions Tailwind CSS and Inter/Roboto fonts; actual stack uses **custom CSS** and **Hanken Grotesk** (+ other Google Fonts in `index.css`). Treat `CLAUDE.md` as aspirational, not ground truth.
