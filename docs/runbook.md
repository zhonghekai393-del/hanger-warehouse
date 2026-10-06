# 衣架仓库管理 V1 运行手册

## 环境要求

- Node.js 20+（项目开发验证使用 Node.js 24）
- pnpm 10+
- PostgreSQL 16+；本地可使用仓库中的 Docker Compose

## 本地启动

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install --ignore-scripts
pnpm db:migrate
pnpm db:seed
pnpm dev
```

然后打开 <http://localhost:3000/login>。首次 seed 前必须修改 `.env` 中的 `ADMIN_PASSWORD`；项目拒绝使用示例默认密码。默认管理员账号由 `ADMIN_USERNAME` 指定，操作员账号可同时填写 `OPERATOR_USERNAME` 与 `OPERATOR_PASSWORD`。

如果本地没有 Docker，可将 `DATABASE_URL` 改为可访问的 PostgreSQL 实例，确保数据库用户有建表、索引、函数和扩展权限，再运行 `pnpm db:migrate`。

## 验证命令

```bash
pnpm test --run
pnpm typecheck
pnpm lint
pnpm build
```

没有 `DATABASE_URL` 时，纯规则和认证测试仍会运行；schema、事务、并发、API 数据库测试会明确跳过。配置 PostgreSQL 后重新运行同一组命令，才能验证数据库一致性。

## 生产运行

部署到支持 Node.js 的应用主机，并配置：

- `DATABASE_URL`：生产 PostgreSQL 连接串
- `SESSION_COOKIE_NAME`：唯一的会话 Cookie 名称
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`：仅在首次 seed 时使用
- `NEXT_PUBLIC_APP_URL`：正式 HTTPS 地址

```bash
pnpm install --ignore-scripts
pnpm db:migrate
pnpm build
pnpm start
```

生产环境必须使用 HTTPS，使会话 Cookie 自动带上 `Secure`；不要把 `.env`、密码、会话 token 或数据库连接串提交到 Git。PWA V1 是网络优先应用，不支持离线写入库存，避免设备离线时显示或提交过期余额。

## 备份与纠错

使用 PostgreSQL 的 `pg_dump` 做定期备份。库存历史没有删除接口；错误操作通过管理员创建反向库存调整纠正，保留原流水和操作人信息。升级 migration 前先完成数据库备份。
