const app = getApp()
const { getChildren, getAppointmentRecords } = require('../../../utils/api')

Page({
  data: {
    appointments: [],
    childInfo: {},
    loading: false
  },

  onShow() {
    this.initChildAndLoad()
  },

  async initChildAndLoad() {
    const cachedId = wx.getStorageSync('current_child_id') || ''
    if (app.globalData.currentChild && (!cachedId || app.globalData.currentChild._id === cachedId)) {
      this.setData({ childInfo: app.globalData.currentChild || {} })
      await this.fetchAppointments()
      return
    }

    try {
      const data = await getChildren()
      if (data && Array.isArray(data.list)) {
        const list = data.list.filter((c) => c && c._id)
        const child = cachedId ? list.find((c) => c._id === cachedId) : list[0]
        if (child) {
          app.globalData.currentChild = child
          wx.setStorageSync('current_child_id', child._id)
          this.setData({ childInfo: child })
          await this.fetchAppointments()
          return
        }
      }
      this.setData({ childInfo: {}, appointments: [] })
    } catch (e) {
      console.error(e)
      this.setData({ childInfo: {}, appointments: [] })
    }
  },

  goSelectChild() {
    wx.navigateTo({ url: '/pages/children/select/index' })
  },

  goToBook() {
    wx.navigateTo({ url: '/pages/appointment/list/index' })
  },

  async fetchAppointments() {
    const childId = this.data.childInfo && this.data.childInfo._id
    if (!childId) {
      this.setData({ appointments: [] })
      return
    }

    this.setData({ loading: true })
    try {
      const data = await getAppointmentRecords(childId)
      this.setData({ appointments: data && Array.isArray(data.list) ? data.list : [] })
    } catch (e) {
      console.error(e)
      this.setData({ appointments: [] })
      wx.showToast({ title: e && e.message ? String(e.message) : '网络异常', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
