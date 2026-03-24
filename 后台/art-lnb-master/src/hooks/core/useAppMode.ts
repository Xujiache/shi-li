/**
 * useAppMode - 应用模式管理
 *
 * 提供应用访问模式的判断和管理功能，支持前端和后端两种权限控制模式。
 * 根据环境变量 VITE_ACCESS_MODE 自动识别当前运行模式。
 *
 * ## 主要功能
 *
 * 1. 模式识别 - 自动识别前端模式或后端模式
 * 2. 前端模式 - 权限由前端路由配置控制，适合小型项目或演示环境
 * 3. 后端模式 - 权限由后端接口返回的菜单数据控制，适合企业级应用
 * 4. 响应式状态 - 提供响应式的模式判断，方便在组件中使用
 *
 * @module useAppMode
 * @author Art Design Pro Team
 */

import { computed } from 'vue'

export function useAppMode() {
  // 获取访问模式配置（trim 避免 .env 中空格导致误判；未配置时视为 frontend）
  const raw = import.meta.env.VITE_ACCESS_MODE
  const accessMode = typeof raw === 'string' ? raw.trim() : ''

  /**
   * 是否为前端控制模式
   * 前端模式：权限由前端路由配置控制
   */
  const isFrontendMode = computed(() => accessMode === 'frontend')
  /**
   * 是否为后端控制模式
   * 后端模式：权限由后端接口返回的菜单数据控制。仅明确为 backend 时为 true。
   */
  const isBackendMode = computed(() => accessMode === 'backend')

  /**
   * 当前应用模式
   */
  const currentMode = computed(() => accessMode || 'frontend')

  return {
    isFrontendMode,
    isBackendMode,
    currentMode
  }
}
