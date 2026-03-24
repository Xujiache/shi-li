const app = getApp()
const cache = require('../../../utils/cache')
const { getChildren, getBanners } = require('../../../utils/api')

Page({
  data: {
    banners: [],
    childInfo: {},
    isLoading: true
  },

  onLoad() {
    // 清除旧的轮播图缓存（临时文件路径重启后失效，cloud:// 地址也无法直接渲染）
    cache.removeCache('banners')
    this.loadFromCache()
    this.initData()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && tabBar.updateSelected) tabBar.updateSelected()
    // 返回首页时刷新展示（后台更换轮播/编辑档案后可立即看到）
    if (app.globalData.currentChild) {
      this.setData({ childInfo: app.globalData.currentChild })
    }
    this.fetchBanners()
  },

  onPullDownRefresh() {
    this.initData().then(() => {
        wx.stopPullDownRefresh()
    })
  },

  /** 先从缓存读取数据，立即渲染 */
  loadFromCache() {
    const cachedChild = cache.getCache('current_child')
    if (cachedChild && cachedChild._id) {
      this.setData({ childInfo: cachedChild })
      if (!app.globalData.currentChild) {
        app.globalData.currentChild = cachedChild
      }
    }
    // 轮播图不从缓存加载（临时文件路径重启后失效），由 fetchBanners 实时获取
  },

  async initData() {
    // 1. Get Child Info from Global Data or Cloud
    if (app.globalData.currentChild) {
        this.setData({ childInfo: app.globalData.currentChild })
        cache.setCache('current_child', app.globalData.currentChild)
    } else {
        // Fetch if missing
        await this.fetchChildInfo()
    }
    
    // 2. Fetch Banners
    await this.fetchBanners()
    
    this.setData({ isLoading: false })
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
                // 写入缓存
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
        const rawList = data.list

        // 过滤无效地址
        const list = rawList.filter((b) => {
          const url = b && b.image_url
          if (typeof url !== 'string') return false
          const u = url.trim()
          if (!u) return false
          if (u.startsWith('/pages/')) return false
          return true
        })

        console.log('[首页] 云端返回轮播图数量:', list.length)

        if (list.length === 0) {
          this.setData({ banners: [] })
          return
        }

        const validList = list.filter(Boolean)
        console.log('[首页] 可用轮播图数量:', validList.length)

        if (validList.length === 0) {
          this.setData({ banners: [] })
          return
        }

        this.setData({ banners: validList })
      } else {
        this.setData({ banners: [] })
        console.warn('[首页] 获取轮播图失败')
      }
    } catch (e) {
      this.setData({ banners: [] })
      console.error('[首页] fetchBanners 异常:', e)
    }
  },

  goToAppointment() {
    wx.navigateTo({ url: '/pages/appointment/list/index' })
  },

  goToDashboard() {
    wx.navigateTo({ url: '/pages/dashboard/index/index' })
  },

  /**
   * 跳转到问卷中心 tab 页面。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部执行 tab 切换。
   */
  goToQuestionnaire() {
    wx.switchTab({ url: '/pages/questionnaire/index/index' })
  },

  goToAppointments() {
    wx.navigateTo({ url: '/pages/user/appointments/index' })
  },

  goToRecordArchive() {
    if (app.globalData.currentChild && app.globalData.currentChild._id) {
      wx.navigateTo({ url: `/pages/records/edit/index?child_id=${encodeURIComponent(app.globalData.currentChild._id)}` })
      return
    }
    wx.navigateTo({ url: '/pages/children/select/index?from=record' })
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/edit/index' })
  },

  goSelectChild() {
    wx.navigateTo({ url: '/pages/children/select/index' })
  }
})
