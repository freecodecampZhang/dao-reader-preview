# 广告变现模块

## 当前状态

- 广告默认关闭，`.env.example` 没有 Publisher ID、广告位 ID、账号、密钥或审批结果。
- 开发环境只显示标有“广告”的占位区域，永不请求广告第三方脚本。
- 正式环境仅在广告总开关、真实平台/广告位配置、用户允许可选广告，以及配置要求的 CMP 同意全部满足时加载。
- 代码和文档预留 Google AdSense 与国内平台适配器。没有任何平台账号接入，也没有广告审核结果。
- `public/ads.txt` 现在只有说明注释。

## 广告位

| 配置名 | 页面位置 | 行为 |
| --- | --- | --- |
| `home` | 首页内容流 | 不覆盖导航或按钮 |
| `bookDetail` | 公共书籍详情页内容流 | 本地书架页不投放 |
| `chapterEnd` | 公共书籍章节正文结束处 | 放在正文流末尾，不固定悬浮 |

私人导入书籍的正文页不会挂载广告位。广告脚本没有接收书名、章节正文或 IndexedDB 内容的业务参数；本地导入 TXT 仍不上传。运营者应把公共内容广告需求限制在合规且适当的位置，并在真实投放前复核平台政策。

## 环境配置入口

在 Cloudflare Pages Production 环境或 GitHub Actions Variables 中配置，不要把占位符当作真实 ID：

```text
VITE_ADS_ENABLED=true
VITE_AD_PROVIDER=adsense        # adsense 或 domestic
VITE_ADSENSE_CLIENT=ca-pub-<账号中的真实 16 位发布商编号>
VITE_AD_SLOT_HOME=<真实首页广告位编号>
VITE_AD_SLOT_BOOK_DETAIL=<真实详情页广告位编号>
VITE_AD_SLOT_CHAPTER_END=<真实章节末广告位编号>
VITE_AD_BLOCKED_ROUTES=/shelf,/privacy,/terms,/contact
VITE_CMP_REQUIRED=true
```

Google 的发布商编号和广告位编号必须从获批账号中复制，不能照抄文档中的格式样例。Google 说明发布商 ID 是账号唯一标识，并用于 ads.txt 设置；见[查找发布商 ID](https://support.google.com/adsense/answer/105516?hl=zh-Hans)。

### 国内广告平台

平台 SDK 各异，此项目提供一个受域名白名单控制的接入契约，不假定任何具体平台账户或审核结果：

```text
VITE_ADS_ENABLED=true
VITE_AD_PROVIDER=domestic
VITE_DOMESTIC_AD_SCRIPT_URL=https://平台提供的正式 SDK 地址
VITE_AD_ALLOWED_HOSTS=平台 SDK 的准确主机名
VITE_DOMESTIC_AD_SLOT_HOME=<真实广告位编号>
VITE_DOMESTIC_AD_SLOT_BOOK_DETAIL=<真实广告位编号>
VITE_DOMESTIC_AD_SLOT_CHAPTER_END=<真实广告位编号>
```

平台集成包需要提供 `window.readerDomesticAdAdapter.mount({ slotId, placement, container })`，并在卸载时返回清理函数。只有 HTTPS 地址且 hostname 精确出现在 `VITE_AD_ALLOWED_HOSTS` 中才通过配置检查。请仅集成供应商提供且经审核的 SDK；不要把供应商任意 HTML 注入正文或工具按钮区域。国内平台的 ads.txt / sellers.json 要求按对应平台真实账号信息执行。

## 用户同意与 CMP

本站页面中的“隐私偏好”保存本设备上的 `optionalAds` 开关；它不是 CMP，也不能授予法规要求的 CMP 同意。广告加载还受 `VITE_CMP_REQUIRED` 控制，默认为 `true`。必需 CMP 时，项目要求外部合规 CMP 适配器提供：

```ts
window.readerPrivacyCmp = {
  hasRequiredAdsConsent: () => boolean,
};
```

适配器应把该函数连接到真实 CMP 的同意状态，并在状态改变后触发：

```js
window.dispatchEvent(new Event('reader-cmp-consent-changed'));
```

不要把此适配器本身、本站偏好条或自行编写的弹窗描述为认证 CMP。针对 EEA、英国、瑞士等适用流量，按广告平台政策选用当前受认可的 CMP，验证对应地区、用途和广告供应商同意后再接入。Google 的现行发布商要求见[EEA、英国和瑞士的 CMP 要求](https://support.google.com/adsense/answer/13554116?hl=zh-Hans)。认证 CMP 清单和规则可能变化，上线时要重新核对。

若有明确地区与法律评估表明当前广告类型无需认证 CMP，可由运营者在部署环境将 `VITE_CMP_REQUIRED=false`；不能仅为让广告显示而关闭该保护。广告开关关闭、没有广告位 ID、缺少 Publisher ID、当前路由在屏蔽清单、用户未允许广告或 CMP 没有确认同意时，组件不加载脚本。

## ads.txt

将广告平台账户提供的原始授权行加入 `public/ads.txt`，构建后会到 `dist/ads.txt`。不要提交虚构 `pub-*` 编号。部署后打开域名根路径 `/ads.txt`，确认文本内容与账号提供的记录一致，再回到平台检查状态。Google 的[官方指南](https://support.google.com/adsense/answer/12171612?hl=zh-Hans)说明要将账号声明放在站点根目录并检查可访问状态；平台回抓状态可能有延迟。

## 广告标识与布局

每个广告位都显示“广告”标签。AdSlot 使用文档流布局，不使用固定定位、不盖住阅读按钮、不将内容设计为诱导点击的按钮。路由屏蔽以路径前缀匹配，例如 `/reader` 会屏蔽 `/reader/<id>`。默认屏蔽书架、隐私、服务条款和联系页面。投放前检查手机与桌面窄宽视口，广告不应抢占阅读主要区域。
