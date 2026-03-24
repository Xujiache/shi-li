# CONSENSUS_global_page_transition_remove

## 1. 最终共识
- 移除 `miniprogram/app.js` 中用于全局页面入场的路由动作记录和 `this.animate()` 关键帧转场。
- 移除 `miniprogram/app.wxss` 中页面级 fallback 动画和容器子节点分层浮入动画。
- 简化 `custom-tab-bar` 切页反馈，仅保留选中颜色与轻量高亮，不保留抬升、缩放、脉冲反馈。
- 保留现有页面访问埋点和 tab 切换业务逻辑，不改动页面路径与数据流。

## 2. 验收标准
- 所有通过 `wx.navigateTo`、`wx.redirectTo`、`wx.reLaunch`、`wx.switchTab`、`wx.navigateBack` 触发的页面显示过程不再出现弹性入场动画。
- `tabBar` 切换时不再出现 pulse、图标抬升或回弹缩放。
- 页面访问埋点仍正常保留。
- 不引入新的运行报错、样式错乱或业务回归。

## 3. 技术共识
- 使用最小改动策略，直接删除全局转场实现，而不是追加“禁用开关”。
- 对 `custom-tab-bar` 只保留颜色和透明度级别的轻量反馈，避免再次产生“像动效没关干净”的感受。
- 文档层新建独立任务集，保留历史“加动画”任务记录，同时新增本次“去动画”任务记录。
