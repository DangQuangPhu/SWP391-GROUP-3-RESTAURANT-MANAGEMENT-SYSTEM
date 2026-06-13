# Project Structure

**Root:** `/Users/phu/Documents/GitHub/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui`

## Directory Tree (key areas, max 3 levels)

```
phurai-ui/
├── index.html                 # SPA shell, mounts /src/main.jsx
├── package.json
├── vite.config.js             # @ → src, COOP headers
├── dist/                      # Vite build output (optional, served by Express)
├── server/
│   ├── index.js               # Express entry
│   ├── config.js              # dotenv load
│   ├── db.js                  # SQL Server pool
│   ├── email.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── profile.js
│   │   ├── reservations.js
│   │   ├── staff.js
│   │   └── dishes.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── utils/
│   ├── database/
│   │   └── System_Restaurant.sql
│   └── scripts/
│       └── apply-reservation-schema.js
└── src/
    ├── main.jsx               # React entry
    ├── App.jsx                # Root router + auth state
    ├── index.css              # Global tokens + reset
    ├── api/
    │   ├── index.js
    │   ├── httpClient.js
    │   ├── authApi.js
    │   └── profileApi.js
    ├── services/
    │   ├── reservationApi.js
    │   └── staffApi.js
    ├── pages/
    │   ├── customer/          # Customer portal pages
    │   ├── staff/             # StaffDashboard
    │   ├── admin/             # AdminDashboard (stub)
    │   ├── auth/              # LoginPage, Login, Register (mostly unused by App)
    │   ├── public/            # LandingPage
    │   ├── NotFound.jsx
    │   ├── Register.jsx       # Legacy standalone register form
    │   └── VerifyEmail.jsx
    ├── components/
    │   ├── auth/
    │   ├── staff/
    │   ├── reservation/
    │   ├── menu/
    │   ├── profile/
    │   ├── home/
    │   ├── layout/
    │   ├── common/
    │   └── ui/
    ├── context/
    │   └── MenuCartContext.jsx
    ├── hooks/
    │   ├── useUserProfile.js
    │   └── useScrollReveal.js
    ├── data/
    │   ├── menuData.js
    │   ├── menuAssets.js
    │   ├── homeAssets.js
    │   ├── floorPlanConfig.js
    │   ├── staffNav.js
    │   ├── staffDashboardMockData.js
    │   └── iconAssets.js
    ├── utils/
    ├── styles/                # 28 feature CSS files + app.css
    ├── assets/
    │   ├── icons/
    │   └── images/
    └── test-cases/            # Manual QA markdown
```

## Module Organization

### Customer Portal

**Purpose:** Public restaurant website — home, menu, reservations, content pages.

**Location:** `src/pages/customer/`

**Key files:**
- `Home.jsx` — landing home with hero/sections
- `Menu.jsx` — menu browsing + cart (`MenuCartContext`)
- `ReservationPage.jsx` — full reservation flow (table board, preorder)
- `MyReservationsPage.jsx` — logged-in reservation list
- `Profile.jsx`, `Settings.jsx` — account management
- `TakeOut.jsx`, `Catering.jsx`, `PrivateEvents.jsx`, `Careers.jsx`, `ContactHours.jsx`

**Supporting components:** `src/components/home/`, `src/components/menu/`, `src/components/reservation/`

### Staff Portal (includes Manager UI)

**Purpose:** Internal operations dashboard at `/staff`.

**Location:**
- Page: `src/pages/staff/StaffDashboard.jsx`
- Layout: `src/components/staff/StaffLayout.jsx`, `StaffSidebar.jsx`, `StaffHeader.jsx`
- Sections: `src/components/staff/sections/*.jsx`
- Nav config: `src/data/staffNav.js`
- Styles: `src/styles/staff-dashboard.css`

### Manager-related logic (not a separate route yet)

**Purpose:** Manager capabilities are role-gated inside Staff portal.

**Location:**
- Role resolution: `StaffDashboard.jsx` → `resolveRole()`
- Nav filtering: `StaffSidebar.jsx`, `staffNav.js` (`managerOnly`)
- Section gates: `OverviewSection`, `TablesSection`, `DishesSection`, etc.
- Copy for future `/manager` URL: `src/pages/NotFound.jsx`

### Auth

**Purpose:** Login, register, OTP, forgot password, Google OAuth.

**Location:**
- Modal flow (active): `src/components/auth/AuthModal.jsx` and children
- API: `src/api/authApi.js`, `server/routes/auth.js`
- Helpers: `src/utils/authHelpers.js`, `src/components/auth/googleAuth.js`

### API / Services

**Purpose:** HTTP integration with Express backend.

**Location:**
- Core client: `src/api/httpClient.js`
- Auth & profile: `src/api/`
- Reservations: `src/services/reservationApi.js`
- Staff dashboard: `src/services/staffApi.js`

### Mock / static data

**Purpose:** Offline UI data and staff dashboard fallback.

**Location:** `src/data/`
- `menuData.js` — customer menu categories/items (static, not from API in customer menu)
- `staffDashboardMockData.js` — KPIs, reservations, tables, dishes, orders, staff, promotions
- `floorPlanConfig.js` — table board layout config
- `homeAssets.js`, `menuAssets.js`, `iconAssets.js` — image/icon references

### Backend

**Purpose:** REST API + SQL Server persistence.

**Location:** `server/`
- Entry: `index.js`
- Domain routes under `routes/`
- Shared DB access: `db.js`

## Where Things Live

| Capability | UI | Client API | Server route | Data |
|------------|-----|------------|--------------|------|
| Login / Register | `AuthModal`, `AuthCard` | `authApi.js` | `routes/auth.js` | `UserAccounts`, `CustomerProfiles` |
| Profile | `Profile.jsx`, `useUserProfile` | `profileApi.js` | `routes/profile.js` | SQL + localStorage extended fields |
| Menu browse | `Menu.jsx` | — (static `menuData.js`) | `routes/dishes.js` (preorder only) | `menuData.js` |
| Reservations | `ReservationPage.jsx` | `reservationApi.js` | `routes/reservations.js` | SQL Server |
| Staff dashboard | `StaffDashboard.jsx` | `staffApi.js` | `routes/staff.js` | SQL + `staffDashboardMockData.js` |
| 404 / access denied | `NotFound.jsx` | — | — | — |

## CSS Files (`src/styles/` + global)

| File | Typical scope |
|------|----------------|
| `index.css` | Global reset, design tokens (imported in `main.jsx`) |
| `app.css` | App-wide utilities (imported in `main.jsx`) |
| `home.css` | Home page |
| `menu.css` | Menu page |
| `reservation.css`, `table-board.css`, `PreorderModal.css` | Reservation flow |
| `staff-dashboard.css` | Staff portal |
| `profile.css`, `settings.css` | Account pages |
| `auth.css`, `authModal.css`, `loginPage.css`, `OtpCodeInput.css` | Auth UI |
| `notFound.css` | 404 page |
| `takeout.css`, `catering.css`, `privateEvents.css`, `careers.css`, `contactHours.css` | Content pages |
| `unique-experience.css`, `SignatureDishCarousel.css` | Home sections |
| `FloatingActionButtons.css`, `AccountDropdown.css`, `AccountSwitchOverlay.css` | Chrome widgets |
| `AvatarPickerModal.css`, `AvatarPreviewModal.css`, `StatusModal.css`, `profileModal.css` | Modals |

## Special / Orphan Files (present but not wired in `App.jsx`)

- `src/pages/admin/AdminDashboard.jsx` — placeholder `<h1>Admin Dashboard</h1>`
- `src/pages/auth/LoginPage.jsx` — full-page auth (not imported by `App.jsx`)
- `src/pages/auth/Login.jsx`, `src/pages/auth/Register.jsx` — not referenced by `App.jsx`
- `src/pages/customer/Reservation.jsx` — not imported (superseded by `ReservationPage.jsx`)
