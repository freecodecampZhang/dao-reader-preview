# Cloudflare Pages 部署与运维

本文针对仓库 `freecodecampZhang/dao-reader-preview`。GitHub 仓库的默认生产分支是 `main`；Cloudflare Pages 应连接该仓库的 `main` 分支。

## 先确认部署目标

Cloudflare 现在同时提供 Pages 和 Workers 的 Git 部署入口。此项目是静态 Vite 网站，要创建 **Pages 项目**：在 **Workers & Pages → Create application** 页面，选择底部 **Continue to Pages**，再选择 **Connect to Git**。不要从通用的 **Connect GitHub** / Workers Builds 流程创建 Worker。

部署后应能看到 Pages 项目及 `https://<项目名>.pages.dev` 域名。若项目详情在 Workers 服务页面、发布命令是 `npx wrangler deploy`、域名是 `workers.dev`，那是 Worker 部署，不是本文配置的 Pages 站点。Cloudflare 的入口说明见[Pages Git 集成指南](https://developers.cloudflare.com/pages/configuration/git-integration/)及[Workers Builds 文档](https://developers.cloudflare.com/workers/ci-cd/builds/)。

## 首次创建 Pages 项目

1. 打开 Cloudflare Dashboard 的 **Workers & Pages**，选中目标账号。
2. 选择 **Create application → Continue to Pages → Connect to Git**，按提示完成 GitHub 授权。
3. 选择 `freecodecampZhang/dao-reader-preview`，项目名填写 `dao-reader-preview`（若名称被占用则使用可用名称），生产分支选择 `main`。
4. 配置构建：

   | 设置 | 值 |
   | --- | --- |
   | Framework preset | React (Vite) |
   | Root directory | `/`（仓库根目录） |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node.js version | `22` |

5. 保存并等待首个部署完成。在项目的 **Deployments** 中确认构建成功，并打开 `*.pages.dev` 地址检查首页。

Pages 的 Vite 构建命令和输出目录可参考[Cloudflare Pages 构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)。

## 日常发布

Cloudflare Pages Git 集成会在 `main` 有新提交时构建并发布生产站点；其他分支通常生成预览部署。常规发布流程：

1. 在本地完成修改，并运行 `npm ci`、`npm test`、`npm run build`。
2. 将已审阅的提交合并或推送到 GitHub 的 `main` 分支。
3. 在 Cloudflare **Workers & Pages → dao-reader-preview → Deployments** 查看构建状态和日志。
4. 构建成功后打开最新 `pages.dev` 部署地址，确认关键页面与路由。

Cloudflare Git 集成不需要 Cloudflare API Token。项目已有 `.github/workflows/pages-deployment.yml` 作为可选的 GitHub Actions 发布方案，但默认因缺少 `CF_PAGES_PROJECT_NAME` 而跳过；**不要同时启用 Actions 发布与 Cloudflare Git 集成**，避免一次提交产生两套部署。

### 可选：改用 GitHub Actions 发布

仅在明确选择 Actions 而非 Cloudflare 原生 Git 集成时配置：

- GitHub Actions secret `CLOUDFLARE_API_TOKEN`：只授予目标账号 Pages 编辑权限。
- GitHub Actions secret `CLOUDFLARE_ACCOUNT_ID`：从 Cloudflare 账号信息读取。
- GitHub Actions variable `CF_PAGES_PROJECT_NAME`：Pages 项目名，例如 `dao-reader-preview`。未设置时部署步骤会跳过。
- 如需公开站点、广告或联系方式配置，再按下文及 [AD_MONETIZATION.md](./AD_MONETIZATION.md) 设置对应变量。

该工作流在 `main` 或 `master` 推送时运行 `npm ci`、`npm test`、`npm run build`，再用 Wrangler 发布 `dist`。不要把 Token 放入源码、聊天、`.env` 提交或 Cloudflare Pages 普通变量中。

## 构建与内容边界

项目使用 Node.js 22。`npm run build` 会执行前端与 Pages Functions TypeScript 检查，再运行 Vite 和 `scripts/generate-site.mjs` 生成 `dist`。生成脚本只处理公开页面和审核过的 `public/catalog.json` 内容；仓库根目录中的 TXT、用户导入 TXT、阅读进度与书架数据不属于公开构建内容。普通用户本地导入没有上传 API；另有一个独立的管理员批量收录流程，先写入私有 R2 草稿，需完成审核后才能发布。设置 Pages Functions 时请按 [PUBLIC_LIBRARY_ADMIN.md](./PUBLIC_LIBRARY_ADMIN.md) 建立 D1 / R2 bindings 和管理员 secrets。

生产构建变量在 Cloudflare Pages 项目 **Settings → Environment variables → Production** 配置；预览环境使用独立 Preview 变量。`.env.example` 仅列变量名，不含任何账号或广告 ID。

```text
VITE_SITE_URL=https://你的正式域名
VITE_INDEXING_ENABLED=false
VITE_CONTACT_EMAIL=真实可用的联系邮箱
```

只有在正式 HTTPS 域名、公开内容审核及法律检查完成后，才将 `VITE_INDEXING_ENABLED` 改为 `true`。索引关闭时站点生成禁止抓取规则；正式发布后检查 `/robots.txt` 与 `/sitemap.xml`。Sitemap 不应包含 `/shelf`、`/reader` 或本地导入书籍。

## 自定义域名与 HTTPS

1. 打开 Pages 项目 **Custom domains → Set up a domain**，登记正式域名。
2. Apex 域名需要 Cloudflare zone 与 Cloudflare nameservers；子域名可按面板指示配置 DNS。不要只添加 CNAME 而跳过 Pages 项目内的域名登记。
3. 等待证书状态正常后，用 `https://` 打开域名；再将 `VITE_SITE_URL` 设置为唯一正式 canonical 域名。
4. 如同时提供 `www` 和 apex 域名，选择一个主域并配置重定向。

`public/_headers` 为静态资源设置安全响应头。HSTS 使用 `includeSubDomains`；确认所有子域名均支持 HTTPS 后再使用该策略。

## 路由、资源和上线验收

Pages 项目需保留 SPA 回退能力；仓库不生成顶级 `404.html`，并为公共页面生成带 SEO metadata 的静态 HTML。完成部署后直接访问并刷新：

- `/about/`、`/guide/`、`/category/`、`/articles/reading-guide/`
- 存在审核通过的公开书籍时，检查 `/books/<slug>/`
- `/shelf/`、`/reader/<book-id>` 应由应用接管，并保持 `noindex` / 不进入 sitemap
- `/robots.txt`、`/sitemap.xml`、`/ads.txt`
- 配置后检查 `/admin`、`/api/admin/session` 与 `/api/public/catalog`；未登录的管理员 API 应拒绝请求，草稿正文不得通过公开接口读取

本地生产预览可运行 `npm run start`，只服务 `dist` 并提供应用路由回退。Cloudflare 发布后检查手机 Safari 与桌面直接刷新路由、HTTPS、安全响应头及浏览器控制台。上线前其余检查见 [PRELAUNCH_CHECKLIST.md](./PRELAUNCH_CHECKLIST.md)。

## ads.txt

当前 `public/ads.txt` 仅含说明注释，不含虚构卖方声明。只有广告平台审核通过并提供正式内容后，才将原始授权行加入该文件。部署后打开 `https://你的正式域名/ads.txt`，检查状态码为 200、返回内容与账号提供的记录一致，再到广告平台确认回抓状态。参阅 [Google ads.txt 指南](https://support.google.com/adsense/answer/12171612?hl=zh-Hans) 和 [AD_MONETIZATION.md](./AD_MONETIZATION.md)。
