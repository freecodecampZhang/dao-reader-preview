# Cloudflare Pages 部署

## 构建产物

使用 Node.js 22 和 npm：

```bash
npm ci
npm test
npm run build
```

Pages 构建设置：

- Framework preset：`React` / `Vite`
- Build command：`npm run build`
- Build output directory：`dist`
- Root directory：仓库根目录
- Node version：`22`

构建包括 TypeScript 检查、Vite 生产包和 `scripts/generate-site.mjs`。末尾脚本只从空的/审核通过的 `public/catalog.json` 生成可公开目录、页面 SEO 壳、站点地图和 robots 文件。项目根目录的 TXT 不进入 `dist`。本站没有后端上传 API。

## GitHub 自动部署

推荐在 Cloudflare Pages 中直接关联 GitHub 仓库。关联时选择 `master` 作为生产分支，并配置上面的构建命令、输出目录和 Node 版本。该方式由 Cloudflare 自动构建，无需创建 Cloudflare API Token。

仓库另附 `.github/workflows/pages-deployment.yml` 作为 GitHub Actions 发布方案，在 `master` 或 `main` 推送时依次执行 `npm ci`、`npm test`、`npm run build`，然后通过 Wrangler 发布 `dist`。仅在选择 Actions 方案时，才需要在 GitHub 仓库设置中配置：

**Actions secrets**

- `CLOUDFLARE_API_TOKEN`：仅授予目标账户 Pages 编辑权限的 Token。
- `CLOUDFLARE_ACCOUNT_ID`：从 Cloudflare 账户面板读取。

**Actions variables**

- `CF_PAGES_PROJECT_NAME`：Cloudflare Pages 项目名。未配置时部署 Job 会跳过。
- `VITE_SITE_URL`、`VITE_INDEXING_ENABLED`：站点正式域名与索引开关。
- 广告与联系变量：仅在真实配置准备好之后设置，详见 [AD_MONETIZATION.md](./AD_MONETIZATION.md)。

使用 Cloudflare Git 集成时，Production branch 设为 `master`，并在 Pages 项目环境变量中配置相同的 `VITE_*` 变量。不要同时启用 Actions 发布和 Cloudflare Git 集成，以免重复部署。

## 环境变量和索引

仓库中的 `.env.example` 只列变量名，没有任何账号或广告 ID。正式发布前，在 Cloudflare Pages 的 Production 环境配置：

```text
VITE_SITE_URL=https://你的真实域名
VITE_INDEXING_ENABLED=true
```

第一次部署、预览环境、尚未完成内容/法律审核时保持 `VITE_INDEXING_ENABLED=false`。默认构建会生成 `Disallow: /`，不生成可索引 URL；没有 HTTPS 站点根域名时即使误打开该开关，构建器仍禁用索引。正式发布后检查 `https://你的真实域名/robots.txt` 与 `/sitemap.xml`。站点地图只包含公开页面、文章，以及同时通过权利标记与文件存在校验的公共书籍；不包含 `/shelf`、`/reader` 或本地导入书籍。

`VITE_CONTACT_EMAIL` 设置真实可用的对外邮箱。运营主体、版权和适用地区信息由网站运营者根据真实情况补全，不要使用示例身份或虚构联系方式。

## 独立域名与 HTTPS

1. 在 Cloudflare Dashboard 打开 **Workers & Pages → 目标 Pages 项目 → Custom domains → Set up a domain**，添加真实域名。
2. Apex 域名需要将域名作为 Cloudflare zone 并使用 Cloudflare nameservers；子域名可以在 DNS 提供商添加 CNAME 指向 `<项目名>.pages.dev`。仍需先在 Pages 项目中登记该自定义域名，不能只创建 CNAME。
3. 等待 Pages 为域名签发并启用 HTTPS 证书；确认 `https://` 可用后再设置 `VITE_SITE_URL` 和打开索引开关。
4. 如需 `www` 与 apex 统一，单独配置重定向并确认 canonical URL 只使用一个主域名。

Pages 会按 `public/_headers` 提供基础安全响应头。HSTS 包含 `includeSubDomains`；如果域名下有尚未启用 HTTPS 的子域名，先移除此标记或确认它们也支持 HTTPS，再上线。

## SPA 路由刷新验证

Pages 在没有顶级 `404.html` 时会把未匹配路由交给 SPA；仓库没有创建 `404.html`。构建还会为公开页面生成带独立 SEO metadata 的静态 HTML。发布后直接打开并刷新以下 URL，确认返回对应页面而非 404：

- `/about/`
- `/guide/`
- `/category/`
- `/articles/reading-guide/`
- 有审核通过内容时的 `/books/<slug>/`
- `/shelf/` 和 `/reader/<book-id>` 应由应用接管，但不应被索引

生产预览也可用 `npm run start` 检查，它只服务 `dist` 且对应用路由回退到入口。确认响应中 `/shelf/` 带 `noindex,nofollow`，阅读路由由 `robots.txt` 禁止抓取。

## ads.txt 验证

当前 `public/ads.txt` 只包含说明注释，不含虚构卖方声明。只有广告平台批准站点并提供正式声明后，才将平台原文加入该文件。部署后访问 `https://你的真实域名/ads.txt`，确认返回纯文本、状态码 200，并与账号中的 `ads.txt` 状态核对。具体 AdSense 发布商声明格式与回查时间以 [Google 官方 ads.txt 指南](https://support.google.com/adsense/answer/12171612?hl=zh-Hans) 为准。

## 上线后快速复核

- 检查首页、书架、公共目录和隐私/服务条款页面。
- 检查手机 Safari 与桌面直接刷新路由。
- 选取一份自有 TXT 导入，确认设备网络请求没有上传文件正文。
- 检查 HTTPS、安全响应头、`robots.txt`、`sitemap.xml` 和 `/ads.txt`。
- 按 [PRELAUNCH_CHECKLIST.md](./PRELAUNCH_CHECKLIST.md) 完成内容权利、经营许可、CMP 与运营信息核验。
