# 衣架仓库出入库管理系统 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA for SKU-level hanger inventory, transactional stock movements, traceable history, and low-stock visibility.

**Architecture:** Next.js App Router serves the UI and route handlers. PostgreSQL is accessed with parameterized `pg` queries and explicit SQL migrations; `applyStockMovement` is the only balance mutation path and locks the target row inside a transaction. Authentication uses scrypt password hashes, hashed sessions, and HttpOnly cookies.

**Tech Stack:** Next.js, React, TypeScript, PostgreSQL, `pg`, `zod`, Vitest, native CSS, Web App Manifest, service worker.

**Spec:** `docs/superpowers/specs/2026-10-06-clothes-hanger-warehouse-design.md`

## Global Constraints

- Inventory is separated as `product -> product_variant/SKU -> inventory`.
- Every IN, OUT, ADJUSTMENT, INITIAL, or COUNT change creates a stock movement.
- Inventory movement and balance update succeed or fail in one database transaction.
- The server calculates final inventory; the client never submits a replacement balance.
- Inventory quantities are integers in the smallest unit; negative stock is rejected by default.
- SKU is unique, non-empty barcodes are unique, and `(variant_id, warehouse_id)` is unique.
- Historical movements have no delete operation; corrections use a reverse adjustment.
- Mobile-first controls must support iPhone Safari and Android Chrome dimensions.
- V1 excludes procurement, sales orders, finance, suppliers, multi-warehouse transfer, complex approvals, scanning, and Excel.

---

### Task 1: Bootstrap the Next.js application and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces the `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` commands used by later tasks.
- Produces the alias `@/*` mapped to the repository root.

- [ ] **Step 1: Write the failing smoke test**

Create `tests/smoke.test.ts` with one assertion that imports `appName` from `src/lib/config.ts` and expects `衣架仓库管理`. Run `pnpm test --run tests/smoke.test.ts`; it must fail because the module does not exist.

- [ ] **Step 2: Add the minimum application configuration**

Create `package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `db:migrate`, and `db:seed`. Add only `next`, `react`, `react-dom`, `pg`, `zod`, `vitest`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, and the Next ESLint config needed by the scripts. Create `src/lib/config.ts` exporting `appName` and a root layout that uses it.

- [ ] **Step 3: Run the smoke test and static checks**

Run `pnpm test --run tests/smoke.test.ts`, `pnpm typecheck`, and `pnpm build`. Expected: the smoke test passes, TypeScript exits 0, and the production build exits 0.

- [ ] **Step 4: Commit the bootstrap**

Run `git add package.json pnpm-lock.yaml tsconfig.json next.config.ts vitest.config.ts .gitignore .env.example app src tests` and `git commit -m "chore: bootstrap warehouse app"`.

### Task 2: Create PostgreSQL schema, migration, and seed

**Files:**
- Create: `db/migrations/001_initial.sql`
- Create: `db/migrate.ts`, `db/seed.ts`, `src/lib/db.ts`, `src/lib/db-types.ts`
- Modify: `package.json`, `.env.example`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- `src/lib/db.ts` exports `pool` and `withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>`.
- `db/migrate.ts` applies numbered SQL files from `db/migrations` in lexical order.
- `db/seed.ts` creates one admin from `ADMIN_USERNAME`/`ADMIN_PASSWORD`, one operator if configured, one `主仓库`, and one default `衣架` category.

- [ ] **Step 1: Write the schema contract test**

Create a test that skips with an explicit `DATABASE_URL is not configured` message when no database is present, and otherwise queries `information_schema` for `users`, `products`, `product_variants`, `warehouses`, `inventory`, and `stock_movements`. It must also assert that `product_variants_sku_key`, `inventory_variant_id_warehouse_id_key`, and the non-null barcode unique index exist.

- [ ] **Step 2: Write the migration**

Create tables for `users`, `sessions`, `categories`, `products`, `product_variants`, `warehouses`, `inventory`, and `stock_movements`, plus `movement_no_seq`. Use UUID primary keys, UTC timestamps, `integer` quantity columns, check constraints for non-negative stock, unique SKU, partial unique barcode, and unique `(variant_id, warehouse_id)`. Add indexes for movement date, variant, warehouse, and user.

- [ ] **Step 3: Implement migration and transaction helpers**

Use `pg.Pool` from `DATABASE_URL`, set a short connection idle timeout, and implement `withTransaction` as `BEGIN`, callback, `COMMIT`, or `ROLLBACK` in `finally`. Use parameterized SQL only.

- [ ] **Step 4: Implement deterministic seed behavior**

Hash passwords with Node `crypto.scrypt` and a random salt. Use upserts for the default category and warehouse. Seed must fail if the admin password is absent instead of creating a known default credential.

- [ ] **Step 5: Run migration, schema test, and typecheck**

Run `pnpm db:migrate`, `pnpm test --run tests/db/schema.test.ts`, and `pnpm typecheck`. If PostgreSQL is unavailable, retain the test's explicit skipped status and report integration verification as pending; do not claim schema execution passed.

- [ ] **Step 6: Commit the database foundation**

Run `git add db src/lib/db.ts src/lib/db-types.ts tests/db package.json pnpm-lock.yaml .env.example` and `git commit -m "feat: add inventory database schema"`.

### Task 3: Implement and test the pure inventory rules

**Files:**
- Create: `src/lib/inventory/rules.ts`, `src/lib/inventory/types.ts`
- Test: `tests/inventory/rules.test.ts`

**Interfaces:**
- `convertInputToBaseUnits(input: { quantity: number; unit: string; baseUnit: string; packSize: number }): number`.
- `calculateMovement(input: { type: "IN" | "OUT" | "ADJUSTMENT"; currentQuantity: number; inputQuantity: number; inputUnit: string; baseUnit: string; packSize: number; actualQuantity?: number }): { delta: number; afterQuantity: number; storedInputQuantity: number; storedInputUnit: string }`.
- `getStockStatus(quantity: number, minimumStock: number): "NORMAL" | "LOW" | "OUT"`.

- [ ] **Step 1: Write failing tests**

Cover 20 boxes × 100 pieces = 2000, base-unit input, rejection of decimals/zero/negative/invalid pack size, IN from 1000 to 3000, OUT from 3000 to 2500, OUT over 250 rejecting with `库存不足`, ADJUSTMENT from 2500 to 2490 producing `-10`, zero-delta adjustment rejection, and the three stock statuses.

- [ ] **Step 2: Run the focused test to verify RED**

Run `pnpm test --run tests/inventory/rules.test.ts`. Expected: FAIL because `src/lib/inventory/rules.ts` is not implemented.

- [ ] **Step 3: Implement the minimum rules**

Validate integer inputs before conversion, use only integer multiplication, compute adjustment delta from the submitted actual quantity, and reject any result below zero. Do not add floating-point or permissive coercion.

- [ ] **Step 4: Run focused and full unit tests**

Run `pnpm test --run tests/inventory/rules.test.ts` and then `pnpm test --run`. Expected: all tests pass.

- [ ] **Step 5: Commit the domain rules**

Run `git add src/lib/inventory tests/inventory` and `git commit -m "feat: add tested inventory rules"`.

### Task 4: Add transactional stock movement service

**Files:**
- Create: `src/lib/inventory/service.ts`, `src/lib/inventory/errors.ts`
- Test: `tests/inventory/service.test.ts`, `tests/inventory/concurrency.test.ts`

**Interfaces:**
- `applyStockMovement(input: { variantId: string; warehouseId: string; type: "IN" | "OUT" | "ADJUSTMENT"; inputQuantity: number; inputUnit: string; actualQuantity?: number; operatorId: string; remark?: string }): Promise<StockMovementResult>`.
- `StockMovementResult` includes `movementNo`, `movementId`, `beforeQuantity`, `delta`, `afterQuantity`, and `status`.

- [ ] **Step 1: Write failing integration tests**

With a test database fixture, assert that a 20-box IN creates one `IN` row with `quantity=2000` and inventory `1000 -> 3000`; a 5-box OUT creates `quantity=-500` and `3000 -> 2500`; overdraw creates neither a movement nor a balance change; and a forced insert failure rolls back the balance update. If no `DATABASE_URL` exists, mark only these tests skipped with the reason.

- [ ] **Step 2: Run the focused tests to verify RED**

Run `pnpm test --run tests/inventory/service.test.ts tests/inventory/concurrency.test.ts`. Expected: FAIL because the service is not implemented.

- [ ] **Step 3: Implement the transaction boundary**

Inside `withTransaction`, select the single inventory row `FOR UPDATE`, join the variant to obtain `unit` and `pack_size`, call `calculateMovement`, generate a movement number using the sequence, insert the movement, update inventory with the calculated result, and return the result. Catch and map unique/check constraint failures to domain errors.

- [ ] **Step 4: Add the concurrency regression test and run it**

Start two `applyStockMovement` calls against stock 500 with 4 boxes × 100 and 2 boxes × 100. Assert one succeeds and one fails when both would exceed available stock, and assert final stock plus movement total equals the original stock. Run the focused integration tests again.

- [ ] **Step 5: Commit the transactional core**

Run `git add src/lib/inventory tests/inventory` and `git commit -m "feat: make stock movements transactional"`.

### Task 5: Implement authentication and CRUD APIs

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/auth/guard.ts`
- Create: `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/me/route.ts`
- Create: `app/api/products/route.ts`, `app/api/products/[id]/route.ts`, `app/api/variants/route.ts`, `app/api/variants/[id]/route.ts`
- Create: `app/api/inventory/route.ts`, `app/api/variants/[id]/detail/route.ts`
- Test: `tests/auth/password.test.ts`, `tests/api/validation.test.ts`

**Interfaces:**
- `hashPassword(password: string): Promise<string>` and `verifyPassword(password: string, encoded: string): Promise<boolean>`.
- `requireUser(request): Promise<SessionUser>` and `requireRole(request, role): Promise<SessionUser>`.
- JSON APIs return `{ data }` on success and `{ error: { code, message } }` on failure.

- [ ] **Step 1: Write failing password and API validation tests**

Assert a password hash verifies only the original password, login validation rejects blank credentials, product variant validation rejects blank SKU/non-integer `packSize`, and movement input rejects client-supplied `afterQuantity`.

- [ ] **Step 2: Run tests to verify RED**

Run `pnpm test --run tests/auth/password.test.ts tests/api/validation.test.ts`. Expected: FAIL because auth and validation modules are absent.

- [ ] **Step 3: Implement password/session helpers and guards**

Use scrypt with a random salt and timing-safe comparison; create a random opaque token, store only its SHA-256 hash with a 30-day expiry, and set/delete a HttpOnly Lax cookie. Return 401/403 without leaking credential or SQL details.

- [ ] **Step 4: Implement product, variant, and inventory route handlers**

Use zod schemas at every write boundary, parameterized SQL, soft-disable variants instead of deleting historical records, and return only the fields required by the UI. Product and variant creation require `ADMIN`; inventory reads require an authenticated user.

- [ ] **Step 5: Run auth tests and typecheck**

Run `pnpm test --run tests/auth/password.test.ts tests/api/validation.test.ts` and `pnpm typecheck`. Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit auth and base APIs**

Run `git add src/lib/auth app/api tests/auth tests/api` and `git commit -m "feat: add auth and catalog APIs"`.

### Task 6: Add stock APIs, movement filters, and dashboard queries

**Files:**
- Create: `app/api/stock/movements/route.ts`, `app/api/movements/route.ts`, `app/api/dashboard/route.ts`
- Create: `src/lib/queries/dashboard.ts`, `src/lib/queries/movements.ts`
- Test: `tests/api/stock-movement-route.test.ts`, `tests/queries/dashboard.test.ts`

**Interfaces:**
- `POST /api/stock/movements` accepts `{ variantId, warehouseId, type, inputQuantity, inputUnit, actualQuantity?, remark? }` and calls `applyStockMovement` with the authenticated operator id.
- `GET /api/movements` accepts `from`, `to`, `type`, `productId`, `variantId`, and `operatorId`.
- `GET /api/dashboard` returns `skuCount`, `totalQuantity`, `todayIn`, `todayOut`, `lowCount`, and `outCount`.

- [ ] **Step 1: Write failing route/query tests**

Assert OUT overdraw returns HTTP 409 with no write, a successful IN returns before/delta/after and movement number, and dashboard counts use only active variants and the main warehouse.

- [ ] **Step 2: Run tests to verify RED**

Run `pnpm test --run tests/api/stock-movement-route.test.ts tests/queries/dashboard.test.ts`. Expected: FAIL because the routes and query modules are absent.

- [ ] **Step 3: Implement the stock movement route**

Require an authenticated user, validate the request, call the transaction service, map domain errors to 400/409, and never accept or trust a client final balance.

- [ ] **Step 4: Implement movement filters and dashboard query**

Build SQL predicates from a fixed allowlist of filter names, bind every value, order movements newest first, and compute the dashboard in SQL aggregates.

- [ ] **Step 5: Run focused tests and typecheck**

Run `pnpm test --run tests/api/stock-movement-route.test.ts tests/queries/dashboard.test.ts` and `pnpm typecheck`.

- [ ] **Step 6: Commit stock APIs**

Run `git add app/api/stock app/api/movements app/api/dashboard src/lib/queries tests/api tests/queries` and `git commit -m "feat: expose stock and reporting APIs"`.

### Task 7: Build the mobile-first product screens

**Files:**
- Create: `app/login/page.tsx`, `app/dashboard/page.tsx`, `app/inventory/page.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`, `app/stock/in/page.tsx`, `app/stock/out/page.tsx`, `app/stock/adjust/page.tsx`, `app/movements/page.tsx`, `app/settings/page.tsx`
- Create: `app/(app)/layout.tsx`, `components/app-shell.tsx`, `components/bottom-nav.tsx`, `components/stock-form.tsx`, `components/inventory-list.tsx`, `components/movement-table.tsx`, `components/status-badge.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `StockForm` accepts `type: "IN" | "OUT" | "ADJUSTMENT"`, loads variants, previews base-unit delta and after stock, and posts only the server request fields.
- `InventoryList` renders SKU, product, color/size, quantity, status, and opens variant detail.
- `MovementTable` renders time, movement number, type, SKU, delta, before, after, operator, and remark with mobile card fallback.

- [ ] **Step 1: Write the screen smoke tests**

Add Playwright tests that visit `/login`, log in with seeded credentials when `E2E_BASE_URL` is configured, then assert the dashboard quick actions, inventory search, and mobile stock form labels are present. Keep these tests skip-safe when the server or credentials are absent.

- [ ] **Step 2: Implement the app shell and login**

Create a neutral header, main content area, desktop side navigation, mobile bottom navigation, login form, loading state, and logout action. Redirect unauthenticated app routes to `/login`.

- [ ] **Step 3: Implement dashboard and inventory**

Show the six requested summary metrics, large IN/OUT actions, inventory search by product/model/SKU/barcode, status colors, and an empty state. Keep primary numbers visually prominent without decorative metric cards.

- [ ] **Step 4: Implement catalog and detail screens**

Allow admins to create/edit products and variants with SKU, barcode, color, size, material, unit, pack size, minimum stock, and remark. Detail view shows current stock, approximate boxes, movement actions, and recent movements.

- [ ] **Step 5: Implement IN, OUT, ADJUSTMENT, and movement screens**

Use one shared form with type-specific labels. Preview conversion and after quantity from server data, disable submit while pending, show 409 stock errors inline, require an adjustment reason, and show movement filters with date/type/product/model/operator controls.

- [ ] **Step 6: Run the app and UI checks**

Run `pnpm dev`, execute the Playwright smoke tests at 390px and 1280px widths, and verify no horizontal overflow, clipped buttons, or unusable tap targets. Fix only issues found by the screenshots/tests.

- [ ] **Step 7: Commit the UI**

Run `git add app components tests/e2e app/globals.css` and `git commit -m "feat: add mobile inventory workflows"`.

### Task 8: Add PWA, final validation, and runbook

**Files:**
- Create: `app/manifest.webmanifest`, `public/sw.js`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `components/service-worker-register.ts`, `docs/runbook.md`
- Modify: `app/layout.tsx`, `app/globals.css`, `package.json`, `.env.example`
- Test: `tests/pwa/manifest.test.ts`

**Interfaces:**
- The manifest exposes Chinese app name, `standalone` display, theme/background colors, and 192/512 icons.
- `docs/runbook.md` documents local PostgreSQL, environment variables, migration/seed, dev/build/start, test, backup, and deployment steps without including secrets.

- [ ] **Step 1: Write the failing manifest test**

Read the manifest JSON and assert the name, `start_url`, `display`, and icon sizes. Run `pnpm test --run tests/pwa/manifest.test.ts`; it must fail before the manifest exists.

- [ ] **Step 2: Add installable PWA assets**

Create a simple non-decorative hanger mark as both PNG sizes, register `public/sw.js` only in production/browser, and use network-first navigation so stale inventory is not presented as current.

- [ ] **Step 3: Write the runbook and environment example**

Document `DATABASE_URL`, `SESSION_COOKIE_NAME`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, local PostgreSQL setup, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`, production build/start, and deployment requirements for a Node host with PostgreSQL.

- [ ] **Step 4: Run the complete verification set**

Run `pnpm test --run`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. If PostgreSQL is configured, run `pnpm db:migrate`, `pnpm db:seed`, and the full integration/E2E checks. Inspect `git diff --check` and `git status --short`.

- [ ] **Step 5: Commit final verification artifacts**

Run `git add app public components docs package.json pnpm-lock.yaml .env.example tests` and `git commit -m "feat: make warehouse app installable"`.

## Self-review

- Product/SKU separation, unit conversion, integer quantities, warehouse reservation, uniqueness, transactional writes, negative-stock protection, adjustment semantics, dashboard, movement filters, login/roles, mobile navigation, PWA, and runbook each have an explicit task.
- No task relies on a placeholder or unnamed helper; interfaces are defined before consumers.
- The plan intentionally leaves scanning, Excel, finance, procurement, multi-warehouse transfer, and complex approvals outside V1 as required.
- The plan keeps database mutation in one service and keeps UI previews informational; the server remains authoritative.
