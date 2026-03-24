Component({
  data: {
    selected: 0,
    list: [],
    safeBottom: 0
  },

  lifetimes: {
    attached() {
      const app = getApp()
      const list = (app && app.globalData && app.globalData.__tabbarList) || []
      this.setData({ list })
      this.updateSelected()
      this.updateSafeArea()
    },
    ready() {
      this.updateSelected()
    }
  },

  methods: {
    updateSafeArea() {
      try {
        const { safeArea, screenHeight } = wx.getSystemInfoSync()
        const bottomInset = safeArea && screenHeight ? Math.max(0, screenHeight - safeArea.bottom) : 0
        this.setData({ safeBottom: bottomInset })
      } catch (e) {
        this.setData({ safeBottom: 0 })
      }
    },

    updateSelected() {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]
      const route = current ? current.route : ''
      const list = this.data.list
      const index = list.findIndex((i) => i.pagePath === route)
      if (index >= 0) this.setData({ selected: index })
    },

    onSwitch(e) {
      const path = e.currentTarget.dataset.path
      const index = e.currentTarget.dataset.index
      if (Number(index) === Number(this.data.selected)) return
      this.setData({ selected: index })
      wx.switchTab({ url: '/' + path })
    }
  }
})

