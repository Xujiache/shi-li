# ALIGNMENT_global_page_transition_motion: 小程序全局页面过渡动画优化

## 1. 项目上下文分析

### 1.1 目标范围
- 目标端：`小程序端\最终（视力）\miniprogram`
- 目标诉求：
  - 优化页面之间跳转时的生硬感
  - 让全站页面切换更柔和、更有层次、更有动感

### 1.2 当前现状
- 当前 `app.wxss` 仅存在非常轻量的 `pageFadeIn` 动画，持续时间短，层次感较弱。
- 项目使用自定义 `tabBar`，但切换反馈较基础。
- 当前项目 `project.private.config.json` 中 `skylineRenderEnable` 为 `false`，未启用 Skyline。

### 1.3 官方能力确认
- 已查阅微信开放文档：
  - 非 Skyline 路径下，原生跨页转场不适合做高风险深度定制。
  - 页面/组件可使用官方 `this.animate(selector, keyframes, duration)` 实现关键帧动画。
  - 页面生命周期可依赖 `onShow`、`onReady` 等时机触发过渡。

## 2. 原始需求
- 美化所有界面之间的跳转动画，不要那么生硬，要求非常生动。

## 3. 需求理解（可执行）
- **本次目标**：
  - 不切换渲染引擎，不启用 Skyline。
  - 在当前架构下实现“全局统一的页面入场动效体系”。
  - 覆盖主要路由动作：
    - `navigateTo`
    - `redirectTo`
    - `reLaunch`
    - `switchTab`
    - `navigateBack`
  - 同步增强自定义 `tabBar` 的切换反馈。

## 4. 决策与约束
- 不进行 Skyline 改造，避免全站兼容性与测试范围失控。
- 优先在 `app.js`、`app.wxss` 和 `custom-tab-bar` 做全局增强，减少逐页侵入。
- 使用微信官方支持的关键帧动画能力，不编造非官方跨页动画能力。
- 动画要“生动”，但不能牺牲可读性和交互稳定性。

## 5. 任务边界
- **包含**：
  - 全局路由类型识别
  - 页面根容器统一入场动画
  - 全局基础动效风格升级
  - 自定义 `tabBar` 切换反馈增强
- **不包含**：
  - Skyline 自定义路由改造
  - 每个页面单独编排复杂故事板动画
  - 后端接口、数据结构改造
