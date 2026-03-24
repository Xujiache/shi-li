# CONSENSUS_global_page_transition_motion

## 1. 最终共识
- 本次不启用 `Skyline`，不做高风险自定义路由迁移。
- 采用“全局统一入场动画 + 路由类型区分 + tabBar 切换反馈增强”的兼容方案。
- 动画风格以“轻弹、浮入、柔和减速、分层出现”为核心，目标是让切页更灵动但不眩晕。

## 2. 验收标准
- 所有通过 `wx.navigateTo`、`wx.redirectTo`、`wx.reLaunch`、`wx.switchTab`、`wx.navigateBack` 触发的页面显示过程，都能获得统一的入场过渡效果。
- 不同路由类型具有轻微差异化的动效方向或节奏。
- 自定义 `tabBar` 点击切换时有更明显的反馈动画。
- 不影响现有页面业务逻辑。
- 不引入新增报错或明显卡顿。

## 3. 技术共识
- 在 `app.js` 中统一包装路由 API，记录最近一次路由动作类型。
- 在全局 `Page` 包装中结合 `onShow` 调用官方 `this.animate()` 对根容器执行关键帧动画。
- 在 `app.wxss` 中补强全局基础动画、层次浮现和触摸反馈风格。
- 在 `custom-tab-bar` 中增加选中态与点击态动效。
