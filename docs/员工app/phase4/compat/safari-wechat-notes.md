# Wave 1-C · iOS Safari + 微信内核 H5 注意事项

> 生成时间：2026-04-28
> 用途：真机走查（NCH-015 / NCH-016）时的核对清单
> 范围：员工 App H5 在线模式（`/employee/` hash 路由 SPA）
> 注：本文档仅记录已知差异与走查要点，**不要求修改前端代码**

---

## 1. iOS Safari（iOS 14 / 16 / 17）

| 要点 | 影响 | 走查动作 |
| --- | --- | --- |
| **viewport-fit** | iPhone X 起的刘海屏 / 灵动岛机型，若不设 `viewport-fit=cover` 顶部 / 底部会留白；当前 H5 仅设 `width=device-width`，未声明 cover | iOS 14 / 16 / 17 真机看顶部状态栏与底部 home indicator 区域；若 tabBar 被遮，记录到 NCH-016 备注（不改前端） |
| **100vh 抖动** | Safari 在地址栏显示 / 隐藏时 `100vh` 数值变化，导致全屏页跳变 | 上下滑动看是否有顶部白条 / 底部抖动；若严重，记录但不修 |
| **`tel:` 拨号** | iOS Safari + 已设 `format-detection: telephone=no`，普通文本里电话号码不会自动可点；必须 `<a href="tel:xxx">` | 点客户详情手机号确认能拉起电话；若无法触发，检查代码是否使用 `tel:` 协议（仅记录） |
| **输入框聚焦缩放** | iOS Safari 当 input `font-size < 16px` 时聚焦自动缩放整页 | 登录页密码框聚焦看是否页面被放大；若是，记录但不改 |
| **hash 路由刷新** | hash 路由不会触发服务器 404；nginx 已 try_files 兜底 | 在子页面（如客户详情）按 Safari "重新加载" 不应 404 |
| **WKWebView 缓存** | iOS PWA 模式下（添加到主屏幕）首次缓存可能粘住旧版本 | 改 H5 后让用户从主屏幕清缓存 / 重新添加 |
| **Pull-to-refresh** | Safari 默认下拉刷新整页；H5 内自定义下拉刷新可能与之冲突 | 客户列表下拉看是否双触发 |
| **Cookie / SameSite** | iOS 14+ 默认 SameSite=Lax，跨域 iframe 会丢 cookie | 当前 H5 同域，不受影响（仅记录） |
| **fixed 定位 + 软键盘** | iOS Safari 软键盘弹出时 fixed 元素位置错乱 | 输入跟进文字时看底部按钮是否被键盘顶飞 |

### iOS Safari 走查最少集合
- iOS 14 / iPhone 8（旧 WebKit）
- iOS 16 / iPhone 12 +
- iOS 17 / iPhone 14 或 15

---

## 2. 微信内置浏览器（X5 + WKWebView 双内核）

| 要点 | 影响 | 走查动作 |
| --- | --- | --- |
| **JSSDK 不需要** | 员工 H5 不调用任何微信 JSSDK 能力（无支付 / 无授权 / 无分享卡片） | 不需要 `wx.config`；走查时确认 console 无 `wx is not defined` 报错 |
| **底部 tabBar 高度差** | 微信底部有自己的"返回 / 关闭"导航条，会与 H5 自带 tabBar 重叠 | 微信 Android（X5）和微信 iOS（WKWebView）分别看 tabBar 是否被微信遮挡；若遮挡，记录但 Phase 4 不强求修复 |
| **video 自动播放限制** | 微信内核禁用所有非用户触发的自动播放（Android X5 也是） | H5 当前无视频 / 自动播放音频，记录确认 |
| **微信内拨号** | 微信内 `<a href="tel:">` 会弹"是否打电话"二次确认 | 客户详情点手机号确认弹窗 → 选"打电话"能拉起电话 |
| **微信安全模式 SSL** | 微信对自签名 / 非标 CA 证书拒绝；HSTS 严格 | 当前内网测试用 IP；正式上线必须 HTTPS + 受信 CA |
| **X5 内核版本** | 微信 Android 用腾讯 X5 内核，可能落后 Chrome 主版本 1~2 个大版本 | console 看 `navigator.userAgent` 截图存档（每个 X5 版本兼容性不同） |
| **navigator.share** | 微信内不可用（被劫持） | 当前 H5 无分享按钮，记录 |
| **back 键 / 微信返回** | Android 物理返回键和微信 webview 顶部返回键不同源 | 测在客户详情按 Android 返回键能否回到列表（hash 路由历史栈） |
| **localStorage 配额** | 微信 X5 单 origin 限 5MB；超过会静默 fail | 当前 H5 在线模式不用大量 localStorage（离线模式只在 APK 内），微信场景安全 |
| **图片自动 WebP** | 微信会把图片自动转 WebP 加速；接口 Content-Type 必须正确 | 客户头像 / 附件预览图加载 OK 即可 |

### 微信走查最少集合
- 微信 Android（X5 内核） / 任一国产机型（如华为 / 小米）
- 微信 iOS（WKWebView） / iPhone 12 +

---

## 3. 不修代码原则下的应对策略

1. **走查只记录，不修代码**：本 Phase 4 兼容性走查的目标是"摸底真实表现"，不是"改前端"。
2. **遇到阻断性问题（如某机型完全白屏）**：单独记到 NCH-XXX 备注 + 截图 + 浏览器 UA + console error，提交至下一阶段（Phase 5）评估是否修复。
3. **遇到非阻断（视觉抖动 / 微小遮挡）**：仅作记录，不阻塞 Phase 4 验收。
4. **走查输出**：将每台真机的 NCH-XXX 结果填回 `native-checklist.md` 模板段，并在 `ACCEPTANCE_员工app.md` §4.3 表格中标 ✅ / ❌。

---

## 4. 应急回退路径（仅当某 H5 浏览器完全不可用）

- 当前部署：`/www/wwwroot/vision-employee-h5/` + nginx + hash 路由，回退成本极低。
- 若发现 iOS 14 Safari 完全白屏：可以临时把入口 `<script type="module">` 退回到 SystemJS 编译产物（uni 框架原生支持）；这是兜底，不在 Phase 4 范围。
- 若发现微信 X5 旧版本（< Chrome 60）报错：在 nginx 加 UA 检测重定向到提示页"请升级微信至最新版"；这是兜底，不在 Phase 4 范围。

---

## 5. 速查清单（真机走查时打印一份）

```text
[ ] Safari 顶部 / 底部安全区无遮挡
[ ] Safari 输入框聚焦不缩放
[ ] Safari 子页面刷新不 404
[ ] tel: 拨号能拉起电话（Safari + 微信）
[ ] hash 路由前进 / 后退正常
[ ] tabBar 不被微信底栏遮挡
[ ] console 无 error / 无 wx undefined
[ ] localStorage / sessionStorage 工作正常
[ ] 200 条客户列表滚动 60 fps
[ ] 软键盘弹出后 fixed 定位无错乱
```
