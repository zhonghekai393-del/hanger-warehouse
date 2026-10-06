# 衣架仓库出入库管理系统 V1 设计

**日期：** 2026-10-06  
**基线：** 用户提供的《衣架仓库出入库管理系统 V1》项目说明

## 目标与边界

V1 是一个面向手机操作的衣架 SKU 库存与出入库系统。它必须回答“每个型号现在有多少、何时发生过什么变化、谁操作的、库存是否不足”等问题，并且让每一次库存变化都可追溯。

V1 包含账号登录、商品系列、型号/SKU、单仓库库存、入库、出库、库存调整、流水查询、库存预警、Dashboard 与 PWA。采购订单、销售订单、财务、供应商、多仓库调拨、复杂审批、扫码和 Excel 属于后续版本，不进入本次实现。

## 关键业务规则

1. 商品系列与具体型号/SKU 分离；SKU 是业务唯一编码，数据库使用 UUID 作为主键。
2. 库存只保存最小整数单位；箱数按 `pack_size` 换算，历史流水同时保留用户输入数量、单位、实际库存变化。
3. 客户端只能提交 SKU、仓库、操作类型、输入数量/实际盘点数和备注；服务端计算差值与最终库存。
4. 入库、出库、调整必须在同一个 PostgreSQL 事务中完成：锁住目标库存行，读取操作前库存，校验，写流水，再更新余额；任一步失败则全部回滚。
5. 出库和调整后的库存不得小于 0。出库超量返回明确错误，不创建流水。
6. 余额表由数据库检查约束保护，流水 `quantity` 是带符号的实际变化；历史流水无删除 API，纠错使用反向调整。
7. `sku` 全局唯一；非空 `barcode` 唯一；同一 SKU 与仓库只有一条余额。
8. `minimum_stock` 决定状态：0 为“缺货”，大于 0 且不超过阈值为“库存不足”，高于阈值为“正常”。

## 架构

使用 Next.js App Router + TypeScript，在一个应用中同时提供页面和服务端 API。服务端通过 `pg` 直接访问 PostgreSQL；不用 ORM，避免把事务边界隐藏在数据层。数据库 schema 与 migration 使用显式 SQL，库存核心规则抽成无副作用的 TypeScript 函数并由服务端事务调用。

认证采用最小的账号密码会话：Node `crypto.scrypt` 保存密码哈希，`sessions` 表只保存会话 token 哈希，浏览器使用 HttpOnly、SameSite Cookie。角色只开放 `ADMIN` 与 `OPERATOR` 两种，权限检查集中在服务端 API。

## 数据模型

表：

- `users`：用户名、密码哈希、角色、启用状态。
- `sessions`：会话 token 哈希、用户、过期时间。
- `categories`：商品分类。
- `products`：商品系列。
- `product_variants`：商品型号/SKU、条码、颜色、尺寸、材质、单位、包装数量、最低库存、启用状态。
- `warehouses`：仓库；首个 migration/seed 创建“主仓库”。
- `inventory`：`variant_id + warehouse_id` 唯一、整数 `quantity`。
- `stock_movements`：流水号、类型、带符号变化、输入数量/单位、操作前后余额、操作人、备注、时间。

所有数量字段为 PostgreSQL `integer` 并有非负检查；`stock_movements.quantity` 允许负值但必须对应实际变化。库存写入函数 `applyStockMovement` 是唯一可以改变 `inventory.quantity` 的入口。

## 服务端接口

认证：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`。

基础数据：`GET/POST /api/products`、`GET/PATCH/DELETE /api/products/[id]`、`GET/POST /api/variants`、`GET/PATCH /api/variants/[id]`。删除只做停用，不删除有流水的 SKU。

库存：`GET /api/inventory`、`GET /api/variants/[id]/detail`、`POST /api/stock/movements`。请求体由 `zod` 校验，库存动作只接受 `IN`、`OUT`、`ADJUSTMENT`；`INITIAL` 仅由 seed/管理员初始化路径使用。

流水与概览：`GET /api/movements`、`GET /api/dashboard`。筛选参数包括日期范围、类型、商品、型号和操作人。

## 页面与交互

页面固定为 `/login`、`/dashboard`、`/inventory`、`/products`、`/products/[id]`、`/stock/in`、`/stock/out`、`/stock/adjust`、`/movements`、`/settings`。

移动端底部导航为首页、库存、出入库、商品、我的；首页提供大尺寸入库/出库按钮。库存页采用可搜索的 SKU 列表，详情页突出当前库存、箱数换算、预警状态和最近流水。入库/出库表单最多经过“选型号→输入数量→确认”三步，调整表单要求填写原因。桌面端使用更宽的列表与筛选工具栏，但不改变业务流程。

页面必须覆盖加载、空数据、错误、提交中、成功和库存不足状态。配色采用克制的中性背景、深色文字、单一强调色，预警使用绿色/黄色/红色语义色；不使用无意义的营销 Hero、渐变或装饰性卡片。

PWA 仅负责可安装与网络访问体验，V1 不承诺离线写入。manifest 提供中文名称、图标和 standalone 模式；service worker 采用网络优先，避免离线缓存过期库存数据。

## 错误与安全

- 未登录请求返回 401；操作员访问管理员接口返回 403。
- 数量不是正整数、箱规无效、SKU 不存在、库存不足、重复 SKU/条码和非法调整分别返回可读错误。
- 数据库错误不向客户端泄露 SQL 或密钥；服务端记录 request id 与通用错误日志。
- 密码、会话 token、数据库连接串不写入客户端、版本库或日志。
- 所有写入使用参数化 SQL；搜索使用参数绑定；Cookie 设置 `HttpOnly`、`SameSite=Lax`、生产环境 `Secure`。

## 测试策略

先用 Vitest 对数量换算、库存状态、入库/出库/调整校验、负库存保护做 TDD。再用 PostgreSQL 集成测试验证事务回滚、流水与余额同步、重复 SKU/条码约束和同一 SKU 并发出库；没有数据库时，单元测试仍可独立运行，集成测试会明确报告环境缺失。最后运行 TypeScript 检查、生产构建，并在本地用 Playwright 检查手机宽度和桌面宽度无横向溢出。

## 需求审查结论

原始说明的核心结构可直接实施。为避免调整语义歧义，本实现约定调整请求提交“实际盘点库存”，服务端计算 `实际盘点库存 - 当前库存` 作为流水变化；零差异不产生流水。扫码、Excel、多仓库、复杂权限仅保留数据和路由扩展位置，不进入 V1。
