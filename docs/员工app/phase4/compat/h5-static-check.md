# Wave 1-C · H5 兼容性静态预检报告

> 生成时间：2026-04-28
> 部署位置：`/www/wwwroot/vision-employee-h5/`
> 访问地址：`http://127.0.0.1:8080/employee/`
> 本机环境：Linux Ubuntu，nginx/1.24.0
> 关联文档：`docs/员工app/ACCEPTANCE_员工app.md` §4.3

---

## 0. 环境探测

```bash
$ which chromium chromium-browser google-chrome 2>&1
# (空输出)
$ command -v chromium chromium-browser google-chrome
# (无任何二进制)
```

**结论：服务器无 chromium / google-chrome 二进制，按既定方案降级为情况 B —— 静态资源 + curl 方式校验。**
（约束：不安装新 npm 包 / 系统包，不改前端代码。）

真正的 headless 渲染、console error、首屏耗时等指标，需在带浏览器的真机或本地开发机执行；本预检仅保证 H5 静态层一切就绪。

---

## 1. 检查矩阵

| # | 检查项 | 检查命令 / 方法 | 实测 | 通过 |
| --- | --- | --- | --- | --- |
| 1 | 主页 HTTP 200 | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/employee/` | `200` | ✅ |
| 2 | HTML 含 `<title>视力员工</title>` | `grep -c '视力员工' /tmp/h5_index.html` | `1` | ✅ |
| 3 | HTML 含 `<!DOCTYPE html>` 与 `lang="zh-CN"` | `head -2 /tmp/h5_index.html` | 命中 | ✅ |
| 4 | viewport meta 正确（width=device-width / initial-scale=1.0 / user-scalable=no） | `grep -c 'width=device-width' /tmp/h5_index.html` | `1` | ✅ |
| 5 | iOS PWA meta（apple-mobile-web-app-capable=yes / status-bar-style=black） | `grep -c 'apple-mobile-web-app-capable' /tmp/h5_index.html` | `1` | ✅ |
| 6 | format-detection=telephone=no（避免 iOS Safari 误识别号码） | `grep format-detection /tmp/h5_index.html` | 命中（与"长按手机号→拨号"逻辑配合） | ✅ |
| 7 | publicPath 正确（`/employee/`） | `grep -c '/employee/assets/' /tmp/h5_index.html` | `3`（uni.css + index.js + index.css 三处全量） | ✅ |
| 8 | hash 路由模式（H5 单页） | `grep -A2 '"router"' src/manifest.json` | `mode: "hash", base: "/employee/"` | ✅ |
| 9 | 入口 JS 200（`assets/index-CTF2WP3l.js`） | `curl -s -o /dev/null -w "%{http_code}"` | `200` | ✅ |
| 10 | 入口 CSS 200（`assets/index-B9EJiTwp.css`） | 同上 | `200` | ✅ |
| 11 | uni 框架 CSS 200（`assets/uni.73246636.css`） | 同上 | `200` | ✅ |
| 12 | tab 图标 home / customer / followup / message / me（×2 active） 共 10 张 | `for f in ...; do curl ... done` | 全部 `200` | ✅ |
| 13 | `<div id="app"></div>` 挂载点存在 | `grep -c '<div id="app">'` | `1` | ✅ |
| 14 | nginx 响应头含 `Cache-Control: no-cache, no-store, must-revalidate` | `curl -I http://127.0.0.1:8080/employee/` | 命中（保证版本切换不被缓存） | ✅ |
| 15 | `module` + `crossorigin` 模块加载（现代浏览器） | `grep 'type="module" crossorigin'` | 命中 | ✅ |
| 16 | （可选）chromium headless 截图 | 无 chromium → N/A | 跳过 | ⏭️ |
| 17 | （可选）console error 检测 | 无 chromium → N/A，需真机 / 浏览器 DevTools | 跳过 | ⏭️ |

**实测：15 / 15 必检项全部通过；2 项可选项（chromium 渲染）受限于本机环境，已转入 §2 真机清单 NCH-015。**

---

## 2. 关键产物字节级对账

```text
homepage size      : 905 bytes
publicPath 出现次数: 3 (uni.css + index.js + index.css)
所有静态资源响应  : 14/14 = 200
nginx Server       : nginx/1.24.0 (Ubuntu)
Last-Modified      : 2026-04-28 11:05:29 UTC
```

入口 HTML 关键片段（已抓回 `/tmp/h5_index.html`）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="/employee/assets/uni.73246636.css">
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="format-detection" content="telephone=no,email=no,date=no,address=no" />
    <title>视力员工</title>
    <script type="module" crossorigin src="/employee/assets/index-CTF2WP3l.js"></script>
    <link rel="stylesheet" crossorigin href="/employee/assets/index-B9EJiTwp.css">
  </head>
  <body><div id="app"></div></body>
</html>
```

---

## 3. 风险与建议

| 级别 | 项 | 描述 | 建议 |
| --- | --- | --- | --- |
| 低 | 无 chromium 渲染 | 本机无法跑 headless 校验，无法验证 JS 运行时 console error / 首屏白屏 | 由前端开发机或真机 Chrome / iOS Safari / 微信走查（NCH-015） |
| 低 | `module` 模块脚本 | 不兼容 IE11 与极旧 Android（< 5）的旧 WebView，需走 V3 编译时已处理 | Android 5 真机走查（ACCEPTANCE §4.3 第 1 行） |
| 低 | `apple-mobile-web-app-status-bar-style=black` | iOS 14+ 添加到主屏后状态栏黑色；老 iOS 下不影响 | 走查 iOS 14 真机时确认是否需要切 `black-translucent` |
| 信息 | viewport 锁 1.0~1.0 | 禁用用户缩放；Safari 16+ 在表单聚焦时仍可能触发 | 真机走查输入框聚焦行为（NCH-015 子项） |

---

## 4. 结论

**H5 静态层 PASS。** 所有静态资源、入口 HTML、publicPath、tab 图标、router 配置均正确，可以进入真机走查阶段。
真机阶段重点见 `native-checklist.md` 与 `safari-wechat-notes.md`。
