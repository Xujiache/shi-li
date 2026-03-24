# ALIGNMENT_global_page_transition_remove

## 1. 原始需求
- 用户要求去除所有页面跳转时的弹性动画，明确反馈当前视觉效果“太难看了”。

## 2. 任务边界
- 纳入范围：
  - `miniprogram/app.js` 中全局页面转场与路由动作记录逻辑
  - `miniprogram/app.wxss` 中页面级和容器级全局入场动画
  - `miniprogram/custom-tab-bar/*` 中与切页联动的 pulse、抬升、缩放反馈
  - 本次任务相关文档与 `说明文档.md`
- 不纳入范围：
  - 单页内部业务动画与普通按钮交互
  - 页面布局、配色和业务流程调整
  - 新增其他替代性跨页动画方案

## 3. 现状理解
- `app.js` 当前通过包装 `wx.navigateTo`、`wx.redirectTo`、`wx.reLaunch`、`wx.switchTab`、`wx.navigateBack` 记录最近一次路由动作。
- 每个页面在 `onShow` 中都会执行 `this.animate()`，对 `.container` 与 `.page` 根容器播放带回弹曲线的关键帧。
- `app.wxss` 中还定义了 `pageRevealSoft` 与 `sectionFloatIn`，页面和容器子节点都会执行二次浮入。
- 自定义 `tabBar` 存在 `pulse`、图标抬升、选中态缩放与高光放大，切换主导航时会叠加弹性感。

## 4. 需求理解
- 本次目标不是弱化现有转场，而是让页面跳转恢复为直接切换，不再出现全局回弹、浮入、脉冲式观感。
- 可以保留 tab 选中颜色和静态高亮，但不能保留位移、缩放、回弹关键帧。

## 5. 疑问澄清
- 当前需求语义明确，无需额外决策点，按“彻底去除全局页面跳转弹性动画”执行即可。
