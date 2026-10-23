# 公共书库批量收录与审核

普通访客的“我的书架 → 导入 TXT”仍是纯本地操作：文件正文和阅读记录保存在当前设备的 IndexedDB，不会发送到网站。管理员后台是独立的受密码保护的功能，上传文件先进入私有草稿区，只有管理员完成内容审核和三项发布确认后，访客才能看到书目及读取正文。

## Cloudflare 资源准备

本功能使用 Pages Functions、D1 和私有 R2。Pages Functions 可通过 D1/R2 binding 访问资源；Functions 使用项目内的 `functions/` 文件路由。参阅 [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/) 和 [文件路由](https://developers.cloudflare.com/pages/functions/routing/)。

1. 在 Cloudflare **Storage & databases → D1** 创建生产数据库，例如 `dao-reader-library`。
2. 在 D1 控制台的 Query 页面按顺序执行 `migrations/0001_public_library.sql` 和 `migrations/0002_book_version_metadata.sql`。书目表保存版本与审核资料，不存 TXT 正文。
3. 在 **R2 Object Storage** 创建桶，例如 `dao-reader-private-books`。保持桶为私有，不连接公开自定义域名，也不要启用公开开发 URL。TXT 正文由 Functions 根据数据库的 `published` 状态受控读取。
4. 打开 **Workers & Pages → dao-reader-preview → Settings → Bindings**，添加：

   | Binding 类型 | Variable name | 资源 |
   | --- | --- | --- |
   | D1 database | `DB` | 上一步创建的生产数据库 |
   | R2 bucket | `BOOKS` | 上一步创建的私有 R2 桶 |

5. 对 Preview 环境使用单独的测试 D1 数据库和 R2 桶，避免预览部署读取或改动生产草稿。保存后重新部署 Pages 项目，使新 binding 生效。

R2 bucket 默认不公开；请勿为了阅读接口而开放整个桶。Functions 只允许读取数据库中已发布且三项确认均有效的书籍正文。参阅 [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)。

## 管理员密钥

在 Pages 项目 **Settings → Variables and Secrets** 的 Production 环境设置管理员账号和两个 **Secret**：

- `ADMIN_USERNAME`：可选的普通文本变量；未设置时管理员账号为 `admin`。选择自定义账号时请妥善记录。
- `ADMIN_PASSWORD`：至少 16 个字符、仅管理员使用的强唯一密码，不要复用 Cloudflare、GitHub 或邮箱密码。
- `ADMIN_SESSION_SECRET`：至少 32 字节的随机值，用于签发 8 小时、HttpOnly、Secure、SameSite=Strict 的会话 Cookie。

管理员登录地址为 `/admin`。代码库不包含默认密码，也不能读取 Cloudflare 已保存的 Secret；忘记密码时，在 Cloudflare 中设置新的 `ADMIN_PASSWORD` Secret 后重新部署。

可在本机终端生成随机会话密钥，然后直接粘贴到 Cloudflare Secret 输入框；不要把它提交到 Git 或发到聊天：

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

登录失败记录保存的是由密钥计算的短期不可逆 IP 摘要，15 分钟内最多允许每个来源尝试 8 次。若密钥缺失、短于 32 字节、D1/R2 未绑定或数据库迁移未执行，管理员 API 会关闭并返回配置错误，不会接收或发布书籍。

## SEO 与生产变量

如要让已发布的动态书籍详情进入搜索引擎，设置以下运行时变量（不要在 Preview 中开启）：

```text
PUBLIC_SITE_URL=https://dao-reader-preview.pages.dev
PUBLIC_INDEXING_ENABLED=true
```

同时设置构建变量 `VITE_SITE_URL` 为相同的规范 HTTPS 地址，并在确认网站内容与运营信息可公开索引后设置 `VITE_INDEXING_ENABLED=true`。`PUBLIC_INDEXING_ENABLED` 控制动态书籍页的服务器端 title、description、canonical、Book JSON-LD 和 `/sitemap.xml` 动态条目；关闭时动态书籍保持 `noindex`。管理员、读者书架和 API 路径都不进入站点地图。

索引关闭期间，功能仍可使用；只是搜索引擎不索引网站。公共目录同时显示静态 `public/catalog.json` 中已审核的旧内容与数据库中动态发布的书籍。

## 日常操作

1. 部署完成后访问 `https://dao-reader-preview.pages.dev/admin`，使用 `ADMIN_USERNAME`（默认 `admin`）与 `ADMIN_PASSWORD` 登录。后台入口不放在公共导航里。
2. 选择一个或多个 `.txt` 文件。单文件上限 6 MB，单次最多 20 本且总量上限 12 MB。文件保存为私有草稿，初始状态对公众不可见。
3. 选择“预览正文”核对正文与章节解析，逐本填写书名、作者、朝代、分类和简介；选择文字（简体/繁体）、版本类型（古籍 TXT/校勘本/原版影印）并填写具体底本。
4. 核对目录、末章及正文，勾选“全文完整”核实项；填写可核对的原始来源和明确的公开使用许可。仅写“来源于网络”“待确认”不能发布。审查授权凭据后，再逐本勾选文本发布权、商业使用权及网站公开发布审批。
5. 选择“审核并发布”。服务器会再次校验版本类型、底本、全文确认、来源、许可和三项权利确认；缺少任一项会拒绝发布。已发布书籍的详情页会展示版本资料。
6. 选择“撤下”会把书籍改回私有草稿并从公共目录与动态 sitemap 移除。已经下载到访客设备的阅读副本不会被远程擦除。
7. 未发布草稿可以“删除”；已发布书籍需先撤下再删除。定期备份 D1 和 R2，并根据隐私政策配置数据保留与处理流程。

发布确认只是站点的操作门槛，不代表版权、许可、广告或法律审核已经由第三方完成。只有在你实际核实权利后再逐项确认。

## 验收

- 未登录访问 `/api/admin/books` 返回 401；未配置 D1/R2/Secret 时管理员后台显示未配置状态。
- 管理员可预览正文，未登录访问管理员正文接口应被拒绝；公开正文接口对草稿返回 404。
- 新上传书籍应只出现在管理员“待审核草稿”，不能出现在 `/category`、`/api/public/catalog` 或 `/sitemap.xml`，正文接口应返回 404。
- 发布且确认三项权利后，书籍出现在公共目录并可打开；未勾齐任一项时发布接口拒绝请求。
- 发布接口还应拒绝缺少作者、朝代、文字类型、版本类型、底本、全文完整确认、原始来源或公开许可的书籍；发布书籍详情页应展示已保存的版本资料。
- 撤下后公共目录和正文接口不再返回该书；草稿不会由静态构建复制到 `dist`。
- 普通书架本地导入时，浏览器网络面板不应出现包含本地 TXT 正文的上传请求。

`functions` 在本机通过 `npm run check:functions` 做 TypeScript 检查。完整部署准备、HTTPS、SPA 刷新和 GitHub 自动部署步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。
