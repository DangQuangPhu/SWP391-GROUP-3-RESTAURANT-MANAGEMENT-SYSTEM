Phūrai Frontend — Feature-First Architecture
Scope: phurai-ui/src/ (Vite React SPA) Strategy: Strangler Fig — migrate one domain at a time; never big-bang moves Status: Migration in progress (features/manager-dashboard/ is the reference implementation)
Related docs:
System / backend overview: .specs/codebase/ARCHITECTURE.md
Brownfield inventory: .specs/codebase/STRUCTURE.md
Manager feature detail: features/manager-dashboard/ARCHITECTURE.md
--------------------------------------------------------------------------------
1. Current State Analysis
1.1 Layout today (legacy + one feature slice)
src/                                    ~226 files
├── main.jsx, App.jsx                   # App shell + pathname router (no React Router)
├── index.css
│
├── api/                                # Shared HTTP (4 files)
│   ├── httpClient.js                   # Base request(), auth storage
│   ├── authApi.js
│   ├── profileApi.js
│   └── index.js
│
├── services/                           # Feature-ish clients (2 files)
│   ├── reservationApi.js               # → /api/reservations/*
│   └── staffApi.js                     # → /api/staff/*
│
├── hooks/                              # Global hooks (2 files)
│   ├── useUserProfile.js               # Profile domain (should move to feature)
│   └── useScrollReveal.js              # Marketing animation (truly global)
│
├── context/
│   └── MenuCartContext.jsx             # Menu domain (should move to feature)
│
├── data/                               # Static + mock (7 files, cross-cutting)
│   ├── menuData.js, menuAssets.js
│   ├── staffNav.js, staffDashboardMockData.js
│   ├── floorPlanConfig.js
│   ├── homeAssets.js, iconAssets.js
│
├── utils/                              # Mixed domain + shared (8 files)
│   ├── authHelpers.js, userMapper.js, otpTiming.js    → auth
│   ├── avatarUtils.js                                 → profile
│   ├── membershipUtils.js                             → reservations
│   ├── menuCustomer.js, flyToCart.js                  → menu
│   └── formatCurrency.js                              → shared
│
├── components/                         # Domain folders (84 files) — main coupling hotspot
│   ├── auth/          (18)             # Modal login/register/OTP/Google
│   ├── profile/       (11)             # Account UI + modals
│   ├── menu/          (7)              # Menu grid, cart, toolbar
│   ├── reservation/   (16)             # Full booking flow + table board
│   ├── staff/         (18)             # Staff portal shell + 10 sections
│   ├── home/          (12)             # Landing sections
│   ├── layout/        (2)              # Navbar, Footer
│   ├── common/        (5)              # FABs, buttons, cards
│   └── ui/            (1)              # Generic UI primitives
│
├── pages/                              # Route screens (19 files)
│   ├── customer/      (13)             # Home, Menu, Reservation, Profile, …
│   ├── staff/         (1)              # StaffDashboard (monolith)
│   ├── auth/          (3)              # Orphan full-page auth (not in App.jsx)
│   ├── admin/         (1)              # Stub only
│   ├── public/        (1)              # LandingPage
│   ├── Register.jsx, VerifyEmail.jsx, NotFound.jsx
│
├── styles/                             # 28 CSS files (mostly per-page/portal)
├── assets/
├── test-cases/                         # Manual QA markdown
│
└── features/
    └── manager-dashboard/              # ✅ Reference feature slice (partial)
        ├── ARCHITECTURE.md
        ├── config/managerNav.js
        ├── services/managerApi.js
        ├── hooks/useManagerDashboard.js
        └── overview/                   # → will move to components/overview/
1.2 Architectural smells
Smell
Where
Risk
Page owns business logic
StaffDashboard.jsx (310 lines: fetch + nav + switch)
Hard to test; blocks manager split
Split API layers
api/ vs services/ with no rule
Inconsistent imports
Domain components at root
components/auth, components/menu, …
No encapsulation; cross-imports
Domain hooks/context at root
useUserProfile, MenuCartContext
Hidden coupling to App.jsx
Shared data/ bucket
Menu + staff + reservation config mixed
Unclear ownership
App.jsx god coordinator
Auth state + profile hook + 15 page imports
Grows with every feature
Duplicate auth pages
pages/auth/* unused by router
Dead code confusion
1.3 Domain map (business capabilities)
Domain
Primary UI
Client API
Server
Role
auth
AuthModal, verify/register pages
authApi.js
routes/auth.js
All portals
profile
Profile.jsx, Settings.jsx, profile modals
profileApi.js
routes/profile.js
Customer account
menu
Menu.jsx, cart components
— (static menuData.js; preorder uses dishes API)
routes/dishes.js
Customer
reservations
ReservationPage.jsx, table board
reservationApi.js
routes/reservations.js
Customer
home
Home.jsx, home sections
—
—
Customer marketing
content
TakeOut, Catering, Careers, …
—
—
Customer marketing
staff-dashboard
StaffDashboard.jsx, staff sections
staffApi.js
routes/staff.js
Restaurant/Kitchen staff
manager-dashboard
/manager (planned), overview panels
managerApi.js → staffApi.js
routes/staff.js
Manager/Admin
--------------------------------------------------------------------------------
2. Target Architecture — Global Structure Map
2.1 Principles
Feature owns its domain — UI composition, hooks, feature services, config/mock data, and feature-specific utils live under features/{name}/.
Pages are thin — pages/ only re-exports or wires route props from App.jsx into a feature entry component.
Shared is intentional — Only truly cross-cutting code stays outside features.
Import direction — Features may import from core/ and components/shared/; features must not import sibling features directly (use App shell or shared contracts).
Strangler Fig — Legacy paths keep working via re-export shims until the wave is verified.
2.2 Target tree
src/
├── ARCHITECTURE.md                     # This document
├── main.jsx
├── App.jsx                             # Shell: routing, global auth session, layout chrome
├── index.css
│
├── core/                               # Infrastructure (no UI)
│   ├── api/
│   │   ├── httpClient.js               # FROM src/api/httpClient.js
│   │   └── index.js                    # Barrel: request, auth storage helpers
│   ├── config/
│   │   └── env.js                      # Optional: VITE_* accessors
│   └── constants/
│       └── routes.js                   # Optional: pathname → page key map (extract from App)
│
├── components/                         # Shared presentational UI ONLY
│   ├── ui/                               # Design-system primitives (Button, Card, …)
│   ├── common/                           # Cross-feature widgets (FAB, SectionHeader, …)
│   └── layout/                           # Navbar, Footer (customer chrome)
│
├── hooks/                              # Global hooks ONLY (no domain logic)
│   └── useScrollReveal.js
│
├── pages/                              # Thin route entries (import from features)
│   ├── customer/
│   │   ├── Home.jsx                    # → features/home/pages/HomePage.jsx
│   │   ├── Menu.jsx                    # → features/menu/…
│   │   └── …
│   ├── staff/
│   │   └── StaffDashboard.jsx          # → features/staff-dashboard/… (legacy shim)
│   ├── manager/
│   │   └── ManagerDashboard.jsx        # → features/manager-dashboard/…
│   ├── NotFound.jsx
│   ├── Register.jsx
│   └── VerifyEmail.jsx
│
├── features/
│   │
│   ├── auth/                           # Wave 2
│   │   ├── components/                 # AuthModal, AuthCard, forms, OTP, Google
│   │   ├── hooks/                      # useAuthSession (extract from App over time)
│   │   ├── services/
│   │   │   └── authApi.js              # FROM src/api/authApi.js
│   │   ├── utils/                      # authHelpers, userMapper, otpTiming, googleAuth
│   │   ├── pages/                      # VerifyEmail, Register (optional consolidation)
│   │   └── index.js                    # Public exports for App.jsx
│   │
│   ├── profile/                        # Wave 3
│   │   ├── components/                 # FROM components/profile/*
│   │   ├── hooks/
│   │   │   └── useUserProfile.js       # FROM src/hooks/useUserProfile.js
│   │   ├── services/
│   │   │   └── profileApi.js           # FROM src/api/profileApi.js
│   │   ├── utils/                      # avatarUtils
│   │   └── pages/                      # ProfilePage, SettingsPage shells
│   │
│   ├── menu/                           # Wave 4
│   │   ├── components/                 # FROM components/menu/*
│   │   ├── context/
│   │   │   └── MenuCartContext.jsx
│   │   ├── hooks/
│   │   ├── services/                   # Future: menuApi if API-driven menu
│   │   ├── data/                       # menuData.js, menuAssets.js
│   │   ├── utils/                      # menuCustomer.js, flyToCart.js
│   │   └── pages/
│   │       └── MenuPage.jsx
│   │
│   ├── reservations/                   # Wave 5
│   │   ├── components/                 # FROM components/reservation/*
│   │   ├── services/
│   │   │   └── reservationApi.js
│   │   ├── data/                       # floorPlanConfig.js
│   │   ├── utils/                      # membershipUtils.js
│   │   └── pages/
│   │       ├── ReservationPage.jsx
│   │       └── MyReservationsPage.jsx
│   │
│   ├── home/                           # Wave 6
│   │   ├── components/                 # FROM components/home/*
│   │   ├── data/                       # homeAssets.js
│   │   └── pages/
│   │       └── HomePage.jsx
│   │
│   ├── content/                        # Wave 7 (low-risk static pages)
│   │   └── pages/                      # TakeOut, Catering, PrivateEvents, Careers, ContactHours
│   │
│   ├── staff-dashboard/                # Wave 8 (after manager route proven)
│   │   ├── components/                 # StaffLayout, sections/*, shared staff UI
│   │   ├── config/                     # staffNav.js
│   │   ├── data/                       # staffDashboardMockData.js
│   │   ├── hooks/                      # useStaffDashboard (extract from StaffDashboard)
│   │   ├── services/                   # staffApi.js (or import from core alias)
│   │   └── pages/
│   │       └── StaffDashboardPage.jsx
│   │
│   └── manager-dashboard/              # Wave 1 ✅ (in progress — reference implementation)
│       ├── ARCHITECTURE.md
│       ├── config/managerNav.js
│       ├── services/managerApi.js
│       ├── store/                      # initialState, actions, reducer
│       ├── hooks/useManagerDashboard.js
│       ├── utils/managerRole.js
│       ├── components/
│       │   ├── layout/
│       │   ├── overview/
│       │   └── shared/
│       └── pages/
│           └── ManagerDashboardPage.jsx
│
├── styles/                             # Phase 2+: co-locate with features OR styles/shared + styles/features/*
├── assets/                             # Stays global (images, icons)
└── legacy/                             # Optional temporary re-export shims (remove per wave)
    └── …
2.3 Layer rules per feature
features/{domain}/
├── pages/           Route entry components (compose layout + hook)
├── components/      Presentational UI (no direct fetch)
├── hooks/           Business logic, effects, orchestration
├── services/        API / adapters (uses core/api/httpClient)
├── store/           Optional: reducer / context (if state is non-trivial)
├── config/          Nav, feature flags, static config
├── data/            Mock + static datasets owned by this domain
├── utils/           Pure helpers used only inside this feature
└── index.js         Public API surface for App.jsx and other shells
--------------------------------------------------------------------------------
3. Shared vs Feature-Owned — Decision Matrix
Current path
Target
Owner
api/httpClient.js
core/api/httpClient.js
Shared
api/authApi.js
features/auth/services/authApi.js
auth
api/profileApi.js
features/profile/services/profileApi.js
profile
services/reservationApi.js
features/reservations/services/reservationApi.js
reservations
services/staffApi.js
features/staff-dashboard/services/staffApi.js
staff-dashboard
hooks/useScrollReveal.js
hooks/useScrollReveal.js
Shared
hooks/useUserProfile.js
features/profile/hooks/useUserProfile.js
profile
context/MenuCartContext.jsx
features/menu/context/MenuCartContext.jsx
menu
utils/formatCurrency.js
core/utils/formatCurrency.js or components/shared
Shared
utils/authHelpers.js
features/auth/utils/authHelpers.js
auth
components/layout/*
components/layout/*
Shared
components/common/*
components/common/*
Shared
components/staff/StaffUI.jsx
features/staff-dashboard/components/shared/ then promote to components/ui/ if reused
staff → shared later
data/menuData.js
features/menu/data/menuData.js
menu
data/staffNav.js
features/staff-dashboard/config/staffNav.js
staff-dashboard
pages/customer/Home.jsx
Thin shim → features/home/pages/HomePage.jsx
home
--------------------------------------------------------------------------------
4. Migration Order (Strangler Fig Waves)
Recommended sequence balances dependency order, risk, and learning from manager-dashboard.
Wave
Domain
Priority
Rationale
0
core/ extraction
Foundation
Single HTTP client + shared utils before moving features
1
manager-dashboard
In progress
Smallest new portal; pattern reference; already started
2
auth
High
Central to App.jsx; clear API boundary; enables profile wave
3
profile
High
Depends on auth; useUserProfile already semi-isolated
4
menu
Medium
Self-contained customer flow; cart context moves cleanly
5
reservations
Medium–High
Complex UI but bounded API (reservationApi.js)
6
home
Medium
Many components, low backend coupling
7
content
Low
Thin marketing pages — quick wins
8
staff-dashboard
High effort
Largest monolith; migrate after manager portal live
9
Cleanup
Final
Remove legacy/ shims, orphan pages/auth/*, duplicate Register
Not in scope for early waves: pages/admin/AdminDashboard.jsx (stub until product defines admin portal).
--------------------------------------------------------------------------------
5. Per-Wave Execution Template
Each wave follows the same steps. Do not skip verification.
Step A — Scaffold feature folder
Create features/{domain}/ with index.js public exports.
Step B — Move files (copy + shim)
Copy files to the new location.
Leave a re-export shim at the old path (optional legacy/ or inline):
// src/hooks/useUserProfile.js (temporary shim)
export { useUserProfile, default } from "@/features/profile/hooks/useUserProfile.js";
Step C — Update imports
Grep for old paths: rg "from \"@/hooks/useUserProfile" src
Update App.jsx only when the feature public API stabilizes.
Prefer @/features/{domain} barrel imports at app boundary.
Step D — Verify
Check
Command / action
Lint
npm run lint
Build
npm run build
Dev smoke
npm run dev:full + manual route checklist
Role matrix
Auth flows if applicable
No duplicate fetch
Network tab: same API calls as before
Step E — Remove shim
After one sprint of stable usage, delete legacy path and shims in a dedicated PR.
--------------------------------------------------------------------------------
6. Wave-by-Wave Move Tables
Wave 0 — core/ (foundation)
Source
Destination
src/api/httpClient.js
src/core/api/httpClient.js
src/api/index.js (partial)
src/core/api/index.js
src/utils/formatCurrency.js
src/core/utils/formatCurrency.js
Import updates: Mechanical replace @/api/httpClient → @/core/api/httpClient (or keep shim at @/api/httpClient).
Verify: Full app smoke — login, menu, reservation, staff dashboard.
--------------------------------------------------------------------------------
Wave 1 — manager-dashboard (finish reference feature)
Source
Destination
features/manager-dashboard/overview/*
features/manager-dashboard/components/overview/*
—
features/manager-dashboard/store/* (new)
—
features/manager-dashboard/components/layout/* (new)
—
pages/manager/ManagerDashboard.jsx (new)
Import updates:
// App.jsx (future)
import ManagerDashboard from "@/pages/manager/ManagerDashboard";
// getPageFromPath: add /manager
// isPortalPage: include isManagerPage
Verify: Manager role → /manager overview loads; staff role → /staff unchanged; guest → NotFound.
Detail: See features/manager-dashboard/ARCHITECTURE.md.
--------------------------------------------------------------------------------
Wave 2 — auth
Source
Destination
components/auth/*
features/auth/components/*
api/authApi.js
features/auth/services/authApi.js
utils/authHelpers.js
features/auth/utils/authHelpers.js
utils/userMapper.js
features/auth/utils/userMapper.js
utils/otpTiming.js
features/auth/utils/otpTiming.js
pages/VerifyEmail.jsx
features/auth/pages/VerifyEmail.jsx
pages/Register.jsx
features/auth/pages/Register.jsx
Import updates (primary):
File
Change
App.jsx
AuthModal, AuthSuccessOverlay, ProfileModal from @/features/auth
App.jsx
clearAuthUser, loadAuthUser, … from @/core/api or @/features/auth/services
Navbar.jsx
Auth modal triggers via props (unchanged interface)
Verify:
[ ] Email login / register / OTP
[ ] Google sign-in (if configured)
[ ] Forgot password flow
[ ] /verify, /register routes
[ ] Logout clears session
--------------------------------------------------------------------------------
Wave 3 — profile
Source
Destination
components/profile/*
features/profile/components/*
api/profileApi.js
features/profile/services/profileApi.js
hooks/useUserProfile.js
features/profile/hooks/useUserProfile.js
utils/avatarUtils.js
features/profile/utils/avatarUtils.js
pages/customer/Profile.jsx
features/profile/pages/ProfilePage.jsx
pages/customer/Settings.jsx
features/profile/pages/SettingsPage.jsx
Import updates:
File
Change
App.jsx
useUserProfile from @/features/profile
pages/customer/Profile.jsx
Thin re-export
Verify:
[ ] /profile view + edit mode (?mode=edit)
[ ] /settings/* sub-routes
[ ] Avatar picker / password panel
[ ] Profile dropdown in Navbar
--------------------------------------------------------------------------------
Wave 4 — menu
Source
Destination
components/menu/*
features/menu/components/*
context/MenuCartContext.jsx
features/menu/context/MenuCartContext.jsx
data/menuData.js
features/menu/data/menuData.js
data/menuAssets.js
features/menu/data/menuAssets.js
utils/menuCustomer.js
features/menu/utils/menuCustomer.js
utils/flyToCart.js
features/menu/utils/flyToCart.js
pages/customer/Menu.jsx
features/menu/pages/MenuPage.jsx
styles/menu.css
features/menu/styles/menu.css (or keep global import in page)
Import updates:
File
Change
App.jsx
Menu from @/pages/customer/Menu shim
ReservationPage / preorder
Imports from @/features/menu if cart types shared
Verify:
[ ] /menus category filter + search
[ ] Add to cart + drawer + FAB animation
[ ] Preorder modal from reservation flow still works
--------------------------------------------------------------------------------
Wave 5 — reservations
Source
Destination
components/reservation/*
features/reservations/components/*
services/reservationApi.js
features/reservations/services/reservationApi.js
data/floorPlanConfig.js
features/reservations/data/floorPlanConfig.js
utils/membershipUtils.js
features/reservations/utils/membershipUtils.js
pages/customer/ReservationPage.jsx
features/reservations/pages/ReservationPage.jsx
pages/customer/MyReservationsPage.jsx
features/reservations/pages/MyReservationsPage.jsx
styles/reservation.css, table-board.css, PreorderModal.css
Co-locate or shared styles import
Import updates:
File
Change
App.jsx
Page imports via shims
features/menu
Preorder components import path review
Verify:
[ ] /reservations full flow (form → table board → confirm)
[ ] /my-reservations list (authenticated)
[ ] Membership upgrade modal
[ ] API errors show graceful UI
--------------------------------------------------------------------------------
Wave 6 — home
Source
Destination
components/home/*
features/home/components/*
data/homeAssets.js
features/home/data/homeAssets.js
pages/customer/Home.jsx
features/home/pages/HomePage.jsx
styles/home.css
features/home/styles/home.css
Import updates: App.jsx home route → shim.
Verify: / all sections render; scroll reveal animations work.
--------------------------------------------------------------------------------
Wave 7 — content (marketing pages)
Source
Destination
pages/customer/TakeOut.jsx
features/content/pages/TakeOutPage.jsx
pages/customer/Catering.jsx
features/content/pages/CateringPage.jsx
pages/customer/PrivateEvents.jsx
features/content/pages/PrivateEventsPage.jsx
pages/customer/Careers.jsx
features/content/pages/CareersPage.jsx
pages/customer/ContactHours.jsx
features/content/pages/ContactHoursPage.jsx
components/home/takeout/*
features/content/components/takeout/*
Related styles/*.css
features/content/styles/*
Verify: Each marketing URL loads; Navbar links work.
--------------------------------------------------------------------------------
Wave 8 — staff-dashboard
Source
Destination
pages/staff/StaffDashboard.jsx
features/staff-dashboard/pages/StaffDashboardPage.jsx
components/staff/*
features/staff-dashboard/components/*
data/staffNav.js
features/staff-dashboard/config/staffNav.js
data/staffDashboardMockData.js
features/staff-dashboard/data/staffDashboardMockData.js
services/staffApi.js
features/staff-dashboard/services/staffApi.js
styles/staff-dashboard.css
features/staff-dashboard/styles/staff-dashboard.css
Import updates:
File
Change
App.jsx
Staff page from @/pages/staff/StaffDashboard shim
features/manager-dashboard/services/managerApi.js
Import staffApi from @/features/staff-dashboard/services/staffApi
Verify:
[ ] Restaurant/Kitchen staff → /staff all sections
[ ] Manager redirect → /manager (once Wave 1 complete)
[ ] Mock fallback when API down
--------------------------------------------------------------------------------
7. App.jsx Evolution (without React Router)
Keep App.jsx as the composition root, but shrink imports over time:
Phase 1 (today)     App imports 15+ pages + auth components directly
Phase 2 (target)    App imports pages/* shims + features/auth + features/profile
Phase 3 (ideal)     App imports route map + lazy feature entries only
Optional extraction (Wave 9+):
core/routing/getPageFromPath.js
core/routing/portalLayout.js — isPortalPage, isStaffPage, …
features/auth/providers/AuthProvider.jsx — session state lifted from App
--------------------------------------------------------------------------------
8. Import Alias Conventions (Vite)
Keep existing @/ → src/ alias. Prefer:
import { AuthModal } from "@/features/auth";
import { useUserProfile } from "@/features/profile";
import { request } from "@/core/api";
import Navbar from "@/components/layout/Navbar";
Avoid deep imports from other features:
// ❌ Avoid
import { MenuCartDrawer } from "@/features/menu/components/MenuCartDrawer";

// ✅ Prefer public API
import { MenuCartDrawer } from "@/features/menu";
--------------------------------------------------------------------------------
9. Verification Matrix (full app)
Run after every wave:
Area
Routes / actions
Customer home
/
Menu
/menus
Reservation
/reservations, /my-reservations
Account
/profile, /settings
Auth
Login modal, register, verify email
Staff
/staff (staff role)
Manager
/manager (manager role, after Wave 1)
404
Unknown path → NotFound
Build
npm run build
Lint
npm run lint
--------------------------------------------------------------------------------
10. Current Progress Tracker
Wave
Domain
Status
0
core/
Not started
1
manager-dashboard
~45% — config, services, hook, overview panels
2
auth
Not started
3
profile
Not started
4
menu
Not started
5
reservations
Not started
6
home
Not started
7
content
Not started
8
staff-dashboard
Not started
9
Cleanup
Not started
--------------------------------------------------------------------------------
11. Next Action (when approved to execute)
Wave 0 — Extract core/api/httpClient.js with backward-compatible shim at src/api/httpClient.js.
Wave 1 — Finish manager-dashboard (store, layout, page, /manager in App.jsx).
Wave 2 — Auth feature move (highest leverage for shrinking App.jsx).
No file moves should happen until you approve the wave number.