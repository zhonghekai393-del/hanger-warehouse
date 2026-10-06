# 单人本地库存版与 GitHub Pages 静态部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有衣架仓库管理改造成单人可在手机上使用的 GitHub Pages 静态 PWA，保留完整库存、出入库、记录删除和备份恢复功能。

**Architecture:** 使用 Next.js 静态导出生成 `out/`，通过 GitHub Actions 发布到 `/hanger-warehouse/`。页面不再调用 PostgreSQL API，改由浏览器 IndexedDB 本地仓库层提供商品、库存和流水数据；所有库存变更在本地事务中同时更新库存和流水。现有 PostgreSQL 只用于一次性导出迁移文件，不作为生产运行时。

**Tech Stack:** Next.js App Router、React、TypeScript、原生 IndexedDB、PWA Service Worker、Vitest、GitHub Actions、pnpm；不新增运行时依赖。

**Spec:** `docs/superpowers/specs/2026-10-06-single-user-github-pages-design.md`

## Global Constraints

- 只服务一个人使用。
- 数据默认保存在当前手机的当前浏览器中，不同步到其他设备。
- 不再依赖在线账号、在线会话和 PostgreSQL 才能正常使用。
- 当前方案不提供多人协作、云端同步、跨设备实时共享和服务端权限管理。
- 入库、出库、调整三类库存操作必须保留。
- 每一次库存变动必须保存编号、时间、类型、备注、操作前数量、变动数量和操作后数量。
- 只能删除某个型号和仓库最新的一条库存变动；删除后恢复到该记录的 `beforeQuantity`。
- 商品系列和型号使用停用方式删除，历史流水必须继续可查看。
- 导出/导入备份必须使用 JSON；客户库存备份不能提交到公开 GitHub 仓库。
- Next.js 使用 `output: "export"` 生成 `out/` 静态文件。
- 生产站点基础路径固定为 `/hanger-warehouse/`，预期地址为 `https://zhonghekai393-del.github.io/hanger-warehouse/`。
- 静态页面中的写入操作全部通过浏览器 IndexedDB 完成。
- 不新增运行时依赖；测试优先使用现有 Vitest，浏览器验证使用已有 Playwright 能力或手动验收。
- 所有界面文案使用简体中文；代码、类型名、路径和错误码可以使用英文。
- 实施前必须阅读仓库 `AGENTS.md` 指定的 `node_modules/next/dist/docs/` 相关静态导出、动态路由和部署文档。
- 每个任务完成后运行该任务列出的测试，并创建一个独立 Git 提交。

---

## 文件结构和职责

### 将创建的文件

- `src/lib/local/types.ts`：本地商品、型号、仓库、库存、流水、仪表盘和备份类型。
- `src/lib/local/errors.ts`：本地仓库错误码和中文错误消息。
- `src/lib/local/domain.ts`：库存计算、最新流水删除和看板汇总纯函数。
- `src/lib/local/indexed-db.ts`：原生 IndexedDB 打开、版本升级、object store 和事务辅助函数。
- `src/lib/local/repository.ts`：页面使用的本地仓库接口和 IndexedDB 实现。
- `src/lib/local/backup.ts`：备份格式校验、导出快照序列化和导入快照校验。
- `src/lib/local/config.ts`：生产基础路径、默认仓库和本地用户显示信息。
- `app/(app)/products/detail/page.tsx`：静态商品系列详情页，通过 `?id=` 读取本地数据。
- `app/(app)/products/variant/page.tsx`：静态型号详情页，通过 `?id=` 读取本地数据。
- `db/export-local.ts`：一次性从 PostgreSQL 生成本地版 JSON 备份的脚本。
- `tests/local/domain.test.ts`：库存变更、删除和看板纯函数测试。
- `tests/local/backup.test.ts`：备份格式、引用完整性和错误隔离测试。
- `tests/pwa/static-config.test.ts`：静态导出配置、manifest、Service Worker 和部署路径测试。
- `.github/workflows/deploy-pages.yml`：GitHub Pages 构建发布工作流。

### 将修改的文件

- `next.config.ts`、`app/layout.tsx`、`app/page.tsx`：静态导出、基础路径、manifest 和根入口。
- `components/app-shell.tsx`、`components/service-worker-register.tsx`：本地初始化和 PWA 注册。
- `components/inventory-list.tsx`、`components/movement-table.tsx`、`components/stock-form.tsx`：改用本地仓库。
- `app/(app)/**`：仪表盘、库存、商品、详情、出入库、设置页面改用本地数据。
- `app/globals.css`：本地备份控件、删除操作和手机触摸尺寸样式。
- `public/sw.js`、`app/manifest.webmanifest`：离线缓存和项目路径。
- `package.json`、`.gitignore`：导出命令、备份和静态产物忽略规则。
- `tests/pwa/manifest.test.ts`、`tests/smoke.test.ts`：更新静态入口断言。

### 将移出生产路由或删除的文件

- `app/api/**`：移到 `server/legacy-api/**` 保存历史实现，避免静态导出把服务端 API 当作生产路由。
- `app/(app)/products/[id]/page.tsx`、`app/(app)/products/variant/[id]/page.tsx`：改用查询参数静态页。
- `tests/api/**`：删除依赖旧 API 路由的测试，业务行为由本地 domain、repository 和浏览器验收覆盖。

---

### Task 1: 固定 Next.js 静态导出边界和页面路由

**Files:**
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `app/(app)/products/detail/page.tsx`
- Create: `app/(app)/products/variant/page.tsx`
- Delete: `app/(app)/products/[id]/page.tsx`
- Delete: `app/(app)/products/variant/[id]/page.tsx`
- Create: `tests/pwa/static-config.test.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- `NEXT_PUBLIC_BASE_PATH=/hanger-warehouse` produces links and static assets under `/hanger-warehouse/`.
- Static routes include `/dashboard/`, `/inventory/`, `/movements/`, `/products/`, `/products/detail/`, `/products/variant/`, `/stock/in/`, `/stock/out/`, `/stock/adjust/`.
- The two detail pages read `id` with `useSearchParams()` and never use `useParams()`.

- [ ] **Step 1: Read the repository-local Next.js guidance**

Run:

```bash
rg -l "output.*export|static export|trailingSlash|dynamic route" node_modules/next/dist/docs | sort
```

Read the matching static export, dynamic route and deployment documents before changing configuration.

- [ ] **Step 2: Write the failing static configuration tests**

Read `next.config.ts`, then assert:

```ts
expect(configText).toContain('output: "export"');
expect(configText).toContain("trailingSlash: true");
```

- [ ] **Step 3: Run focused tests and confirm failure**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/pwa/static-config.test.ts tests/pwa/manifest.test.ts
```

Expected: FAIL because the current config has no static export or trailing slash.

- [ ] **Step 4: Implement static configuration and query routes**

Use this configuration shape:

```ts
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const nextConfig: NextConfig = {
  basePath,
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  devIndicators: false,
};
```

Change the root entry to a client-side `router.replace("/dashboard/")`. Replace dynamic links with `/products/detail/?id=` and `/products/variant/?id=`; the new pages may initially render a loading shell until Task 4 wires the repository.

- [ ] **Step 5: Run tests and typecheck**

```bash
NEXT_PUBLIC_BASE_PATH=/hanger-warehouse PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/pwa/static-config.test.ts tests/smoke.test.ts
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm typecheck
```

Expected: focused tests and typecheck pass; the full static build is intentionally deferred until the old `app/api` routes are moved in Task 8.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts app/layout.tsx app/page.tsx 'app/(app)/products' tests/pwa/static-config.test.ts tests/pwa/manifest.test.ts tests/smoke.test.ts
git commit -m "refactor: prepare warehouse app for static export"
```

### Task 2: Add the local data model and tested inventory domain

**Files:**
- Create: `src/lib/local/types.ts`
- Create: `src/lib/local/errors.ts`
- Create: `src/lib/local/domain.ts`
- Create: `tests/local/domain.test.ts`
- Modify: `src/lib/inventory/types.ts`
- Modify: `src/lib/inventory/rules.ts`

**Interfaces:**
- `LocalProduct`, `LocalVariant`, `LocalWarehouse`, `LocalInventory`, `LocalMovement`, `InventoryRow`, `VariantDetail`, `DashboardMetrics`, and `LocalSnapshot` are exported from `src/lib/local/types.ts`.
- `LocalState` contains `products`, `variants`, `warehouses`, `inventory`, `movements`, and `settings` arrays; `ApplyMovementInput` contains `variantId`, `warehouseId`, `type`, `inputQuantity`, `inputUnit`, optional `actualQuantity`, `remark`, `operator`, and `createdAt`.
- `AppliedMovement` contains `state` and `movement`; `CreateVariantInput` contains `productId`, `model`, `sku`, `color`, `unit`, `packSize`, and `minimumStock`.
- `applyMovementToState(state: LocalState, input: ApplyMovementInput): { state: LocalState; movement: LocalMovement }` uses the existing `calculateMovement` rule.
- `deleteLatestMovementFromState(state: LocalState, movementId: string): LocalState` throws `LOCAL_MOVEMENT_NOT_LATEST` for an older record.
- `calculateDashboardMetrics(state: LocalState, now: Date): DashboardMetrics` computes active SKU count, total quantity, today’s IN/OUT, low stock and out-of-stock counts.
- `validateLocalSnapshot(snapshot: unknown): LocalSnapshot` is exported from `src/lib/local/backup.ts` in Task 3 and throws a stable `LocalDataError` code on invalid data.

- [ ] **Step 1: Write failing tests for the full local movement contract**

Create an in-memory fixture with one active product, one active variant, one main warehouse and zero inventory. Add tests equivalent to:

```ts
const result = applyMovementToState(state, {
  variantId: "variant-1",
  warehouseId: "warehouse-main",
  type: "IN",
  inputQuantity: 20,
  inputUnit: "箱",
  actualQuantity: undefined,
  remark: "首次入库",
  operator: "本机用户",
  createdAt: "2026-10-06T00:00:00.000Z",
});

expect(result.movement).toMatchObject({ beforeQuantity: 0, quantity: 2000, afterQuantity: 2000 });
expect(result.state.inventory[0].quantity).toBe(2000);
```

Also test OUT, ADJUSTMENT, insufficient stock, inactive variants, deleting the newest movement, rejecting an older movement, and dashboard totals for the Shanghai calendar day.

- [ ] **Step 2: Run tests and confirm failure**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local/domain.test.ts
```

Expected: FAIL because the local types and domain functions do not exist.

- [ ] **Step 3: Implement the typed local model and pure operations**

Use integer quantities and stable string IDs. Keep movement semantics in one function:

```ts
export function applyMovementToState(
  state: LocalState,
  input: ApplyMovementInput,
): { state: LocalState; movement: LocalMovement };
```

For deletion, sort movements by `createdAt` and `id` for the same variant/warehouse, require the target to be last, restore `beforeQuantity`, and remove only that movement. Map validation failures to Chinese messages through `LocalDataError` while retaining machine-readable codes.

- [ ] **Step 4: Run domain and existing inventory-rule tests**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local/domain.test.ts tests/inventory/rules.test.ts
```

Expected: all new and existing pure inventory tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/local src/lib/inventory/types.ts src/lib/inventory/rules.ts tests/local/domain.test.ts
git commit -m "feat: add local inventory domain"
```

### Task 3: Implement IndexedDB persistence and backup-format validation

**Files:**
- Create: `src/lib/local/indexed-db.ts`
- Create: `src/lib/local/repository.ts`
- Create: `src/lib/local/backup.ts`
- Create: `src/lib/local/config.ts`
- Create: `tests/local/backup.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- `getLocalRepository(): LocalRepository` returns the singleton browser repository.
- `LocalRepository.initialize(): Promise<void>` creates database `hanger-warehouse-local`, version 1, all six stores, indexes and the default `MAIN` warehouse exactly once.
- `listProducts()`, `createProduct(input)`, `disableProduct(id)`, `listVariants(productId?, includeInactive?)`, `createVariant(input)`, `disableVariant(id)`, `listInventory(query?)`, `listWarehouses()` expose local master data.
- `applyMovement(input): Promise<AppliedMovement>` updates inventory and movement in one IndexedDB read/write transaction.
- `listMovements(type?)`, `getVariantDetail(id)`, and `deleteMovement(id)` expose history and latest-only deletion.
- `getDashboardMetrics(now?: Date): Promise<DashboardMetrics>` and `getProductWithVariants(id): Promise<{ product: LocalProduct; variants: VariantDetail[] } | null>` support the dashboard and static detail page.
- `MovementRow` is the joined row displayed by `MovementTable`; `ImportSummary` contains imported product, variant, inventory and movement counts.
- `exportSnapshot(): Promise<LocalSnapshot>` and `importSnapshot(snapshot: unknown): Promise<ImportSummary>` use `backup.ts` validation.

- [ ] **Step 1: Write failing backup validation tests**

Test a valid snapshot round trip, a missing top-level array, duplicate SKU, dangling product ID, negative inventory quantity, invalid movement balance, and unsupported version. Use assertions such as:

```ts
expect(() => validateLocalSnapshot({ version: 1 })).toThrow("备份文件缺少 products 数据");
expect(() => validateLocalSnapshot(invalidBalanceSnapshot)).toThrow("流水余额不一致");
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local/backup.test.ts
```

Expected: FAIL because the backup types and validator do not exist.

- [ ] **Step 3: Implement the IndexedDB schema and transaction wrapper**

Create stores `products`, `variants`, `warehouses`, `inventory`, `movements`, and `settings`. Add indexes for product ID, variant ID, warehouse ID, creation time, type and SKU. Resolve write promises only from `transaction.oncomplete`; reject on `onerror` or `onabort`.

- [ ] **Step 4: Implement repository CRUD and movement transaction**

Initialize the default warehouse as `{ id: "warehouse-main", name: "主仓库", code: "MAIN", isActive: true }`. Before applying or deleting a movement, re-read the variant, inventory and relevant movement list inside the same read/write transaction. Call the pure domain function, then write the updated inventory and movement. No page may mutate inventory directly.

- [ ] **Step 5: Implement backup export/import and ignore local backup files**

Export `{ format: "hanger-warehouse-local", version: 1, exportedAt, products, variants, warehouses, inventory, movements, settings }`. Import validates every reference before clearing stores, then writes the snapshot in one transaction. Add:

```gitignore
out/
backups/*.json
*.local-backup.json
```

- [ ] **Step 6: Run tests and typecheck**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local tests/inventory/rules.test.ts
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm typecheck
```

Expected: all local/domain tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/local tests/local/backup.test.ts .gitignore
git commit -m "feat: persist warehouse data in indexeddb"
```

### Task 4: Convert the application shell and read-only pages to local data

**Files:**
- Modify: `components/app-shell.tsx`
- Modify: `components/bottom-nav.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `app/(app)/inventory/page.tsx`
- Modify: `app/(app)/products/page.tsx`
- Modify: `app/(app)/products/detail/page.tsx`
- Modify: `app/(app)/products/variant/page.tsx`
- Modify: `components/inventory-list.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `AppShell` calls `getLocalRepository().initialize()` once and displays `本机用户` / `管理员`; it never calls `/api/auth/me` or `/api/auth/logout`.
- Product and inventory pages call only `LocalRepository` methods and render repository errors in Chinese.
- All product and inventory links use query routes and preserve the base path through Next `Link`.

- [ ] **Step 1: Add a local inactive-variant fixture test**

Extend `tests/local/domain.test.ts` to assert an inactive variant is excluded from active inventory rows but remains available to historical detail/history data. Keep this as a pure test without a browser dependency.

- [ ] **Step 2: Run the focused tests before UI changes**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local/domain.test.ts
```

Expected: pass, establishing the data contract before replacing page fetches.

- [ ] **Step 3: Replace AppShell authentication with local initialization**

Use this client-side initialization shape:

```ts
useEffect(() => {
  getLocalRepository().initialize()
    .catch((error) => setError(error instanceof Error ? error.message : "本地仓库打开失败"))
    .finally(() => setLoading(false));
}, []);
```

Remove logout network behavior and replace it with a settings link or a local “本机模式” label. Keep desktop side navigation and mobile bottom navigation.

- [ ] **Step 4: Replace dashboard, inventory and product fetches**

Dashboard calls `getDashboardMetrics`; inventory calls `listInventory(query)`; products calls `listProducts`, `createProduct`, `disableProduct`, and `createVariant`; detail pages call `getProductWithVariants` and `getVariantDetail`. After every write, reload the affected local data instead of maintaining a second page-specific data store.

- [ ] **Step 5: Replace dynamic links and localize static entry behavior**

Use:

```tsx
<Link href={`/products/detail/?id=${product.id}`}>商品详情</Link>
<Link href={`/products/variant/?id=${variant.id}`}>型号详情</Link>
```

Keep loading, empty, error and success states in Chinese. Change `app/login/page.tsx` into a local-mode explanation with a link to `/dashboard/`.

- [ ] **Step 6: Run lint, typecheck and tests**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm lint
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm typecheck
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm test --run
```

Expected: no converted client page calls `/api`, all tests pass and the app typechecks.

- [ ] **Step 7: Commit**

```bash
git add components app tests/local/domain.test.ts
git commit -m "refactor: read warehouse data from local storage"
```

### Task 5: Convert inventory operations and movement deletion

**Files:**
- Modify: `components/stock-form.tsx`
- Modify: `components/movement-table.tsx`
- Modify: `app/(app)/movements/page.tsx`
- Modify: `app/(app)/stock/in/page.tsx`
- Modify: `app/(app)/stock/out/page.tsx`
- Modify: `app/(app)/stock/adjust/page.tsx`
- Modify: `app/(app)/products/variant/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/local/domain.test.ts`

**Interfaces:**
- `StockForm` loads `listVariants()` and `listWarehouses()`, previews with `calculateMovement`, and submits through `applyMovement`.
- `MovementsPage` calls `listMovements(type)` and `deleteMovement(id)`, reloading the list after a successful deletion.
- `MovementTable` displays a Chinese delete button for every visible row and delegates confirmation to the page.

- [ ] **Step 1: Add failing tests for operation and deletion behavior**

Extend `tests/local/domain.test.ts` with:

```ts
const afterIn = applyMovementToState(state, inInput);
const afterOut = applyMovementToState(afterIn.state, outInput);
const restored = deleteLatestMovementFromState(afterOut.state, afterOut.movement.id);
const inInputMovementId = afterIn.movement.id;

expect(afterOut.state.inventory[0].quantity).toBe(1500);
expect(restored.inventory[0].quantity).toBe(afterIn.state.inventory[0].quantity);
expect(() => deleteLatestMovementFromState(restored, inInputMovementId)).toThrow("只能删除最新一条记录");
```

Also assert zero-difference adjustment fails and an overdraw OUT writes neither inventory nor movement.

- [ ] **Step 2: Run tests and confirm the new contract fails**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local/domain.test.ts
```

Expected: FAIL only for the newly added operation/deletion shape if the repository implementation does not yet expose it.

- [ ] **Step 3: Replace StockForm network calls with repository calls**

The submit path must call:

```ts
await repository.applyMovement({
  variantId,
  warehouseId,
  type,
  inputQuantity: Number(quantity),
  inputUnit: isAdjustment ? selected.unit : unit,
  actualQuantity: isAdjustment ? Number(quantity) : undefined,
  remark,
  operator: "本机用户",
  createdAt: new Date().toISOString(),
});
```

Preserve unit conversion, adjustment reason validation, preview, success message and nonnegative-stock validation.

- [ ] **Step 4: Replace movement list and delete calls**

The delete handler confirms with the movement number, calls `repository.deleteMovement(String(row.id))`, shows the repository’s Chinese error without changing the list on failure, and reloads on success. Do not add unconfirmed bulk deletion.

- [ ] **Step 5: Run domain tests and static checks**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local tests/inventory/rules.test.ts
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm lint
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm typecheck
```

Expected: movement rules and deletion tests pass, and no converted page references `/api/stock/movements` or `/api/movements`.

- [ ] **Step 6: Commit**

```bash
git add components/stock-form.tsx components/movement-table.tsx 'app/(app)/movements' 'app/(app)/stock' 'app/(app)/products/variant' app/globals.css tests/local/domain.test.ts
git commit -m "feat: support local stock movements and safe deletion"
```

### Task 6: Add settings backup UI and PostgreSQL migration export

**Files:**
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/globals.css`
- Create: `db/export-local.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `tests/local/migration-format.test.ts`

**Interfaces:**
- Settings calls `repository.exportSnapshot()` and downloads `衣架仓库备份-YYYY-MM-DD.json` through a browser `Blob` URL.
- Settings accepts a JSON file, displays counts before confirmation, then calls `repository.importSnapshot(parsed)` and refreshes after success.
- `mapDatabaseRowsToLocalSnapshot(rows)` maps existing SQL rows to `LocalSnapshot` without users’ password hashes or session rows.
- `pnpm db:export-local -- backups/current-local.json` writes only to an ignored local path.

- [ ] **Step 1: Write failing migration mapping tests**

Use fixtures representing the existing SQL columns and assert:

```ts
expect(mapDatabaseRowsToLocalSnapshot(rows).movements[0]).toMatchObject({
  beforeQuantity: 0,
  quantity: 2000,
  afterQuantity: 2000,
  operator: "admin",
});
```

Also assert active flags are preserved, empty categories do not create products, and no password or session field appears in the snapshot.

- [ ] **Step 2: Run migration tests and confirm failure**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local/migration-format.test.ts
```

Expected: FAIL because the SQL-to-local mapping does not exist.

- [ ] **Step 3: Implement the read-only PostgreSQL exporter**

Query only `products`, `product_variants`, `warehouses`, `inventory`, and `stock_movements` joined with users. Map snake_case fields to local camelCase fields, preserve UUIDs/timestamps/active flags/balances/remarks, and use `operator.username`. Never select `users.password_hash` or `sessions`.

- [ ] **Step 4: Add the export command and settings controls**

Add:

```json
"db:export-local": "node --env-file=.env --import tsx db/export-local.ts"
```

The settings page shows local mode, current counts, last export/import time, an “导出备份” button, a file chooser, a confirmation summary and Chinese validation errors. Never upload the file.

- [ ] **Step 5: Run migration tests and verify backups are untracked**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/local/migration-format.test.ts tests/local/backup.test.ts
git status --short --ignored backups out
```

Expected: tests pass and JSON under `backups/` is ignored. Do not delete or update database rows.

- [ ] **Step 6: Commit**

```bash
git add 'app/(app)/settings/page.tsx' app/globals.css db/export-local.ts package.json .gitignore tests/local/migration-format.test.ts
git commit -m "feat: add local backup and database migration export"
```

### Task 7: Make the PWA work at the GitHub Pages path and offline

**Files:**
- Modify: `components/service-worker-register.tsx`
- Modify: `public/sw.js`
- Modify: `app/manifest.webmanifest`
- Modify: `app/layout.tsx`
- Modify: `tests/pwa/manifest.test.ts`
- Modify: `tests/pwa/static-config.test.ts`

**Interfaces:**
- `getBasePath(): string` returns `process.env.NEXT_PUBLIC_BASE_PATH ?? ""`.
- Service Worker registration uses `${basePath}/sw.js` and never registers root `/sw.js` for production.
- The Service Worker caches the dashboard shell, serves cached navigation offline, caches same-origin Next static assets, and activates a new version without mixing old chunks.

- [ ] **Step 1: Add failing path and cache assertions**

Assert:

```ts
expect(manifest.start_url).toBe("/hanger-warehouse/dashboard/");
expect(manifest.icons[0].src).toBe("/hanger-warehouse/icons/icon-192.png");
expect(serviceWorkerSource).toContain("caches.open");
expect(serviceWorkerSource).toContain("clients.claim");
```

- [ ] **Step 2: Run PWA tests and confirm failure**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/pwa
```

Expected: FAIL because manifest and Service Worker use root paths and the current offline response is plain text.

- [ ] **Step 3: Implement manifest and registration paths**

Set production manifest values to the project path, set metadata manifest to the effective path, and register with:

```ts
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
void navigator.serviceWorker.register(`${basePath}/sw.js`);
```

- [ ] **Step 4: Implement cache-first navigation fallback**

Use a versioned cache name, precache the dashboard URL from `self.registration.scope`, cache successful same-origin `GET` requests, return the cached dashboard document for offline navigation failures, delete older `hanger-warehouse-` caches on activate, and call `clients.claim()`.

- [ ] **Step 5: Run PWA tests and inspect generated files**

```bash
NEXT_PUBLIC_BASE_PATH=/hanger-warehouse PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/pwa
NEXT_PUBLIC_BASE_PATH=/hanger-warehouse PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm build
test -f out/index.html
test -f out/manifest.webmanifest
test -f out/sw.js
rg -n "hanger-warehouse|dashboard" out/index.html out/manifest.webmanifest out/sw.js
```

Expected: tests pass and generated assets contain the production base path.

- [ ] **Step 6: Commit**

```bash
git add components/service-worker-register.tsx public/sw.js app/manifest.webmanifest app/layout.tsx tests/pwa
git commit -m "feat: support github pages pwa path and offline shell"
```

### Task 8: Move server-only routes out of the static build and add deployment workflow

**Files:**
- Create: `server/legacy-api/**` from current `app/api/**`
- Delete: `app/api/**`
- Delete: `tests/api/**`
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `docs/deployment/github-pages.md`

**Interfaces:**
- No file under `app/api/**` remains, so static export cannot include server-only POST/DELETE handlers.
- `pnpm build` with `NEXT_PUBLIC_BASE_PATH=/hanger-warehouse` completes without `DATABASE_URL`.
- GitHub Actions installs with pnpm, builds with `NEXT_PUBLIC_BASE_PATH=/hanger-warehouse`, uploads `out/`, and deploys the Pages artifact.

- [ ] **Step 1: Add a static-build guard test**

Scan `app` and fail if any path under `app/api` exists or if converted client pages contain `fetch("/api/` or ``fetch(`/api/``. This protects the static boundary after future edits.

- [ ] **Step 2: Run the guard and build before removing routes**

```bash
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm vitest run tests/pwa/static-config.test.ts
NEXT_PUBLIC_BASE_PATH=/hanger-warehouse PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm build
```

Expected: the guard fails because the current `app/api` directory exists; the build output identifies any remaining static incompatibility to fix.

- [ ] **Step 3: Preserve legacy source outside `app` and remove obsolete tests**

Copy route-handler source into `server/legacy-api/`, remove the `app/api` route tree and `tests/api` files, and keep `db/migrate.ts`, `db/seed.ts`, `db/export-local.ts` and migration libraries. Do not include `.env` or a generated backup.

- [ ] **Step 4: Add the Pages workflow**

Create `.github/workflows/deploy-pages.yml` with:

```yaml
name: Deploy static warehouse app
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
```

The build job uses Node 22, pnpm, `pnpm install --frozen-lockfile`, lint, typecheck, tests, `NEXT_PUBLIC_BASE_PATH=/hanger-warehouse pnpm build`, and uploads `out`. The deploy job uses the official Pages artifact/deploy actions.

- [ ] **Step 5: Document Pages settings and the local-data warning**

Write `docs/deployment/github-pages.md` with the public URL, Pages setting “GitHub Actions”, first-time local import procedure, backup-before-clearing-browser-data rule, and the fact that another phone has a separate local database.

- [ ] **Step 6: Run complete verification without a database**

```bash
env -u DATABASE_URL NEXT_PUBLIC_BASE_PATH=/hanger-warehouse PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm lint
env -u DATABASE_URL NEXT_PUBLIC_BASE_PATH=/hanger-warehouse PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm typecheck
env -u DATABASE_URL NEXT_PUBLIC_BASE_PATH=/hanger-warehouse PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm test --run
env -u DATABASE_URL NEXT_PUBLIC_BASE_PATH=/hanger-warehouse PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm build
```

Expected: all commands exit 0, `out/` exists, and no command needs PostgreSQL.

- [ ] **Step 7: Commit**

```bash
git add server .github/workflows/deploy-pages.yml docs/deployment/github-pages.md package.json .gitignore tests
git commit -m "ci: deploy warehouse app to github pages"
```

### Task 9: Migrate existing data, run browser acceptance, and publish

**Files:**
- Modify only if verification finds a defect: files from Tasks 1-8
- Create locally but never commit: `backups/current-local.json`
- Modify: `docs/deployment/github-pages.md` only for documentation corrections without customer data

**Interfaces:**
- The migration file is generated from the current local PostgreSQL database and imported through Settings.
- The public repository contains source and documentation only, never the migration JSON.
- The public deployment URL opens from a phone and preserves local data after reload.

- [ ] **Step 1: Record current database counts without changing data**

Run read-only SQL queries for active/inactive products, variants, warehouses, inventory rows and movements. Keep the counts in local verification notes, not in the public repository.

- [ ] **Step 2: Generate and validate the local backup**

```bash
mkdir -p backups
PATH='/Users/hekai/.workbuddy-ai/binaries/node/versions/22.22.2/bin:'$PATH pnpm db:export-local -- backups/current-local.json
```

Validate the JSON with the backup validator and compare all counts to Step 1. If validation fails, keep the database unchanged and repair the exporter before proceeding.

- [ ] **Step 3: Run browser acceptance at a mobile viewport**

Verify:

1. Open `/hanger-warehouse/` and see the dashboard without login.
2. Import `backups/current-local.json` through 设置 and confirm the displayed counts.
3. Open 商品型号, add a model, then manually delete it and confirm the history rule.
4. Perform IN, OUT and ADJUSTMENT operations.
5. Verify every movement shows before/after balances and a movement number.
6. Delete the newest movement and verify inventory returns to the previous balance.
7. Try deleting an older movement and verify the Chinese rejection message and unchanged inventory.
8. Export a backup, reload the page and import the exported file.
9. Disable network after the Service Worker is ready and verify cached pages still read and write local data.

- [ ] **Step 4: Run repository safety checks**

```bash
git status --short
git diff --check
git ls-files | rg '(^|/)(\.env|.*\.json)$' || true
git ls-files backups out
```

Expected: no `.env`, client backup or `out` artifact is tracked.

- [ ] **Step 5: Push code and workflow to the public repository**

```bash
git push origin main
gh run list --workflow deploy-pages.yml --limit 1
gh run watch
```

Only report the site as available after the Actions run succeeds and the public URL returns the static app. If Pages settings or Actions permissions block the run, report the exact GitHub error and do not claim deployment success.

- [ ] **Step 6: Commit only non-sensitive documentation corrections**

```bash
git add docs/deployment/github-pages.md
git commit -m "docs: finalize github pages deployment instructions"
git push origin main
```

## Self-review checklist

- [x] Spec coverage: single-user boundary, full IN/OUT/ADJUSTMENT history, manual deletion, latest-only safety, IndexedDB, backup/import, PostgreSQL migration, PWA, GitHub Pages path and offline operation each have an implementation task.
- [x] Placeholder scan: the plan contains no unfinished marker or unresolved design choice.
- [x] Type consistency: `LocalSnapshot`, `ApplyMovementInput`, `AppliedMovement`, `LocalRepository`, `validateLocalSnapshot`, `applyMovementToState` and `deleteLatestMovementFromState` are named consistently across tasks.
- [x] Static boundary: API handlers are moved out of `app`, dynamic ID routes are replaced by query routes, and the final build is run without `DATABASE_URL`.
- [x] Data safety: existing PostgreSQL data is exported read-only before import; backups and `.env` are ignored and never pushed.
- [x] Verification: every task has a failing-test or guard step, a passing command and a separate commit.
