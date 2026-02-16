# Daily Engineering Log - Senior Review & Hardening Status

**Date:** 2026-02-10  
**Reviewer role:** Senior AI Software Agent / Staff Software Engineer  
**Goal:** Identify production blockers, risks, and next actions before real-user deployment.

## What was done today

### 1) Full senior-level production review completed

A critical, production-focused review was performed across:

- Architecture and design
- Code quality
- AI/OCR usage
- Performance and scalability
- Security and reliability
- Testing and observability
- CI/CD and operational readiness

### 2) Production blockers identified (top findings first)

#### Critical

- **JWT secret fallback is still present**
  - Tokens can be signed with a known default if env validation is bypassed.
  - File: `backend/src/routes/authRoutes.js`
  - Status: hard production blocker

#### High

- **Public file exposure via `/uploads`**
  - Files are currently statically served without auth/tenant checks.
  - File: `backend/src/server.js`

- **File path traversal risk in folder creation**
  - User-controlled folder names are used to build filesystem paths.
  - File: `backend/src/services/fileManagerService.js`

- **Unsafe JSON parsing in upload route**
  - Malformed `tags` can fail the request path.
  - File: `backend/src/routes/fileManagerRoutes.js`

- **CI/CD does not run tests before deploy**
  - Security checks exist, but no behavior/regression gate in pipeline.

### 3) Medium-risk issues logged

- Migration process lacks robust migration state ledger/checkpointing.
- Frontend API/auth configuration is inconsistent across environments.
- Observability is weak for production incident response (heavy `console.*`, limited structured telemetry).
- SQLite likely becomes a scaling bottleneck under sustained concurrent write load.

### 4) Positive findings

- Route/service separation is present in many modules.
- Multi-tenant awareness exists across auth and route filtering.
- OCR concerns are isolated behind service abstraction.
- Docker and compose setup is usable for local/early deployment.
- Security middleware exists (headers, CORS, CSP, audit logging, limits).
- Health endpoints and local repair/startup scripts improved operability.

## Current system verdict

- **Functional for local/dev**
- **Not production-ready yet**

### Primary blockers before real users

- JWT fallback secret
- Public `/uploads` exposure
- File path sanitization gaps
- Missing CI test gate

## How to start the program (actual current project flow)

### Prerequisites

- Node.js LTS + npm
- `.env` in `backend/` with at least:
  - `JWT_SECRET` (required)
  - `PORT=8000` (default in this repo)
  - `NODE_ENV=development` (local)

### Recommended startup

#### Option A (easiest)

1. Run `run-one-server.bat` from project root
2. Open `http://localhost:8000/core/index.html`

#### Option B (terminal)

```powershell
cd "c:\Users\lukas\OneDrive\Desktop\crmRestaurant-main\backend"
npm install
npm start
```

Then open:

- `http://localhost:8000/core/index.html`

### Health check

- `http://localhost:8000/api/healthz`

## Known gaps (explicitly acknowledged)

- No reliable unit-test baseline (`npm test` is placeholder).
- Limited structured logging and trace correlation.
- No formal OCR quality evaluation harness/metrics.
- No tested rollback/canary release workflow in CI/CD.
- No authenticated file-download layer replacing public `/uploads`.

## Recommended next step

Next practical move:

1. Implement P0 blockers (security + CI gate).
2. Add a 2-week P0/P1 hardening plan with owners and acceptance criteria.
3. Gate release on a production-readiness checklist (`SECURITY.md` + `RUNBOOK.md`).
