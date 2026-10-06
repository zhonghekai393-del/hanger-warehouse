# GitHub Pages 部署和手机使用

## 公网地址

项目发布成功后访问：

<https://zhonghekai393-del.github.io/hanger-warehouse/>

第一次打开需要联网，让网页文件和 Service Worker 完成缓存；之后本机可以在短暂断网时继续读写本地库存。

## GitHub 设置

仓库：<https://github.com/zhonghekai393-del/hanger-warehouse>

在 GitHub 仓库中打开 `Settings → Pages`，将 `Build and deployment → Source` 设置为 `GitHub Actions`。之后向 `main` 分支推送代码，`.github/workflows/deploy-pages.yml` 会自动检查、构建并发布 `out/`。

## 第一次导入现有数据

1. 在保留现有数据库的电脑上运行 `pnpm db:export-local -- backups/current-local.json`。
2. 打开上面的公网地址，进入“本机设置”。
3. 点击“导入备份”，选择 `current-local.json`。
4. 核对系列、型号、库存和流水数量后确认导入。
5. 导入完成后，抽查一条入库、一条出库和一条调整记录。

备份文件只在本地使用，不能提交到公开 GitHub 仓库。`.env`、数据库密码和客户库存数据也不能提交。

## 日常备份

在清除浏览器网站数据、卸载浏览器、换手机或换浏览器前，先进入“本机设置”导出 JSON 备份。导入备份会替换当前设备上的本地数据，必须先核对备份时间和记录数量。

同一个网址在另一台手机上会创建独立的本地数据库，不会自动同步；需要通过“导出备份”和“导入备份”转移数据。

## 数据边界

这个版本是单人本地模式：完整出入库记录和库存操作保留，但没有多人协作、云端同步、账号找回或服务端权限控制。GitHub Pages 只提供程序文件，不保存客户库存数据。
