const app = getApp()
const { getChildren, getQuestionnaires } = require('../../../utils/api')

Page({
  data: {
    childInfo: {},
    childSummary: '完善孩子档案后可按年级自动匹配问卷',
    childInitial: '?',
    questionnaires: [],
    overview: {
      total: 0,
      draftCount: 0,
      submittedCount: 0
    },
    loading: false
  },

  /**
   * 页面展示时刷新问卷首页数据。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部触发当前页面数据初始化。
   */
  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && tabBar.updateSelected) tabBar.updateSelected()
    this.initData()
  },

  /**
   * 处理下拉刷新并在完成后关闭系统刷新态。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部完成数据刷新和收尾操作。
   */
  onPullDownRefresh() {
    this.initData().finally(() => wx.stopPullDownRefresh())
  },

  /**
   * 初始化页面所需的孩子档案和问卷列表数据。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回页面初始化 Promise，供生命周期和刷新逻辑复用。
   */
  async initData() {
    const cachedChild = app.globalData.currentChild && app.globalData.currentChild._id
      ? app.globalData.currentChild
      : null
    const childInfo = cachedChild || await this.fetchChildInfo()

    this.applyChildInfo(childInfo)

    if (childInfo && childInfo._id) {
      await this.fetchQuestionnaires(childInfo._id)
      return
    }

    this.setData({
      questionnaires: [],
      overview: this.createEmptyOverview()
    })
  },

  /**
   * 获取当前账号可用的孩子档案，并优先恢复最近选择的孩子。
   * @param {void} 无 无入参。
   * @returns {Promise<Object>} 返回最终命中的孩子档案对象；未命中时返回空对象。
   */
  async fetchChildInfo() {
    try {
      const data = await getChildren()
      if (data && Array.isArray(data.list) && data.list.length > 0) {
        const list = data.list.filter((child) => child && child._id)
        const cachedId = wx.getStorageSync('current_child_id') || ''
        const child = cachedId ? list.find((item) => item._id === cachedId) : list[0]
        if (child) {
          app.globalData.currentChild = child
          wx.setStorageSync('current_child_id', child._id)
          return child
        }
      }
      return {}
    } catch (error) {
      console.error(error)
      return {}
    }
  },

  /**
   * 根据当前孩子信息拉取问卷列表并构建展示层数据。
   * @param {string} childId 孩子档案 ID，用于请求该孩子可填写的问卷列表。
   * @returns {Promise<void>} 返回问卷加载 Promise，完成后更新列表和概览统计。
   */
  async fetchQuestionnaires(childId) {
    this.setData({ loading: true })
    try {
      const data = await getQuestionnaires(childId)
      const list = data && Array.isArray(data.list) ? data.list : []
      const questionnaires = this.normalizeQuestionnaires(list)
      this.setData({
        questionnaires,
        overview: this.buildOverview(questionnaires)
      })
    } catch (error) {
      console.error(error)
      this.setData({
        questionnaires: [],
        overview: this.createEmptyOverview()
      })
      wx.showToast({
        title: error && error.message ? String(error.message) : '加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 跳转到孩子档案编辑页，供用户完善当前匹配资料。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/edit/index' })
  },

  /**
   * 跳转到孩子切换页，供用户切换问卷匹配对象。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  goSelectChild() {
    wx.navigateTo({ url: '/pages/children/select/index' })
  },

  /**
   * 打开问卷详情页，查看结构和继续填写入口。
   * @param {WechatMiniprogram.BaseEvent} e 按钮点击事件，包含问卷 ID 数据集。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  openQuestionnaire(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pages/questionnaire/detail/index?id=${encodeURIComponent(id)}`
    })
  },

  /**
   * 打开问卷填写历史页，查看当前问卷的历史提交记录。
   * @param {WechatMiniprogram.BaseEvent} e 按钮点击事件，包含问卷 ID 数据集。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  openHistory(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pages/questionnaire/history/index?questionnaire_id=${encodeURIComponent(id)}`
    })
  },

  /**
   * 将当前孩子档案转换为页面直接可用的展示数据。
   * @param {Object} childInfo 孩子档案对象，用于生成名称摘要和首字信息。
   * @returns {void} 无返回值，直接更新页面 data 中的孩子展示字段。
   */
  applyChildInfo(childInfo) {
    const child = childInfo && childInfo._id ? childInfo : {}
    this.setData({
      childInfo: child,
      childSummary: this.getChildSummary(child),
      childInitial: this.getChildInitial(child)
    })
  },

  /**
   * 生成问卷首页顶部所需的空概览数据。
   * @param {void} 无 无入参。
   * @returns {{total: number, draftCount: number, submittedCount: number}} 返回默认统计对象，用于初始化和异常兜底。
   */
  createEmptyOverview() {
    return {
      total: 0,
      draftCount: 0,
      submittedCount: 0
    }
  },

  /**
   * 生成孩子档案的摘要文案，统一在页面顶部展示。
   * @param {Object} child 孩子档案对象，包含学校、年级和班级信息。
   * @returns {string} 返回适合直接展示的孩子摘要字符串。
   */
  getChildSummary(child) {
    if (!child || !child._id) return '完善孩子档案后可按年级自动匹配问卷'

    const parts = [
      child.school,
      child.grade_name || '未设置年级',
      child.class_name
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(' · ') : '已绑定孩子档案'
  },

  /**
   * 提取孩子姓名首字用于顶部头像占位展示。
   * @param {Object} child 孩子档案对象，包含姓名字段。
   * @returns {string} 返回单字符首字；无姓名时回退为问号。
   */
  getChildInitial(child) {
    if (!child || !child.name) return '?'
    return String(child.name).slice(0, 1)
  },

  /**
   * 将接口返回的问卷列表标准化为页面展示层数据。
   * @param {Array<Object>} list 问卷原始列表数据，用于补齐默认值和展示文案。
   * @returns {Array<Object>} 返回处理后的问卷列表，供 WXML 直接渲染。
   */
  normalizeQuestionnaires(list) {
    return list.map((item) => {
      const draftCount = Number(item && item.draft_count) || 0
      const submittedCount = Number(item && item.submitted_count) || 0
      const coverImageUrl = item && item.cover_image_url ? String(item.cover_image_url).trim() : ''

      return Object.assign({}, item, {
        coverImageUrl,
        hasCoverImage: Boolean(coverImageUrl),
        draftCount,
        submittedCount,
        recordTotal: draftCount + submittedCount,
        statusText: this.getStatusText(item && item.status),
        ruleName: item && item.matched_rule && item.matched_rule.rule_name
          ? item.matched_rule.rule_name
          : '默认派发规则',
        submitRuleText: this.getRuleText(item),
        actionText: draftCount > 0 ? '继续填写' : '查看问卷',
        actionHint: draftCount > 0 ? '检测到未完成草稿，可继续填写' : '可先查看规则后再开始填写'
      })
    })
  },

  /**
   * 根据标准化后的问卷列表汇总顶部概览统计。
   * @param {Array<Object>} list 标准化后的问卷列表，用于累加问卷数和记录数。
   * @returns {{total: number, draftCount: number, submittedCount: number}} 返回页面顶部概览统计数据。
   */
  buildOverview(list) {
    return list.reduce((result, item) => {
      result.total += 1
      result.draftCount += Number(item && item.draftCount) || 0
      result.submittedCount += Number(item && item.submittedCount) || 0
      return result
    }, this.createEmptyOverview())
  },

  /**
   * 将问卷状态值转换为更适合用户理解的中文文案。
   * @param {string} status 问卷状态值，如 published 或 draft。
   * @returns {string} 返回中文状态文案，未知状态时返回原值或默认值。
   */
  getStatusText(status) {
    if (status === 'published') return '已发布'
    if (status === 'draft') return '草稿中'
    if (status === 'disabled') return '已停用'
    return status || '待发布'
  },

  /**
   * 根据提交规则生成统一的中文说明文案。
   * @param {Object} item 单个问卷对象，包含生效提交规则字段。
   * @returns {string} 返回可直接展示的提交规则文案。
   */
  getRuleText(item) {
    const rule = item && item.effective_submit_rule ? item.effective_submit_rule : {}
    if (rule.submit_rule_type === 'unlimited') return '不限提交次数'
    if (rule.submit_rule_type === 'once') return '仅可提交 1 次'
    const count = rule.max_submit_count || 1
    if (rule.cycle_type === 'term') return `每学期可提交 ${count} 次`
    if (rule.cycle_type === 'month') return `每月可提交 ${count} 次`
    if (rule.cycle_type === 'week') return `每周可提交 ${count} 次`
    if (rule.cycle_type === 'day') return `每日可提交 ${count} 次`
    return `最多可提交 ${count} 次`
  }
})
