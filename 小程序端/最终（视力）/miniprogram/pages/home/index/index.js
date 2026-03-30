const app = getApp()
const cache = require('../../../utils/cache')
const { getChildren, getBanners } = require('../../../utils/api')
const { getAuthToken } = require('../../../utils/request')

Page({
  data: {
    banners: [],
    childInfo: {},
    /** 骨架屏加载状态 */
    isLoading: true,
    /** 是否已登录 */
    isLoggedIn: false
  },

  onLoad() {
    cache.removeCache('banners')
    this.loadFromCache()
    this.initData()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && tabBar.updateSelected) tabBar.updateSelected()

    // 每次显示时重新检查登录状态（登录后返回首页时刷新）
    const loggedIn = this.checkLoginStatus()
    this.setData({ isLoggedIn: loggedIn })

    if (loggedIn) {
      if (app.globalData.currentChild) {
        this.setData({ childInfo: app.globalData.currentChild })
      } else {
        this.fetchChildInfo()
      }
    }
    this.fetchBanners()
  },

  onPullDownRefresh() {
    this.initData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 检查是否已登录。
   * @returns {boolean} 是否登录。
   */
  checkLoginStatus() {
    const token = getAuthToken()
    const userId = wx.getStorageSync('current_user_id')
    return !!(token && userId)
  },

  /**
   * 需要登录的操作 - 检查是否登录，未登录则跳转登录。
   * @returns {boolean} 是否可继续操作。
   */
  requireLogin() {
    if (this.checkLoginStatus()) return true
    wx.navigateTo({ url: '/pages/auth/login/index' })
    return false
  },

  loadFromCache() {
    const cachedChild = cache.getCache('current_child')
    if (cachedChild && cachedChild._id) {
      this.setData({ childInfo: cachedChild, isLoading: false })
      if (!app.globalData.currentChild) {
        app.globalData.currentChild = cachedChild
      }
    }
  },

  async initData() {
    const loggedIn = this.checkLoginStatus()
    this.setData({ isLoggedIn: loggedIn })

    if (loggedIn) {
      if (app.globalData.currentChild) {
        this.setData({ childInfo: app.globalData.currentChild })
        cache.setCache('current_child', app.globalData.currentChild)
      } else {
        await this.fetchChildInfo()
      }
    }

    await this.fetchBanners()

    if (this.data.isLoading) {
      this.setData({ isLoading: false })
    }
  },

  async fetchChildInfo() {
    try {
      const data = await getChildren()
      if (data && Array.isArray(data.list) && data.list.length > 0) {
        const list = data.list.filter((c) => c && c._id)
        const cachedId = wx.getStorageSync('current_child_id') || ''
        const child = cachedId ? list.find((c) => c._id === cachedId) : list[0]
        if (child) {
          app.globalData.currentChild = child
          wx.setStorageSync('current_child_id', child._id)
          this.setData({ childInfo: child })
          cache.setCache('current_child', child)
          cache.setCache('children_list', list)
        }
      } else {
        console.log('User has no profile yet')
      }
    } catch (e) {
      console.error(e)
    }
  },

  async fetchBanners() {
    try {
      const data = await getBanners()
      if (data && Array.isArray(data.list)) {
        const list = data.list.filter((b) => {
          const url = b && b.image_url
          if (typeof url !== 'string') return false
          const u = url.trim()
          if (!u || u.startsWith('/pages/')) return false
          return true
        }).filter(Boolean)

        this.setData({ banners: list })
      } else {
        this.setData({ banners: [] })
      }
    } catch (e) {
      this.setData({ banners: [] })
      console.error('[首页] fetchBanners 异常:', e)
    }
  },

  /** 跳转登录页 */
  goToLogin() {
    wx.navigateTo({ url: '/pages/auth/login/index' })
  },

  goToAppointment() {
    if (!this.requireLogin()) return
    wx.navigateTo({ url: '/pages/appointment/list/index' })
  },

  goToDashboard() {
    if (!this.requireLogin()) return
    wx.navigateTo({ url: '/pages/dashboard/index/index' })
  },

  goToQuestionnaire() {
    if (!this.requireLogin()) return
    wx.switchTab({ url: '/pages/questionnaire/index/index' })
  },

  goToAppointments() {
    if (!this.requireLogin()) return
    wx.navigateTo({ url: '/pages/user/appointments/index' })
  },

  goToRecordArchive() {
    if (!this.requireLogin()) return
    if (app.globalData.currentChild && app.globalData.currentChild._id) {
      wx.navigateTo({ url: `/pages/records/edit/index?child_id=${encodeURIComponent(app.globalData.currentChild._id)}` })
      return
    }
    wx.navigateTo({ url: '/pages/children/select/index?from=record' })
  },

  goToProfile() {
    if (!this.requireLogin()) return
    wx.navigateTo({ url: '/pages/profile/edit/index' })
  },

  goSelectChild() {
    if (!this.requireLogin()) return
    wx.navigateTo({ url: '/pages/children/select/index' })
  }
})
