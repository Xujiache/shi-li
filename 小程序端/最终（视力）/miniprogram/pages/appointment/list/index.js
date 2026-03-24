const { getAppointmentItems } = require('../../../utils/api')

Page({
  data: {
    items: []
  },

  onLoad() {
    this.fetchItems()
  },

  onPullDownRefresh() {
    this.fetchItems().finally(() => wx.stopPullDownRefresh())
  },

  async fetchItems() {
    try {
      const data = await getAppointmentItems()
      if (data && Array.isArray(data.list)) {
        const list = data.list
        const activeList = list.filter((i) => i && i.active !== false)
        this.setData({ items: activeList })
      }
    } catch (e) {
      console.error(e)
    }
  },

  goToBook(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    wx.navigateTo({
      url: `/pages/appointment/book/index?item_id=${id}&item_name=${encodeURIComponent(name)}`
    })
  }
})

