const app = getApp()
const cache = require('../../../utils/cache')
const { getUserProfile, updateUserProfile, getChildren, updateChild, getTerms } = require('../../../utils/api')
const { uploadImage } = require('../../../utils/upload')
const { clearAuthToken } = require('../../../utils/request')

Page({
  data: {
    userInfo: null,
    childInfo: {},
    userProfile: { user_id: '', user_no: '', display_name: '', avatar_file_id: '' },
    userPhoneMasked: '',
    avatarUrl: '',
    showNameModal: false,
    nameDraft: '',
    showAgreementModal: false,
    agreementTitle: '',
    agreementContent: '',
    termsData: {
      user_agreement: '加载中...',
      privacy_policy: '加载中...',
      child_privacy_policy: '加载中...'
    },
    theme: 'light',
    logoutPressed: false,
    logoutIconSrc: '/images/icons/logout.svg'
  },

  /**
   * 初始化个人中心协议数据。
   * @returns {void} 无返回值，仅触发协议内容初始化。
   */
  onLoad() {
    this.fetchTerms()
  },

  onShow() {
    this.syncCurrentUserIdFromGlobal()
    this.initData()
    this.fetchUserProfile()
    this.ensureChild()
    this.syncTheme()
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && tabBar.updateSelected) tabBar.updateSelected()
  },

  onUnload() {
    if (this._themeListener) {
      try {
        wx.offThemeChange(this._themeListener)
      } catch (e) {
        // ignore
      }
      this._themeListener = null
    }
  },

  /**
   * 拉取后台配置的协议内容。
   * @returns {Promise<void>} 无返回值，仅更新协议展示数据。
   */
  async fetchTerms() {
    try {
      const data = await getTerms()
      const row = data && data.row ? data.row : null
      if (row) {
        this.setData({
          termsData: {
            ...(this.data.termsData || {}),
            ...row
          }
        })
      }
    } catch (e) {
      console.log('fetch terms failed', e)
    }
  },

  syncCurrentUserIdFromGlobal() {
    const uid = app.globalData.userInfo && app.globalData.userInfo._id
    if (uid) {
      try {
        const stored = wx.getStorageSync('current_user_id')
        if (stored !== uid) wx.setStorageSync('current_user_id', uid)
      } catch (e) {}
    }
  },

  initData() {
    this.setData({
      userInfo: app.globalData.userInfo,
      childInfo: app.globalData.currentChild || {}
    })
  },

  async fetchUserProfile() {
    try {
      const data = await getUserProfile()
      if (data && data.profile) {
        const profile = data.profile || {}
        const p = profile.phone ? String(profile.phone) : ''
        const masked = p && p.length >= 7 ? `${p.slice(0, 3)}****${p.slice(-4)}` : p
        this.setData({ userProfile: profile, userPhoneMasked: masked })
        await this.ensureUserNo(profile)
      }
    } catch (e) {
      console.error(e)
    }
  },

  syncTheme() {
    try {
      const info = wx.getSystemInfoSync()
      const theme = info && info.theme ? info.theme : 'light'
      this.setData({ theme })
      this.updateLogoutIcon()
      if (!this._themeListener && wx.onThemeChange) {
        this._themeListener = (e) => {
          const t = e && e.theme ? e.theme : 'light'
          this.setData({ theme: t })
          this.updateLogoutIcon()
        }
        wx.onThemeChange(this._themeListener)
      }
    } catch (e) {
      this.setData({ theme: 'light' })
      this.updateLogoutIcon()
    }
  },

  updateLogoutIcon() {
    const isDark = this.data.theme === 'dark'
    const pressed = !!this.data.logoutPressed
    let src = '/images/icons/logout.svg'
    if (isDark && pressed) src = '/images/icons/logout-dark-active.svg'
    else if (isDark) src = '/images/icons/logout-dark.svg'
    else if (pressed) src = '/images/icons/logout-active.svg'
    this.setData({ logoutIconSrc: src })
  },

  onLogoutPress() {
    this.setData({ logoutPressed: true })
    this.updateLogoutIcon()
  },

  onLogoutRelease() {
    this.setData({ logoutPressed: false })
    this.updateLogoutIcon()
  },

  async ensureUserNo(profile) {
    const p = profile || this.data.userProfile || {}
    if (p.user_no && /^\d{8}$/.test(String(p.user_no))) {
      try {
        wx.setStorageSync('user_no', String(p.user_no))
      } catch (e) {
        // ignore
      }
      return
    }

    let local = ''
    try {
      local = String(wx.getStorageSync('user_no') || '')
    } catch (e) {
      // ignore
    }
    if (!/^\d{8}$/.test(local)) local = ''

    for (let i = 0; i < 6; i += 1) {
      const next = local || this.generateUserNo()
      try {
        await updateUserProfile({ user_no: next })
        if (next) {
          const merged = { ...(this.data.userProfile || {}), user_no: next }
          this.setData({ userProfile: merged })
          try {
            wx.setStorageSync('user_no', next)
          } catch (e) {
            // ignore
          }
          return
        }
        local = ''
      } catch (e) {
        local = ''
      }
    }
  },

  generateUserNo() {
    const first = Math.floor(Math.random() * 9) + 1
    let s = String(first)
    for (let i = 0; i < 7; i += 1) s += String(Math.floor(Math.random() * 10))
    return s
  },

  async ensureChild() {
    const cachedId = wx.getStorageSync('current_child_id') || ''
    if (app.globalData.currentChild && (!cachedId || app.globalData.currentChild._id === cachedId)) {
      await this.refreshAvatarUrl(app.globalData.currentChild)
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
          await this.refreshAvatarUrl(child)
          return
        }
        if (cachedId) {
          wx.removeStorageSync('current_child_id')
        }
      }
      this.setData({ childInfo: {}, avatarUrl: '' })
    } catch (e) {
      console.error(e)
      this.setData({ childInfo: {}, avatarUrl: '' })
    }
  },

  async refreshAvatarUrl(child) {
    const avatarUrl = child && (child.avatar_url || child.avatar_file_id) ? String(child.avatar_url || child.avatar_file_id) : ''
    this.setData({ avatarUrl })
  },

  goSelectChild() {
    wx.navigateTo({ url: '/pages/children/select/index' })
  },

  goToProfileEdit() {
    const id = this.data.childInfo && this.data.childInfo._id
    const url = id ? `/pages/profile/edit/index?id=${encodeURIComponent(id)}` : '/pages/profile/edit/index'
    wx.navigateTo({ url })
  },

  async onChangeAvatar() {
    const id = this.data.childInfo && this.data.childInfo._id
    if (!id) {
      wx.navigateTo({ url: '/pages/children/select/index' })
      return
    }

    try {
      const pick = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      const path = pick && pick.tempFilePaths && pick.tempFilePaths[0]
      if (!path) return
      wx.showLoading({ title: '上传中...' })
      const uploadRes = await uploadImage(path, 'mobile/avatars')
      const fileID = uploadRes && (uploadRes.file_url || uploadRes.url) ? String(uploadRes.file_url || uploadRes.url) : ''
      if (!fileID) throw new Error('上传失败')

      await updateChild(id, { avatar_file_id: fileID })
      wx.hideLoading()
      const next = { ...(this.data.childInfo || {}), avatar_file_id: fileID, avatar_url: fileID }
      app.globalData.currentChild = next
      this.setData({ childInfo: next })
      await this.refreshAvatarUrl(next)
      wx.showToast({ title: '已更新' })
    } catch (e) {
      wx.hideLoading()
      if (e && e.errMsg && String(e.errMsg).includes('cancel')) return
      wx.showModal({ title: '上传失败', content: e && e.message ? String(e.message) : '请稍后重试', showCancel: false })
    }
  },

  onEditName() {
    const id = this.data.childInfo && this.data.childInfo._id
    if (!id) {
      wx.navigateTo({ url: '/pages/children/select/index' })
      return
    }
    this.setData({ showNameModal: true, nameDraft: this.data.childInfo.name || '' })
  },

  onNameInput(e) {
    this.setData({ nameDraft: e.detail.value })
  },

  closeNameModal() {
    this.setData({ showNameModal: false })
  },

  async saveName() {
    const id = this.data.childInfo && this.data.childInfo._id
    const name = (this.data.nameDraft || '').trim()
    if (!id) return
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中...' })
    try {
      await updateChild(id, { name })
      wx.hideLoading()
      const next = { ...(this.data.childInfo || {}), name }
      app.globalData.currentChild = next
      this.setData({ childInfo: next, showNameModal: false })
      wx.showToast({ title: '已保存' })
    } catch (e) {
      wx.hideLoading()
      wx.showModal({ title: '保存失败', content: e && e.message ? String(e.message) : '请稍后重试', showCancel: false })
    }
  },

  goToProfile() {
    this.goToProfileEdit()
  },

  goToAppointments() {
    wx.navigateTo({
      url: '/pages/user/appointments/index'
    })
  },

  goToDashboard() {
    wx.navigateTo({
      url: '/pages/dashboard/index/index'
    })
  },

  goToAbout() {
    wx.showModal({
      title: '关于与帮助',
      content: '如需配置轮播图、预约项目与协议内容，请在管理后台中维护对应数据。',
      showCancel: false
    })
  },

  /**
   * 打开协议内容弹窗。
   * @param {string} title 协议标题。
   * @param {string} content 协议正文内容。
   * @returns {void} 无返回值。
   */
  openAgreementModal(title, content) {
    this.setData({
      showAgreementModal: true,
      agreementTitle: title,
      agreementContent: content || '暂无内容'
    })
  },

  /**
   * 展示用户协议。
   * @returns {void} 无返回值。
   */
  showUserAgreement() {
    this.openAgreementModal('用户协议', this.data.termsData.user_agreement)
  },

  /**
   * 展示隐私政策。
   * @returns {void} 无返回值。
   */
  showPrivacyPolicy() {
    this.openAgreementModal('隐私政策', this.data.termsData.privacy_policy)
  },

  /**
   * 展示儿童隐私政策。
   * @returns {void} 无返回值。
   */
  showChildPrivacyPolicy() {
    this.openAgreementModal('儿童隐私政策', this.data.termsData.child_privacy_policy)
  },

  /**
   * 关闭协议内容弹窗。
   * @returns {void} 无返回值。
   */
  closeAgreementModal() {
    this.setData({ showAgreementModal: false })
  },

  handleLogout() {
    wx.showModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
            if (res.confirm) {
                // 退出前清除当前用户的所有数据缓存
                cache.clearUserCache()
                app.globalData.userInfo = null
                app.globalData.currentChild = null
                clearAuthToken()
                try {
                  wx.removeStorageSync('remembered_user')
                  wx.removeStorageSync('current_child_id')
                  wx.removeStorageSync('current_user_id')
                  wx.setStorageSync('skip_auto_login_once', Date.now())
                } catch (e) {
                  // ignore
                }
                wx.reLaunch({
                    url: '/pages/auth/login/index'
                })
            }
        }
    })
  }
})
