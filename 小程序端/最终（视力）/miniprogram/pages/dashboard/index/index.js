const app = getApp()
const cache = require('../../../utils/cache')
const { getChildren, getCheckupRecords } = require('../../../utils/api')

Page({
  data: {
    childInfo: {},
    latestRecord: null,
    previousRecord: null,
    records: [],
    compare: {
      vision_l: '',
      vision_r: ''
    },
    // 指定查看的记录 ID（从数据页点击某条记录进入时传入）
    targetRecordId: '',
    /** 骨架屏加载状态：无缓存时显示骨架屏，有缓存秒开 */
    isLoading: true
  },

  onLoad(options) {
    // 如果从数据页点击某条记录进入，接收 record_id 参数
    if (options && options.record_id) {
      this.setData({ targetRecordId: options.record_id })
    }
    // 先从缓存加载
    this.loadFromCache()
  },

  onShow() {
    // 从"记录档案"等页面返回时刷新最新数据
    this.initData()
  },

  onPullDownRefresh() {
    this.initData().finally(() => wx.stopPullDownRefresh())
  },

  /**
   * 先从缓存加载数据秒开。
   * 命中缓存时直接关闭骨架屏，否则保持 isLoading=true。
   */
  loadFromCache() {
    const child = app.globalData.currentChild
    const childId = (child && child._id) || wx.getStorageSync('current_child_id') || ''
    if (!childId) return

    if (child) this.setData({ childInfo: child })

    const cachedRecords = cache.getCache('records_' + childId)
    if (Array.isArray(cachedRecords) && cachedRecords.length > 0) {
      this.applyRecords(cachedRecords)
      this.setData({ isLoading: false })
    }
  },

  /**
   * 初始化页面数据：获取档案信息和检查记录。
   * 完成后关闭骨架屏。
   * @returns {Promise<void>}
   */
  async initData() {
    if (app.globalData.currentChild) {
      this.setData({ childInfo: app.globalData.currentChild })
    } else {
      await this.fetchChildInfo()
    }

    await this.fetchRecords()

    // 数据加载完毕，关闭骨架屏
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
        }
      }
    } catch (e) {
      console.error(e)
    }
  },

  async fetchRecords() {
    if (!this.data.childInfo._id) {
      this.setData({ latestRecord: null, previousRecord: null, records: [], compare: { vision_l: '', vision_r: '' } })
      return
    }

    try {
      const data = await getCheckupRecords(this.data.childInfo._id)
      if (data && Array.isArray(data.list)) {
        const list = data.list
        this.applyRecords(list)
        // 写入缓存
        cache.setCache('records_' + this.data.childInfo._id, list)
      } else {
        this.setData({ latestRecord: null, previousRecord: null, records: [], compare: { vision_l: '', vision_r: '' } })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    } catch (e) {
      console.error(e)
      this.setData({ latestRecord: null, previousRecord: null, records: [], compare: { vision_l: '', vision_r: '' } })
    }
  },

  /**
   * 将记录列表应用到页面数据
   * 如果有 targetRecordId，则以该记录作为"当前记录"展示，前一条作为对比
   * 否则默认展示最新记录
   */
  applyRecords(list) {
    const normalize = (r) => {
      if (!r) return null
      return {
        ...r,
        refraction_l: r.refraction_l || {},
        refraction_r: r.refraction_r || {},
        diagnosis: r.diagnosis || {}
      }
    }

    let currentIdx = 0
    const targetId = this.data.targetRecordId
    if (targetId) {
      const idx = list.findIndex((r) => r && r._id === targetId)
      if (idx >= 0) currentIdx = idx
    }

    const current = normalize(list[currentIdx])
    // 对比记录：该条的下一条（更早的记录）
    const prev = normalize(list[currentIdx + 1])

    this.setData({ records: list, latestRecord: current, previousRecord: prev })
    this.updateCompare(current, prev)
  },

  updateCompare(latest, prev) {
    const getTrend = (a, b) => {
      const x = parseFloat(a)
      const y = parseFloat(b)
      if (Number.isNaN(x) || Number.isNaN(y)) return ''
      if (x > y) return '↑'
      if (x < y) return '↓'
      return '—'
    }

    if (!latest || !prev) {
      this.setData({ compare: { vision_l: '', vision_r: '' } })
      return
    }

    this.setData({
      compare: {
        vision_l: getTrend(latest.vision_l, prev.vision_l),
        vision_r: getTrend(latest.vision_r, prev.vision_r)
      }
    })
  },

  goToHistory() {
    // 历史记录是 Tab 页，使用 switchTab 确保刷新 onShow
    wx.switchTab({ url: '/pages/history/list/index' })
  },

  goToNewRecord() {
    const id = this.data.childInfo && this.data.childInfo._id
    const url = id ? `/pages/records/edit/index?child_id=${encodeURIComponent(id)}` : '/pages/records/edit/index'
    wx.navigateTo({ url })
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/edit/index' })
  }
})
