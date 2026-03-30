const { getTerms } = require('../../utils/api')
const { getAuthToken } = require('../../utils/request')

Page({
  data: {
    // 协议弹窗
    showAgreementModal: false,
    agreementTitle: '',
    agreementContent: '',
    termsData: {
      user_agreement: '',
      privacy_policy: '',
      child_privacy_policy: '',
      third_party_share_list: ''
    }
  },

  onLoad() {
    this.fetchTerms()
    // 如果用户已登录，直接跳转首页
    this.checkLoginStatus()
  },

  /**
   * 检查用户是否已经登录。
   * 已登录则直接跳转到首页，不在欢迎页停留。
   */
  checkLoginStatus() {
    const token = getAuthToken()
    const userId = wx.getStorageSync('current_user_id')
    if (token && userId) {
      wx.reLaunch({ url: '/pages/home/index/index' })
    }
  },

  async fetchTerms() {
    try {
      const data = await getTerms()
      const row = data && data.row ? data.row : null
      if (row) {
        this.setData({ termsData: { ...this.data.termsData, ...row } })
      }
    } catch (e) {
      console.log('Fetching terms failed', e)
    }
  },

  /**
   * 点击"进入登录"按钮，跳转到登录页。
   */
  goToLogin() {
    wx.navigateTo({ url: '/pages/auth/login/index' })
  },

  showUserAgreement() {
    this.setData({
      showAgreementModal: true,
      agreementTitle: '用户服务协议',
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
  }
})
