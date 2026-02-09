# Feature Flagging Design — Cloudignite

Safe rollout of new features (e.g. Owner View, future dashboard changes) without disrupting existing users.

---

## 1. Current state

- **Backend:** `backend/src/utils/featureFlags.js` — env-based flags + optional `.feature-flags.json` override. Used for cache, Square, OCR, rate limiting, maintenance.
- **No per-tenant or per-user flags** — flags are global (process/env + file).

---

## 2. Goals

- **Roll out Owner View** to a subset of tenants or all tenants with a kill switch.
- **Hide new UI** (e.g. Owner View link) when the feature is off.
- **Optional:** Per-tenant or per-role flags later (e.g. beta tenants only).

---

## 3. Recommended approach

### 3.1 Global flag: Owner View

- **Name:** `ENABLE_OWNER_VIEW`
- **Default:** `true` (on); set `ENABLE_OWNER_VIEW=false` to disable.
- **Backend:**  
  - In `dashboardRoutes.js`, guard `GET /api/dashboard/executive-summary`: if flag off, return `403` or `503` with `{ success: false, message: "Owner View is temporarily disabled" }` or omit the route when flag is false.
  - Alternatively, always expose the route; when flag off return a minimal response (e.g. `priorityOne: null`, `crisisBanner: { visible: false }`) so the frontend can show "Coming soon" or hide the Owner View entry.
- **Frontend:**  
  - Option A: Call a small config endpoint (e.g. `GET /api/config/features`) that returns `{ ownerView: true }`. If false, hide "Owner View" in the sidebar and redirect `owner-view.html` to `index.html`.  
  - Option B: No config endpoint — if `GET /api/dashboard/executive-summary` returns 403/503, frontend hides the Owner View link and shows a message on the owner-view page.

**Recommendation:** Use **Option B** (no new endpoint). Add `ENABLE_OWNER_VIEW` to featureFlags; in the executive-summary route, if disabled return `503` with a clear message. Frontend: if executive-summary fails with 503, treat as "feature disabled" and hide Owner View in nav (e.g. via a global flag set once on app load).

### 3.2 Adding the flag (implementation sketch)

**Backend**

1. In `featureFlags.js`, add `ENABLE_OWNER_VIEW: process.env.ENABLE_OWNER_VIEW !== 'false'`.
2. In `dashboardRoutes.js`, at the start of the executive-summary handler:
   ```js
   if (!featureFlags.isEnabled('ENABLE_OWNER_VIEW')) {
     return res.status(503).json({ success: false, message: 'Owner View is currently disabled.' });
   }
   ```

**Frontend**

1. On load of `index.html` / `analytics.html` (or a shared script), call `GET /api/dashboard/executive-summary` once (or a dedicated `GET /api/config/features`). If 503 or `message` indicates disabled, set `window.OWNER_VIEW_ENABLED = false`.
2. If `window.OWNER_VIEW_ENABLED === false`, hide the "Owner View" sidebar link and, from `owner-view.html`, redirect to `index.html` with a query e.g. `?owner-view=disabled`.

### 3.3 Future: per-tenant or per-role

- **Per-tenant:** Store in DB (e.g. `tenant_settings` table: `tenant_id`, `key`, `value`). In middleware or route, resolve `req.tenantId` and check the flag for that tenant. Requires a small API or inline lookup.
- **Per-role:** If user roles exist, add a role check (e.g. only `owner` or `admin` see Owner View). Can combine with global flag: `ENABLE_OWNER_VIEW && (req.user.role === 'owner' || req.user.role === 'admin')`.

---

## 4. Rollout checklist

- [ ] Add `ENABLE_OWNER_VIEW` to featureFlags (default true).
- [ ] Guard executive-summary route; return 503 when disabled.
- [ ] Document in OPERATIONS.md and .env.example.
- [ ] (Optional) Frontend: hide Owner View link and redirect when 503.
- [ ] (Optional) Add `GET /api/config/features` later if multiple flags are needed client-side.

---

## 5. Files to touch

| File | Change |
|------|--------|
| `backend/src/utils/featureFlags.js` | Add `ENABLE_OWNER_VIEW` to default flags. |
| `backend/src/routes/dashboardRoutes.js` | Check flag in executive-summary handler; return 503 if disabled. |
| `backend/.env.example` | Document `ENABLE_OWNER_VIEW=true`. |
| `fila/index.html`, `fila/analytics.html`, `fila/owner-view.html` | Optional: hide Owner View link and redirect when feature disabled (e.g. after 503 from executive-summary). |

This design allows turning Owner View off globally without code deploy and sets the stage for per-tenant or per-role flags later.
