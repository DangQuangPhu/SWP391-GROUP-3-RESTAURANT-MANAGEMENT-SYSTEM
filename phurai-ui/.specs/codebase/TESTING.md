# Testing Infrastructure

## Test Frameworks

**Unit / Integration / E2E:** None configured.

Evidence:
- `package.json` has no `test` script and no Jest, Vitest, Mocha, Playwright, or Cypress dependencies
- Glob search for `*.test.{js,jsx}` and `*.spec.{js,jsx}` under project root returned **0 files**

## Test Organization

### Manual test documentation

**Location:** `src/test-cases/`

| File | Scope |
|------|-------|
| `auth-test-cases.md` | Login, register, OTP, Google, forgot password scenarios |
| `auth-profile-test-cases.md` | Profile read/update, avatar, password flows |

**Naming:** Descriptive markdown, table-based case IDs (e.g. `D-01`)

**Structure:** Preconditions, steps, expected results — intended for manual QA, not automation

### Ad-hoc / diagnostic scripts

| File | Purpose | How to run |
|------|---------|------------|
| `server/test-db.js` | Prints DB env + sample `UserAccounts` query | `node server/test-db.js` (requires DB env) |

Not registered as npm scripts.

## Testing Patterns

### Unit tests

**Status:** Not implemented.

### Integration tests

**Status:** Not implemented. API routes in `server/routes/` have no accompanying test files.

### E2E tests

**Status:** Not implemented.

## Test Execution

| Command | What it does |
|---------|----------------|
| `npm run lint` | ESLint static analysis on project |
| `npm run build` | Vite production build (compile check) |
| `npm run dev` + `npm run dev:server` | Manual browser/API testing |
| `node server/test-db.js` | Manual DB connectivity check |

**No automated test gate exists in CI** (no `.github/workflows` test job observed for this package in the mapping scope).

## Coverage Targets

**Current:** Not measurable — no coverage tool configured.

**Goals / enforcement:** Not documented in repository.

## Test Coverage Matrix

| Code Layer | Required Test Type (today) | Location Pattern | Run Command |
|------------|----------------------------|------------------|-------------|
| React components (`src/components/`) | none (manual only) | — | — |
| Pages (`src/pages/`) | none (manual only) | — | — |
| API clients (`src/api/`, `src/services/`) | none | — | — |
| Hooks (`src/hooks/`) | none | — | — |
| Express routes (`server/routes/`) | none | — | — |
| Server utils (`server/utils/`) | none | — | — |
| DB layer (`server/db.js`) | manual script | `server/test-db.js` | `node server/test-db.js` |
| Auth flows (documented) | manual QA | `src/test-cases/*.md` | human execution |

**Recommended before production (not current state):** Vitest or Jest for utils/API clients; Supertest for Express routes; Playwright for reservation and staff critical paths.

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|-----------|----------------|-----------------|----------|
| Unit (hypothetical) | Unknown | N/A — no tests | — |
| Integration (hypothetical) | No | Shared SQL Server `System_Restaurant` | `server/db.js` singleton pool |
| E2E (hypothetical) | Unknown | Would need dedicated test DB + env | — |
| Manual (`test-cases/`) | N/A | QA procedure docs | Markdown only |

## Gate Check Commands (available today)

| Gate Level | When to Use | Command |
|------------|-------------|---------|
| Lint | After JS/JSX changes | `npm run lint` |
| Build | Before deploy / phase completion | `npm run build` |
| Manual smoke | Local feature verification | `npm run dev:full` + browser |
| DB smoke | Backend / schema changes | `node server/test-db.js` |

**Full test gate:** Not available until a test framework is added.
