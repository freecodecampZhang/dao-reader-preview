# 古籍阅读 Web 阅读器

React + TypeScript + Vite 的本地优先古籍 / 小说 TXT 阅读器及公共内容网站。原有的阅读器、TXT 编码与章节解析、目录抽屉、纸张翻页、书签和阅读进度继续使用 IndexedDB 本地存储。

## 本地启动

```powershell
npm ci
npm run dev
```

打开终端显示的 Vite 地址。生产预览：

```powershell
npm run build
npm run start
```

`npm run build` 会先做 TypeScript 检查并构建到 `dist`，然后生成静态 SEO 路由、`sitemap.xml` 和 `robots.txt`。`npm run start` 只提供 `dist` 静态文件和 SPA 路由回退，不扫描也不暴露仓库目录下的 TXT。Cloudflare Pages 使用相同的构建命令与 `dist` 输出目录。

## 本地书与公共书库

- “我的书架”中导入的 TXT、解析章节、书签和进度保存在当前浏览器的 IndexedDB，不会上传到服务器。
- 已审核的旧公共书籍来自 `public/catalog.json`；管理员新增书籍通过 Cloudflare Pages Functions + D1 + 私有 R2 管理。公共访问只返回已发布且 `rightsConfirmed`、`commercialRightsConfirmed`、`publicationApproved` 全为真的条目。
- 当前清单为空。不要把私人导入的 TXT 或未经许可的第三方小说加入 `public/library` 或公共清单。构建器仅将通过发布门槛的公共正文复制到 `dist/library`。
- 普通访客的个人导入仍留在 IndexedDB；管理员上传的内容先进入私有草稿，审核发布前不可被公开 API 读取。收藏和阅读进度继续保存在访客本地 IndexedDB。
- “古籍导读”和全站搜索只查找本站原创文章与已经审核的公共书目，不会搜索或上传访客本地 TXT。
- 管理后台位于 `/admin`，只供管理员直接访问，可预览草稿正文、编辑书目信息、审核发布与撤下；Cloudflare 资源与密钥配置见 [PUBLIC_LIBRARY_ADMIN.md](./PUBLIC_LIBRARY_ADMIN.md)。

## 阅读功能

支持 TXT 文件和文件夹导入、GB18030/GBK 与常见 BOM 编码、中文章节解析、目录抽屉、书内全文搜索、目录跳转、书签、阅读进度恢复、纸张翻页、主题和排版设置。项目内 `CODEX_TASK.md` 与 `design/reader-toc-reference.png` 是原始阅读器需求与参考图；阅读器模块保持在 `src/pages/ReaderPage.tsx` 和 `src/components/ReaderTocSheet.tsx`。

## 站点及上线

- 首页：`/`；本地书架：`/shelf`；公共书库：`/category`；全站搜索：`/search`；古籍导读：`/articles` 与 `/articles/:slug`；公开书籍详情：`/books/:slug`。
- 阅读指南：`/guide`；关于、联系、隐私和服务条款：`/about`、`/contact`、`/privacy`、`/terms`。
- 发布前默认禁止搜索引擎索引。真实 HTTPS 域名配置 `VITE_SITE_URL` 并经运营者确认后，才设置 `VITE_INDEXING_ENABLED=true`。
- 广告默认关闭，开发环境只显示无脚本占位。生产广告需要真实平台配置、用户偏好和所需 CMP 同意；仓库没有 Publisher ID、广告位 ID、账号或审核结果。

部署和日常发布步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)，公共书库审核与上传见 [PUBLIC_LIBRARY_ADMIN.md](./PUBLIC_LIBRARY_ADMIN.md)，广告配置见 [AD_MONETIZATION.md](./AD_MONETIZATION.md)，上线前检查见 [PRELAUNCH_CHECKLIST.md](./PRELAUNCH_CHECKLIST.md)。

## 检查

```powershell
npm test
npm run build
```
