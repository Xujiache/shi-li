const app = getApp()
const {
  getChildren,
  getAppointmentItems,
  getAppointmentSchedules,
  createAppointment
} = require('../../../utils/api')

Page({
  data: {
    childInfo: {},
    childName: '',
    childClass: '',
    appointmentItems: [],
    schedules: [],
    itemIndex: null,
    scheduleIndex: null,
    phone: '',
    presetItemId: null
  },

  onLoad(options) {
    this.setData({ presetItemId: options && options.item_id ? options.item_id : null })
    this.initData()
  },

  onPullDownRefresh() {
    this.initData().finally(() => wx.stopPullDownRefresh())
  },

  async initData() {
    const cachedId = wx.getStorageSync('current_child_id') || ''
    if (app.globalData.currentChild && (!cachedId || app.globalData.currentChild._id === cachedId)) {
      this.setData({
        childInfo: app.globalData.currentChild,
        childName: app.globalData.currentChild.name || '',
        childClass: app.globalData.currentChild.class_name || ''
      })
    } else {
      await this.fetchChildInfo()
    }

    if (app.globalData.userInfo && app.globalData.userInfo.phone && !this.data.phone) {
      this.setData({ phone: app.globalData.userInfo.phone })
    }

    await this.fetchAppointmentItems()
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
          this.setData({
            childInfo: child,
            childName: child.name || '',
            childClass: child.class_name || ''
          })
        }
      }
    } catch (e) {
      console.error(e)
    }
  },

  async fetchAppointmentItems() {
    try {
      const data = await getAppointmentItems()
      if (data && Array.isArray(data.list)) {
        const list = data.list
        this.setData({ appointmentItems: list })

        if (this.data.presetItemId) {
          const idx = list.findIndex((i) => i && i._id === this.data.presetItemId)
          if (idx >= 0) {
            this.setData({
              itemIndex: idx,
              scheduleIndex: null,
              schedules: []
            })
            this.fetchSchedules(list[idx]._id)
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  },

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ [field]: value })
  },

  onItemPickerChange(e) {
    const index = e.detail.valueIndex
    if (Number.isNaN(index) || index < 0) return
    this.setData({
      itemIndex: index,
      scheduleIndex: null,
      schedules: []
    })
    this.fetchSchedules(this.data.appointmentItems[index]._id)
  },

  onSchedulePickerChange(e) {
    const index = e.detail.valueIndex
    if (Number.isNaN(index) || index < 0) return
    this.setData({ scheduleIndex: index })
  },

  onItemChange(e) {
    this.onItemPickerChange({ detail: { valueIndex: Number(e.detail.value) } })
  },

  async fetchSchedules(itemId) {
    wx.showLoading({ title: '加载时间...' })
    try {
      const data = await getAppointmentSchedules(itemId)
      wx.hideLoading()
      if (data && Array.isArray(data.list)) {
        const schedules = data.list.map((s) => ({
          ...s,
          displayTime: `${s.date} ${s.time_slot} (剩${s.max_count - s.booked_count})`
        }))
        this.setData({ schedules })
      }
    } catch (e) {
      wx.hideLoading()
      console.error(e)
    }
  },

  onScheduleChange(e) {
    this.onSchedulePickerChange({ detail: { valueIndex: Number(e.detail.value) } })
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  async submitAppointment() {
    if (!this.data.childInfo._id) {
      wx.showToast({ title: '请先完善档案', icon: 'none' })
      return
    }

    if (this.data.itemIndex === null || this.data.scheduleIndex === null || !this.data.phone || !this.data.childName || !this.data.childClass) {
      wx.showToast({ title: '请完善预约信息', icon: 'none' })
      return
    }

    const schedule = this.data.schedules[this.data.scheduleIndex]
    const item = this.data.appointmentItems[this.data.itemIndex]

    wx.showLoading({ title: '提交预约...' })
    try {
      await createAppointment({
        schedule_id: schedule._id,
        child_id: this.data.childInfo._id
      })
      wx.hideLoading()
      wx.showModal({
        title: '成功',
        content: '预约申请已提交，工作人员将尽快与您确认！',
        showCancel: false,
        success: () => {
          this.fetchSchedules(item._id)
          this.setData({ scheduleIndex: null })
        }
      })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e && e.message ? String(e.message) : '网络异常', icon: 'none' })
      console.error(e)
    }
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/edit/index' })
  }
})
