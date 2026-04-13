const { trackEvent } = require('./utils/api')

// app.js
// —— 轻量埋点：自动记录页面访问（用于后台仪表盘统计）——
const __trackLast = {}
const __TRACK_DEBOUNCE_MS = 8000

function __trackPageView(route) {
  try {
    const page = route ? String(route) : ''
    if (!page) return
    const now = Date.now()
    const last = __trackLast[page] || 0
    if (now - last < __TRACK_DEBOUNCE_MS) return
    __trackLast[page] = now

    trackEvent({ type: 'page_view', page }).catch(() => {})
  } catch (e) {
    // ignore
  }
}

// 全局 Page 包装：自动在 onShow 上报访问
if (!wx.__visionPageWrapped) {
  const __RawPage = Page
  Page = function (config) {
    const oldOnShow = config.onShow

    config.onShow = function () {
      __trackPageView(this && this.route)
      if (typeof oldOnShow === 'function') return oldOnShow.apply(this, arguments)
    }

    return __RawPage(config)
  }
  wx.__visionPageWrapped = true
}

App({
  /** 兼容旧页面逻辑：优先从 storage 获取当前登录用户 ID。 */
  getCloudUserContext() {
    try {
      let uid = wx.getStorageSync('current_user_id')
      if (!uid && this.globalData.userInfo && this.globalData.userInfo._id) {
        uid = this.globalData.userInfo._id
        wx.setStorageSync('current_user_id', uid)
      }
      return uid ? { user_id: String(uid) } : {}
    } catch (e) {
      return {}
    }
  },
  globalData: {
    userInfo: null,
    currentChild: null,
    apiBaseUrl: 'http://127.0.0.1:3000/api/v1',
    __tabbarList: [
      {
        pagePath: 'pages/home/index/index',
        text: '首页',
        iconPath: '/images/icons/home-tab.svg',
        selectedIconPath: '/images/icons/home-tab-active.svg'
      },
      {
        pagePath: 'pages/history/list/index',
        text: '数据',
        iconPath: '/images/icons/data-tab.svg',
        selectedIconPath: '/images/icons/data-tab-active.svg'
      },
      {
        pagePath: 'pages/questionnaire/index/index',
        text: '问卷',
        iconPath: '/images/icons/question-tab.svg',
        selectedIconPath: '/images/icons/question-tab-active.svg'
      },
      {
        pagePath: 'pages/user/index/index',
        text: '我的',
        iconPath: '/images/icons/user-tab.svg',
        selectedIconPath: '/images/icons/user-tab-active.svg'
      }
    ]
  },
  onLaunch: function () {
    // Node 后端模式下不再初始化微信云开发。
  }
})
