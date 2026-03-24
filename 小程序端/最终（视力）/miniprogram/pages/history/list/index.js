const app = getApp()
const cache = require('../../../utils/cache')
const { getChildren, getCheckupRecords } = require('../../../utils/api')

Page({
  data: {
    childInfo: {},
    records: []
  },

  onLoad() {
    // 首次进入由 onShow 触发加载，避免 onLoad+onShow 重复请求
  },

  onPullDownRefresh() {
    this.initData().finally(() => wx.stopPullDownRefresh())
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && tabBar.updateSelected) tabBar.updateSelected()
    // 修复：从"记录档案/看板"等页面返回或切换 Tab 时，自动刷新最新记录
    this.loadFromCache()
    this.initData()
  },

  /** 先从缓存加载，秒开页面 */
  loadFromCache() {
    const child = app.globalData.currentChild
    const childId = (child && child._id) || wx.getStorageSync('current_child_id') || ''
    if (!childId) return

    if (child) this.setData({ childInfo: child })

    const cachedRecords = cache.getCache('records_' + childId)
    if (Array.isArray(cachedRecords) && cachedRecords.length > 0) {
      const processed = this.processTrend(cachedRecords)
      this.setData({ records: processed })
    }
  },

  async initData() {
    if (app.globalData.currentChild) {
      this.setData({ childInfo: app.globalData.currentChild })
    } else {
      await this.fetchChildInfo()
    }

    await this.fetchRecords()
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
        } else {
          this.setData({ childInfo: {} })
        }
      } else {
        this.setData({ childInfo: {} })
      }
    } catch (e) {
      console.error(e)
    }
  },

  async fetchRecords() {
    if (!this.data.childInfo._id) {
      this.setData({ records: [] })
      return
    }
    
    wx.showLoading({ title: '加载数据...' })
    try {
      const data = await getCheckupRecords(this.data.childInfo._id)
      wx.hideLoading()

      if (data && Array.isArray(data.list)) {
        const rawRecords = data.list
        const processedRecords = this.processTrend(rawRecords)
        this.setData({ records: processedRecords })
        // 写入缓存
        cache.setCache('records_' + this.data.childInfo._id, rawRecords)
      } else {
        this.setData({ records: [] })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      console.error(e)
      this.setData({ records: [] })
    }
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/edit/index' })
  },

  goToDashboard() {
    wx.navigateTo({ url: '/pages/dashboard/index/index' })
  },

  goToRecord(e) {
    const recordId = e.currentTarget.dataset.recordId
    if (recordId) {
      wx.navigateTo({ url: `/pages/dashboard/index/index?record_id=${encodeURIComponent(recordId)}` })
    } else {
      wx.navigateTo({ url: '/pages/dashboard/index/index' })
    }
  },

  processTrend(records) {
    // records are ordered by date desc (latest first)
    // We need to compare current record with the *next* one in the array (which is older)
    
    return records.map((record, index) => {
      const prevRecord = records[index + 1] // The older record
      
      if (!prevRecord) return record // No previous data to compare
      
      // Compare Vision L
      if (record.vision_l && prevRecord.vision_l) {
        if (parseFloat(record.vision_l) > parseFloat(prevRecord.vision_l)) {
          record.trend_vision_l = 'up'
        } else if (parseFloat(record.vision_l) < parseFloat(prevRecord.vision_l)) {
          record.trend_vision_l = 'down'
        }
      }
      
      // Compare Vision R
      if (record.vision_r && prevRecord.vision_r) {
        if (parseFloat(record.vision_r) > parseFloat(prevRecord.vision_r)) {
          record.trend_vision_r = 'up'
        } else if (parseFloat(record.vision_r) < parseFloat(prevRecord.vision_r)) {
          record.trend_vision_r = 'down'
        }
      }
      
      return record
    })
  }
})
