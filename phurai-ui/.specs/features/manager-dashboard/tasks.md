# Manager Dashboard Tasks

**Design**: `.specs/features/manager-dashboard/design.md`  
**Spec**: `.specs/features/manager-dashboard/spec.md`  
**Status**: Draft

---

## Execution Plan

### Phase 1: Foundation (Sequential)

Config, API wrapper, and role utils — no UI dependencies.

```text
T1 → T2 → T3
```

### Phase 2: Layout + Overview Atoms (Parallel after T1)

Sidebar, header, overview leaf panels, Coming soon — independent files.

```text
        ┌→ T4  ─┐
        ├→ T5  ─┤
        ├→ T6  ─┤
T1 ─────┼→ T7  ─┤
        ├→ T8  ─┤
        ├→ T9  ─┤
        ├→ T10 ─┤
        ├→ T11 ─┤
        └→ T12 ─┘
T2 ──→ T3 (after T2; parallel with Phase 2 atoms)
```

### Phase 3: Compose + Page (Sequential)

```text
T8–T12 → T13
T5, T6 → T14
T3, T4, T7, T13, T14 → T15
```

### Phase 4: App Integration (Sequential)

```text
T15 → T16 → T17 → T18 → T19
```

---

## Task Breakdown

### T1: Create manager navigation config

**What**: Add `managerNav.js` with `NAV_GROUPS`, `VIEW_SUBTITLE`, `FLAT_NAV`, and `implemented` flags per spec table.  
**Where**: `src/features/manager-dashboard/config/managerNav.js`  
**Depends on**: None  
**Reuses**: Structure from `src/data/staffNav.js`  
**Requirements**: MGR-021

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] All phase-1 nav items exported with `implemented: true` only for `overview`
- [ ] `VIEW_SUBTITLE` covers every `view` key used in nav
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T2: Create manager API wrapper

**What**: Add `fetchManagerOverview()` parallel wrapper + re-exports from `staffApi.js`.  
**Where**: `src/services/managerApi.js`  
**Depends on**: None  
**Reuses**: `src/services/staffApi.js`  
**Requirements**: MGR-030

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `fetchManagerOverview()` returns aggregated `{ kpis, revenue, reservations, tables, orders, bestSellers }`
- [ ] Uses same mock fallback behavior as staff API
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T3: Create useManagerDashboard hook

**What**: Implement hook with loading, data, toasts, navigate, onSelect, title/subtitle, search state.  
**Where**: `src/features/manager-dashboard/hooks/useManagerDashboard.js`  
**Depends on**: T2, T1  
**Reuses**: Fetch/nav pattern from `StaffDashboard.jsx`  
**Requirements**: MGR-030, MGR-031, MGR-032, MGR-041

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Fetches only when `hasAccess === true`
- [ ] Sets `loading` true/false around fetch
- [ ] On catch, fires error toast
- [ ] Exposes `navigate`, `onSelect`, `activeId`, `view`, `toasts`
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T4: Create ComingSoonPanel [P]

**What**: Placeholder panel for unimplemented manager views.  
**Where**: `src/features/manager-dashboard/layout/ComingSoonPanel.jsx`  
**Depends on**: T1  
**Reuses**: `StaffUI.jsx` `Card`  
**Requirements**: MGR-022

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Renders title + short description without crashing
- [ ] Uses existing `sfx-*` classes
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T5: Create ManagerSidebar [P]

**What**: Sidebar rendering `NAV_GROUPS`; brand **Manager Portal**.  
**Where**: `src/features/manager-dashboard/layout/ManagerSidebar.jsx`  
**Depends on**: T1  
**Reuses**: `StaffSidebar.jsx` markup/classes  
**Requirements**: MGR-021, MGR-023, MGR-024

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Brand shows "Manager Portal" (not Staff Portal)
- [ ] Mobile scrim + `is-mobile-open` classes wired
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T6: Create ManagerHeader [P]

**What**: Header with title, subtitle, search, mobile menu, collapse toggle.  
**Where**: `src/features/manager-dashboard/layout/ManagerHeader.jsx`  
**Depends on**: T1  
**Reuses**: `StaffHeader.jsx`  
**Requirements**: MGR-020

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Accepts title/subtitle/search props from hook
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T7: Create managerRole utility [P]

**What**: `resolveManagerRole` and `resolveStaffRole` helpers.  
**Where**: `src/features/manager-dashboard/utils/managerRole.js`  
**Depends on**: None  
**Reuses**: Logic from `StaffDashboard.resolveRole`  
**Requirements**: MGR-004, MGR-010, MGR-E03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Normalizes roleName case-insensitively
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T8: Create KpiGrid panel [P]

**What**: Render all KPI cards including revenue.  
**Where**: `src/features/manager-dashboard/overview/KpiGrid.jsx`  
**Depends on**: None  
**Reuses**: `KpiCard.jsx`  
**Requirements**: MGR-033

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Does not filter out revenue KPI
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T9: Create RevenueChartPanel [P]

**What**: Card wrapper around revenue chart.  
**Where**: `src/features/manager-dashboard/overview/RevenueChartPanel.jsx`  
**Depends on**: None  
**Reuses**: `RevenueChart.jsx`, `StaffUI` `Card`  
**Requirements**: MGR-034

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Chart renders with `revenue` series prop
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T10: Create QuickActionsBar [P]

**What**: Five manager quick actions calling `onNavigate`.  
**Where**: `src/features/manager-dashboard/overview/QuickActionsBar.jsx`  
**Depends on**: T1  
**Reuses**: Quick action constants from `OverviewSection.jsx`  
**Requirements**: MGR-036

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] All 5 actions wired to `onNavigate(view, action?)`
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T11: Create FloorSnapshotPanel [P]

**What**: Reservation timeline, table status board, active orders table.  
**Where**: `src/features/manager-dashboard/overview/FloorSnapshotPanel.jsx`  
**Depends on**: None  
**Reuses**: JSX patterns from `OverviewSection.jsx`, status meta from mock data  
**Requirements**: MGR-035, MGR-E05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Top 5 reservations timeline
- [ ] Table counts + tile grid
- [ ] Orders table section present
- [ ] Empty arrays do not throw
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T12: Create BestSellersPanel [P]

**What**: Ranked best-selling dishes list.  
**Where**: `src/features/manager-dashboard/overview/BestSellersPanel.jsx`  
**Depends on**: None  
**Reuses**: `OverviewSection.jsx` rank list  
**Requirements**: MGR-037

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Renders rank, name, qty, revenue
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T13: Create OverviewPanel composer

**What**: Compose overview sub-panels in grid layout matching staff overview.  
**Where**: `src/features/manager-dashboard/overview/OverviewPanel.jsx`  
**Depends on**: T8, T9, T10, T11, T12  
**Reuses**: `OverviewSection.jsx` layout structure  
**Requirements**: MGR-030, MGR-033, MGR-034, MGR-035, MGR-036, MGR-037

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Accepts `data` + `onNavigate`
- [ ] Grid matches staff overview sections
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T14: Create ManagerLayout shell

**What**: Layout with sidebar, header, canvas, toasts; local collapse/mobile state.  
**Where**: `src/features/manager-dashboard/layout/ManagerLayout.jsx`  
**Depends on**: T5, T6  
**Reuses**: `StaffLayout.jsx`  
**Requirements**: MGR-020, MGR-024

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Toast stack renders like staff portal
- [ ] Collapse + mobile menu work
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T15: Create ManagerDashboard page

**What**: Page entry — guard, hook, view switch, loading state, CSS import.  
**Where**: `src/pages/manager/ManagerDashboard.jsx`  
**Depends on**: T3, T4, T7, T13, T14  
**Reuses**: `StaffDashboard.jsx` orchestration  
**Requirements**: MGR-004, MGR-020, MGR-022, MGR-031, MGR-040, MGR-062

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Imports `@/styles/staff-dashboard.css`
- [ ] Denied users see `NotFound` (not layout)
- [ ] `view === "overview"` + loading shows spinner
- [ ] Unimplemented views show `ComingSoonPanel`
- [ ] No Zustand imports added
- [ ] No staff section files deleted
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T16: Wire `/manager` route in App.jsx

**What**: Add `getPageFromPath`, `isPortalPage`, render `ManagerDashboard`.  
**Where**: `src/App.jsx`  
**Depends on**: T15  
**Reuses**: Existing staff portal wiring  
**Requirements**: MGR-001, MGR-002, MGR-003, MGR-005, MGR-E02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `/manager` resolves to `activePage === "manager"`
- [ ] Navbar/Footer hidden on `/manager`
- [ ] Hard refresh on `/manager` loads manager page
- [ ] Gate check passes: `npm run lint` and `npm run build`

**Tests**: none  
**Gate**: build

---

### T17: Enforce staff/manager portal separation

**What**: Redirect Manager/Admin away from `/staff`; ensure staff still access `/staff`.  
**Where**: `src/App.jsx` (preferred) and/or `src/pages/staff/StaffDashboard.jsx`  
**Depends on**: T7, T16  
**Reuses**: `resolveManagerRole`  
**Requirements**: MGR-010, MGR-011, MGR-012, MGR-013, MGR-E01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Manager on `/staff` ends at `/manager` without loop
- [ ] Staff on `/staff` unchanged
- [ ] Customer/guest on `/staff` still NotFound
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T18: Update NotFound manager CTA paths

**What**: Add `manager` navigate target; fix Manager Dashboard CTA URL.  
**Where**: `src/pages/NotFound.jsx`  
**Depends on**: T16  
**Reuses**: Existing restricted-route messaging  
**Requirements**: MGR-E07, MGR-005

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `navigate("manager")` goes to `/manager`
- [ ] Admin-permission copy CTA targets manager route (not staff)
- [ ] Gate check passes: `npm run lint`

**Tests**: none  
**Gate**: lint

---

### T19: Phase 1 manual smoke verification

**What**: Execute manual QA checklist; confirm all MGR-001–MGR-041 acceptance paths.  
**Where**: Browser + `npm run dev:full`  
**Depends on**: T16, T17, T18  
**Reuses**: `.specs/features/manager-dashboard/design.md` verification section  
**Requirements**: MGR-001 through MGR-041, MGR-E01–E07, MGR-062, MGR-063

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Guest → `/manager` → restricted NotFound
- [ ] Customer → `/manager` and `/staff` → denied
- [ ] Staff → `/staff` OK; `/manager` → permission NotFound
- [ ] Manager → `/manager` → full overview (revenue KPI + chart)
- [ ] Manager → `/staff` → redirect `/manager`
- [ ] Unimplemented sidebar item → Coming soon
- [ ] Quick action to unimplemented view → Coming soon
- [ ] No files deleted under `components/staff/`
- [ ] User shown diff summary before any future deletions (MGR-063 process acknowledged)

**Tests**: none (manual QA per TESTING.md)  
**Gate**: build + manual smoke

**Verify**:

```bash
cd /Users/phu/Documents/GitHub/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui
npm run lint
npm run build
npm run dev:full
# Browser checks listed above
```

---

## Requirement → Task Traceability

| Requirement | Task(s) |
| ----------- | ------- |
| MGR-001 | T16 |
| MGR-002 | T16 |
| MGR-003 | T16 |
| MGR-004 | T7, T15 |
| MGR-005 | T15, T16, T18 |
| MGR-010 | T17 |
| MGR-011 | T17 |
| MGR-012 | T17 |
| MGR-013 | T17 |
| MGR-020 | T6, T14, T15 |
| MGR-021 | T1, T5 |
| MGR-022 | T4, T15 |
| MGR-023 | T5 |
| MGR-024 | T5, T14 |
| MGR-030 | T2, T3, T13, T15 |
| MGR-031 | T3, T15 |
| MGR-032 | T3 |
| MGR-033 | T8, T13 |
| MGR-034 | T9, T13 |
| MGR-035 | T11, T13 |
| MGR-036 | T10, T13, T15 |
| MGR-037 | T12, T13 |
| MGR-040 | T15 |
| MGR-041 | T3, T15 |
| MGR-060 | T1–T15 folder structure |
| MGR-061 | Design doc (primitives policy) |
| MGR-062 | T15, T19 |
| MGR-063 | T19 (process gate) |
| MGR-E01–E07 | T16, T17, T18, T19 |

**Coverage**: 25 requirements → 19 tasks — all mapped ✅

---

## Parallel Execution Map

```text
Phase 1:
  T1 ──→ T2 ──→ T3

Phase 2 (after T1; T3 waits for T2):
  T4, T5, T6, T7, T8, T9, T10, T11, T12  [P]

Phase 3:
  T13 (needs T8–T12)
  T14 (needs T5, T6)
  T15 (needs T3, T4, T7, T13, T14)

Phase 4:
  T16 → T17 → T18 → T19
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: managerNav config | 1 config file | ✅ Granular |
| T2: managerApi | 1 service file | ✅ Granular |
| T3: useManagerDashboard | 1 hook file | ✅ Granular |
| T4: ComingSoonPanel | 1 component | ✅ Granular |
| T5: ManagerSidebar | 1 component | ✅ Granular |
| T6: ManagerHeader | 1 component | ✅ Granular |
| T7: managerRole util | 1 util file | ✅ Granular |
| T8–T12: overview panels | 1 panel each | ✅ Granular |
| T13: OverviewPanel | 1 composer | ✅ Granular |
| T14: ManagerLayout | 1 layout file | ✅ Granular |
| T15: ManagerDashboard | 1 page file | ✅ Granular |
| T16–T18: routing/guards | 1–2 files each | ✅ Granular |
| T19: manual verification | QA gate | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ Match |
| T2 | None | Parallel to T1 start | ✅ Match |
| T3 | T2, T1 | After T2 | ✅ Match |
| T4 | T1 | After T1 parallel | ✅ Match |
| T5 | T1 | After T1 parallel | ✅ Match |
| T6 | T1 | After T1 parallel | ✅ Match |
| T7 | None | Parallel in Phase 2 | ✅ Match |
| T8 | None | Parallel | ✅ Match |
| T9 | None | Parallel | ✅ Match |
| T10 | T1 | After T1 parallel | ✅ Match |
| T11 | None | Parallel | ✅ Match |
| T12 | None | Parallel | ✅ Match |
| T13 | T8–T12 | After parallel panels | ✅ Match |
| T14 | T5, T6 | Before T15 | ✅ Match |
| T15 | T3,T4,T7,T13,T14 | Phase 3 end | ✅ Match |
| T16 | T15 | Phase 4 start | ✅ Match |
| T17 | T7, T16 | After T16 | ✅ Match |
| T18 | T16 | After T16 | ✅ Match |
| T19 | T16,T17,T18 | Final | ✅ Match |

---

## Test Co-location Validation

Per `.specs/codebase/TESTING.md` — all code layers require **none** (manual QA only).

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | data/config | none | none | ✅ OK |
| T2 | services | none | none | ✅ OK |
| T3 | hooks | none | none | ✅ OK |
| T4–T14 | components/pages | none | none | ✅ OK |
| T15 | pages | none | none | ✅ OK |
| T16–T18 | App/pages modify | none | none | ✅ OK |
| T19 | manual QA | manual | manual smoke | ✅ OK |

**Gate commands used**: `npm run lint` (per-task), `npm run build` (T16, T19).

---

## Execute Notes

- **One task per commit** when implementing (atomic commits per TLC).
- **MGR-063**: Present diff to user before deleting any `components/staff/*` file — phase 1 must not delete.
- **No Tailwind / Zustand** in any task.
- After T19 passes, update `spec.md` requirement statuses to `Verified`.
