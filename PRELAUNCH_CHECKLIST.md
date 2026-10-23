# 实际上线前检查清单

以下需要网站运营者提供真实信息或在 Cloudflare/GitHub 账号中完成；代码库里没有这些账号权限、许可或审核结果。

## 运营、内容和法律信息

- [ ] 确认网站运营主体名称、联系邮箱、主体登记与适用地区。
- [ ] 确认发布书籍的版权、公开传播权及商业展示权；在 `public/catalog.json` 对应条目中逐项确认审核字段，正文仅放入 `public/library/<slug>.txt`。
- [ ] 核实公共内容的来源、授权凭据、编辑校对和下架流程；不要将私人导入 TXT 填入公共目录。
- [ ] 按实际运营地区确认经营许可、备案、版权投诉处理、隐私政策和服务条款内容。当前页面明确运营信息待补充，不应直接当作法律审查完成。
- [ ] 配置可用的 `VITE_CONTACT_EMAIL` 并测试收件。

## 隐私与广告

- [ ] 决定是否启用广告；未获平台批准时保持 `VITE_ADS_ENABLED=false`。
- [ ] 如果启用，取得并复核真实 Publisher ID、广告位 ID、账号状态、平台条款和页面策略。当前代码不代表广告已获审核或允许投放。
- [ ] 根据流量地区接入并测试适用 CMP；核验适用的 EEA、英国、瑞士用户同意信号。在验证前保持 `VITE_CMP_REQUIRED=true`，不要把本站偏好界面作为 CMP。
- [ ] 仅将平台账号正式提供的 seller 行加入 `public/ads.txt`，部署后访问根路径核对状态。
- [ ] 在 390×844、430×932、1440×900 确认广告标签、页面流、路由屏蔽和正文按钮均正常。

## 发布和域名

- [ ] 在 Cloudflare Pages 项目设置 `npm run build` 和 `dist`。
- [ ] 在 GitHub Actions 配置 Cloudflare Pages API Token 与 Account ID secrets、项目名变量；或使用 Pages 自带 GitHub 集成，不要同时部署。
- [ ] 绑定正式域名，确认 DNS 与 HTTPS 证书有效。
- [ ] 设置 `VITE_SITE_URL` 为唯一正式 HTTPS canonical 域名；完成内容和页面审查后才开启 `VITE_INDEXING_ENABLED=true`。
- [ ] 检查 `/robots.txt`、`/sitemap.xml`、`/ads.txt`；确认 sitemap 不含 `/shelf`、`/reader`、私人书名或本地 TXT 路径。
- [ ] 直接访问并刷新 `/about/`、`/guide/`、`/category/`、文章与已发布书籍详情，以及 `/shelf/`、`/reader/<id>`。
- [ ] 检查 `X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、`Permissions-Policy` 和 HSTS；确认 HSTS 的 `includeSubDomains` 符合域名规划。

## 数据与验收

- [ ] 用本地 TXT 完成导入、章节解析、搜索、书签、删除和刷新后进度恢复。
- [ ] 在浏览器开发者工具确认本地导入 TXT 不通过网络发送，且广告未配置时没有任何第三方广告脚本请求。
- [ ] 在 390×844、430×932 和 1440×900 检查无横向溢出、导航和主要按钮可操作、阅读器参考视觉未被营销样式覆盖。
- [ ] 在生产预览环境检查浏览器控制台、网络请求、书架/收藏持久化和错误页面。
