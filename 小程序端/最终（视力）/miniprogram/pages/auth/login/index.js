const app = getApp()
const {
  registerMobile,
  loginMobile,
  loginWechat,
  getTerms,
  getChildren
} = require('../../../utils/api')
const { setAuthToken, clearAuthToken } = require('../../../utils/request')

Page({
  data: {
    isRegister: false,
    phone: '',
    password: '',
    confirmPassword: '',
    agreed: false,
    
    // Password Strength
    strengthLevel: 'low',
    strengthWidth: 0,
    strengthText: '',
    
    // Agreement Modal
    showAgreementModal: false,
    agreementTitle: '',
    agreementContent: '',
    termsData: {
      user_agreement: '加载中...',
      privacy_policy: '加载中...',
      child_privacy_policy: '加载中...',
      third_party_share_list: '加载中...'
    },
    
    // Remember Login
    rememberLogin: false,
    autoLoginTried: false
  },

  goBack() {
    wx.switchTab({ url: '/pages/home/index/index' })
  },

  onLoad() {
    this.fetchTerms()
    this.checkRememberedUser()
    this.autoLoginIfRemembered()
  },
  
  checkRememberedUser() {
    const remembered = wx.getStorageSync('remembered_user')
    if (remembered) {
      this.setData({
        phone: remembered.phone,
        password: remembered.password,
        rememberLogin: true,
        agreed: Boolean(remembered.agreed)
      })
    }
  },

  async autoLoginIfRemembered() {
    if (this.data.autoLoginTried) return

    const skip = wx.getStorageSync('skip_auto_login_once')
    if (skip) {
      wx.removeStorageSync('skip_auto_login_once')
      this.setData({ autoLoginTried: true })
      return
    }

    const remembered = wx.getStorageSync('remembered_user')
    if (!remembered || !remembered.phone || !remembered.password) {
      this.setData({ autoLoginTried: true })
      return
    }

    this.setData({ autoLoginTried: true, agreed: true, rememberLogin: true })
    wx.removeStorageSync('current_user_id')
    wx.showLoading({ title: '自动登录中...' })
    try {
      const res = await loginMobile({ phone: remembered.phone, password: remembered.password })
      wx.hideLoading()
      if (res && res.user && res.user._id) {
        const user = res.user
        if (res.token) setAuthToken(res.token)
        app.globalData.userInfo = user
        app.globalData.currentChild = null
        wx.setStorageSync('current_user_id', String(user._id))
        wx.removeStorageSync('current_child_id')
        this.checkProfile()
        return
      }
      wx.removeStorageSync('remembered_user')
    } catch (e) {
      wx.hideLoading()
      wx.removeStorageSync('remembered_user')
    }
  },
  
  onRememberChange(e) {
    this.setData({ rememberLogin: e.detail.value.length > 0 })
  },

  async fetchTerms() {
    try {
      const data = await getTerms()
      const row = data && data.row ? data.row : null
      if (row) {
        this.setData({ termsData: { ...this.data.termsData, ...row } })
        return
      }
    } catch (e) {
      console.log('Fetching terms failed, using default', e)
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  onPhoneFieldChange(e) {
    this.onPhoneInput({ detail: { value: e.detail.value } })
  },

  onPasswordInput(e) {
    const pwd = e.detail.value
    this.setData({ password: pwd })
    this.checkPasswordStrength(pwd)
  },

  onPasswordFieldChange(e) {
    this.onPasswordInput({ detail: { value: e.detail.value } })
  },
  
  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value })
  },

  onConfirmPasswordFieldChange(e) {
    this.onConfirmPasswordInput({ detail: { value: e.detail.value } })
  },

  checkPasswordStrength(pwd) {
    if (!pwd) {
      this.setData({ strengthWidth: 0, strengthText: '' })
      return
    }
    
    let score = 0
    if (pwd.length >= 6) score += 1
    if (pwd.length >= 10) score += 1
    if (/[A-Za-z]/.test(pwd)) score += 1
    if (/[0-9]/.test(pwd)) score += 1
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1
    
    let level = 'low'
    let width = 30
    let text = '弱'
    
    if (score >= 4) {
      level = 'high'
      width = 100
      text = '强'
    } else if (score >= 3) {
      level = 'medium'
      width = 60
      text = '中'
    }
    
    this.setData({
      strengthLevel: level,
      strengthWidth: width,
      strengthText: text
    })
  },

  onAgreementChange(e) {
    this.setData({ agreed: e.detail.value.length > 0 })
  },

  switchMode() {
    // Smooth transition logic could be enhanced here
    this.setData({ 
        isRegister: !this.data.isRegister,
        password: '',
        confirmPassword: '',
        strengthWidth: 0
    })
  },
  
  showUserAgreement() {
    this.setData({
      showAgreementModal: true,
      agreementTitle: '用户协议',
      agreementContent: this.data.termsData.user_agreement || '暂无内容'
    })
  },
  
  showPrivacyPolicy() {
    this.setData({
      showAgreementModal: true,
      agreementTitle: '隐私政策',
      agreementContent: this.data.termsData.privacy_policy || '暂无内容'
    })
  },

  showChildPrivacyPolicy() {
    this.setData({
      showAgreementModal: true,
      agreementTitle: '儿童隐私政策',
      agreementContent: this.data.termsData.child_privacy_policy || '暂无内容'
    })
  },

  showThirdPartyShareList() {
    this.setData({
      showAgreementModal: true,
      agreementTitle: '第三方信息共享清单',
      agreementContent: this.data.termsData.third_party_share_list || '暂无内容'
    })
  },
  
  closeAgreementModal() {
    this.setData({ showAgreementModal: false })
  },

  async handleAction() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意协议', icon: 'none' })
      return
    }
    if (!this.data.phone || !this.data.password) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    
    if (this.data.isRegister) {
        if (this.data.password !== this.data.confirmPassword) {
            wx.showToast({ title: '两次密码不一致', icon: 'none' })
            return
        }
    }

    wx.showLoading({ title: '处理中...' })
    const phone = (this.data.phone || '').trim()
    const password = this.data.password || ''

    try {
      if (!this.data.isRegister) {
        wx.removeStorageSync('current_user_id')
        clearAuthToken()
      }
      const res = this.data.isRegister
        ? await registerMobile({ phone, password })
        : await loginMobile({ phone, password })

      wx.hideLoading()
      if (this.data.isRegister) {
        wx.showToast({ title: '注册成功，请登录' })
        this.setData({ isRegister: false })
        return
      }

      if (this.data.rememberLogin) {
        wx.setStorageSync('remembered_user', {
          phone: this.data.phone,
          password: this.data.password,
          agreed: true
        })
      } else {
        wx.removeStorageSync('remembered_user')
      }

      const user = res && res.user ? res.user : null
      if (!user || !user._id || !res.token) {
        wx.showModal({ title: '提示', content: '登录结果异常，请重试', showCancel: false })
        return
      }

      setAuthToken(res.token)
      app.globalData.userInfo = user
      app.globalData.currentChild = null
      wx.setStorageSync('current_user_id', String(user._id))
      wx.removeStorageSync('current_child_id')
      this.checkProfile()
    } catch (e) {
      wx.hideLoading()
      console.error('Login Error:', e)
      wx.showModal({
          title: '错误',
          content: '请求失败：' + (e.message || JSON.stringify(e)),
          showCancel: false
      })
    }
  },
  
  async handleWechatLogin() {
      if (!this.data.agreed) {
          wx.showToast({ title: '请先同意协议', icon: 'none' })
          return
      }
      
      wx.showLoading({ title: '微信登录中...' })
      try {
          const loginRes = await new Promise((resolve, reject) => {
              wx.login({
                success: resolve,
                fail: reject
              })
          })
          if (!loginRes || !loginRes.code) {
              throw new Error('未获取到微信登录凭证')
          }
          const res = await loginWechat({ code: loginRes.code })
          wx.hideLoading()

          if (res && res.user && res.user._id && res.token) {
              const user = res.user
              setAuthToken(res.token)
              app.globalData.userInfo = user
              wx.setStorageSync('current_user_id', user._id)
              wx.removeStorageSync('current_child_id')
              wx.showToast({ title: '登录成功' })
              this.checkProfile()
          } else {
              throw new Error('微信登录返回异常')
          }
      } catch (e) {
          wx.hideLoading()
          console.error('WeChat Login Error:', e)
          wx.showModal({
              title: '登录失败',
              content: '微信登录异常：' + (e.message || '请检查网络'),
              showCancel: false
          })
      }
  },

  async checkProfile() {
    try {
      const data = await Promise.race([
        getChildren(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('获取档案超时')), 8000)
        })
      ])

      const list = (data && Array.isArray(data.list))
        ? data.list.filter((c) => c && c._id)
        : []

      const cachedId = wx.getStorageSync('current_child_id') || ''
      const cachedChild = cachedId ? list.find((c) => c._id === cachedId) : null
      const child = cachedChild || list[0] || null
      if (child) {
        app.globalData.currentChild = child
        wx.setStorageSync('current_child_id', child._id)
      }

      if (list.length === 0 || (list.length > 1 && !cachedId)) {
        wx.reLaunch({ url: '/pages/children/select/index' })
        return
      }

      wx.reLaunch({
        url: '/pages/home/index/index',
        fail: () => {
          wx.switchTab({ url: '/pages/home/index/index' })
        }
      })
      
    } catch (e) {
      console.error(e)
      wx.reLaunch({ url: '/pages/children/select/index' })
    }
  }
})
