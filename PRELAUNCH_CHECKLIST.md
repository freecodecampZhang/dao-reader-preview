# 实际上线前检查清单

以下需要网站运营者提供真实信息或在 Cloudflare/GitHub 账号中完成；代码库里没有这些账号权限、许可或审核结果。

## 运营、内容和法律信息

- [ ] 确认网站运营主体名称、联系邮箱、主体登记与适用地区。
- [ ] 确认发布书籍的版权、公开传播权及商业展示权；静态书籍应在 `public/catalog.json` 逐项确认审核字段，管理员上传书籍应在 `/admin` 逐项审核发布。
- [ ] 核实公共内容的来源、授权凭据、编辑校对和下架流程；不要将私人导入 TXT 填入公共目录或上传到管理员书库。
- [ ] 每本动态发布书籍都填写作者、朝代、简繁体、版本类型、底本、可核对的原始来源和明确公开许可；核实全文完整后再勾选确认。
- [ ] 按实际运营地区确认经营许可、备案、版权投诉处理、隐私政策和服务条款内容。当前页面明确运营信息待补充，不应直接当作法律审查完成。
- [ ] 配置可用的 `VITE_CONTACT_EMAIL` 并测试收件。

## 隐私与广告

- [ ] 决定是否启用广告；未获平台批准时保持 `VITE_ADS_ENABLED=false`。
- [ ] 如果启用，取得并复核真实 Publisher ID、广告位 ID、账号状态、平台条款和页面策略。当前代码不代表广告已获审核或允许投放。
- [ ] 根据流量地区接入并测试适用 CMP；核验适用的 EEA、英国、瑞士用户同意信号。在验证前保持 `VITE_CMP_REQUIRED=true`，不要把本站偏好界面作为 CMP。
- [ ] 仅将平台账号正式提供的 seller 行加入 `public/ads.txt`，部署后访问根路径核对状态。
- [ ] 在 390×844、430×932、1440×900 确认广告标签、页面流、路由屏蔽和正文按钮均正常。

## 发布和域名

- [ ] 创建的是 Cloudflare Pages 项目（可访问 `*.pages.dev`），而不是使用 `npx wrangler deploy` 发布的 Worker。
- [ ] Pages 构建设置为 Node.js 22、`npm run build`、输出目录 `dist`、根目录 `/`；GitHub 仓库 `freecodecampZhang/dao-reader-preview` 的生产分支为 `main`。
- [ ] 选择 Cloudflare Git 集成或 GitHub Actions 其中一种发布方式，不要同时启用。仅选择 Actions 时才配置 Cloudflare API Token、Account ID 和项目名。
- [ ] 绑定正式域名，确认 DNS 与 HTTPS 证书有效。
- [ ] 设置 `VITE_SITE_URL` 为唯一正式 HTTPS canonical 域名；完成内容和页面审查后才开启 `VITE_INDEXING_ENABLED=true`。
- [ ] 检查 `/robots.txt`、`/sitemap.xml`、`/ads.txt`；确认 sitemap 不含 `/shelf`、`/reader`、私人书名或本地 TXT 路径。
- [ ] 检查 `/articles/` 导读索引和每篇文章的来源链接、搜索结果；确认 `/search` 不进入 sitemap，搜索结果不含本地 TXT。
- [ ] 直接访问并刷新 `/about/`、`/guide/`、`/category/`、文章与已发布书籍详情，以及 `/shelf/`、`/reader/<id>`。
- [ ] 检查 `X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、`Permissions-Policy` 和 HSTS；确认 HSTS 的 `includeSubDomains` 符合域名规划。

## 数据与验收

- [ ] 用本地 TXT 完成导入、章节解析、搜索、书签、删除和刷新后进度恢复。
- [ ] 在浏览器开发者工具确认本地导入 TXT 不通过网络发送，且广告未配置时没有任何第三方广告脚本请求。
- [ ] 在 390×844、430×932 和 1440×900 检查无横向溢出、导航和主要按钮可操作、阅读器参考视觉未被营销样式覆盖。
- [ ] 在生产预览环境检查浏览器控制台、网络请求、书架/收藏持久化和错误页面。
- [ ] 按 `PUBLIC_LIBRARY_ADMIN.md` 配置 D1、私有 R2、独立 Preview 资源、`ADMIN_PASSWORD` 与 `ADMIN_SESSION_SECRET`；依次运行 `0001_public_library.sql` 和 `0002_book_version_metadata.sql` 后重新部署。
- [ ] 验证管理员未登录不可列出或修改书籍；批量上传只创建私有草稿；未勾齐发布确认时接口拒绝发布。
- [ ] 验证发布后公共目录、正文与动态 sitemap 可读，撤下后不再出现在目录或新正文请求中。
- [ ] 打开公开书籍详情核对版本信息、全文完整性、来源及公开许可的展示内容准确。
