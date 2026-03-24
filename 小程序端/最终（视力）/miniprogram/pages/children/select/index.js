const app = getApp()
const cache = require('../../../utils/cache')
const { getChildren, deleteChild } = require('../../../utils/api')

Page({
  data: {
    children: [],
    selectedChildId: '',
    from: ''
  },

  onLoad(options) {
    this.setData({ from: options && options.from ? String(options.from) : '' })
  },

  onShow() {
    const selected = wx.getStorageSync('current_child_id') || ''
    this.setData({ selectedChildId: selected })
    this.fetchChildren()
  },

  async fetchChildren() {
    wx.showLoading({ title: '加载中...' })
    try {
      const data = await getChildren()
      wx.hideLoading()
      if (data && Array.isArray(data.list)) {
        const list = data.list.filter((c) => c && c._id)

        const selectedChildId = this.data.selectedChildId
        const nextSelected = selectedChildId && list.some((c) => c._id === selectedChildId)
          ? selectedChildId
          : (list[0] ? list[0]._id : '')

        this.setData({ children: list, selectedChildId: nextSelected })
        if (nextSelected) {
          const child = list.find((c) => c._id === nextSelected)
          if (child) {
            wx.setStorageSync('current_child_id', nextSelected)
            app.globalData.currentChild = child
          }
        }
      }
    } catch (e) {
      wx.hideLoading()
      console.error(e)
    }
  },

  onSelect(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const child = (this.data.children || []).find((c) => c && c._id === id)
    this.setData({ selectedChildId: id })
    wx.setStorageSync('current_child_id', id)
    if (child) {
      app.globalData.currentChild = child
      // 写入缓存，确保下次打开秒开
      cache.setCache('current_child', child)
    }
  },

  onContinue() {
    if (!this.data.selectedChildId) return

    if (this.data.from === 'record') {
      const pages = getCurrentPages() || []
      const prev = pages.length >= 2 ? pages[pages.length - 2] : null
      if (prev && prev.route === 'pages/records/edit/index') {
        wx.navigateBack({ delta: 1 })
        return
      }

      wx.navigateTo({ url: `/pages/records/edit/index?child_id=${encodeURIComponent(this.data.selectedChildId)}` })
      return
    }

    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.reLaunch({ url: '/pages/home/index/index' })
      }
    })
  },

  onAdd() {
    wx.navigateTo({
      url: '/pages/profile/edit/index?from=child_select'
    })
  },

  onManage(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showActionSheet({
      itemList: ['设为当前', '编辑档案', '删除孩子'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          this.onSelect({ currentTarget: { dataset: { id } } })
          return
        }
        if (res.tapIndex === 1) {
          wx.navigateTo({
            url: `/pages/profile/edit/index?id=${encodeURIComponent(id)}&from=child_select`
          })
          return
        }
        if (res.tapIndex === 2) {
          wx.showModal({
            title: '删除孩子',
            content: '删除后该孩子档案将无法恢复，确定删除吗？',
            success: async (m) => {
              if (!m.confirm) return
              wx.showLoading({ title: '删除中...' })
              try {
                await deleteChild(id)
                wx.hideLoading()
                if (this.data.selectedChildId === id) {
                  wx.removeStorageSync('current_child_id')
                  app.globalData.currentChild = null
                  this.setData({ selectedChildId: '' })
                }
                wx.showToast({ title: '已删除' })
                this.fetchChildren()
              } catch (e) {
                wx.hideLoading()
                wx.showModal({
                  title: '删除失败',
                  content: e && e.message ? String(e.message) : '请稍后重试',
                  showCancel: false
                })
              }
            }
          })
        }
      }
    })
  }
})

