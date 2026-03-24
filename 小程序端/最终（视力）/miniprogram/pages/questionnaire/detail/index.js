const app = getApp()
const { getChildren, getQuestionnaireDetail, getQuestionnaireSubmissions } = require('../../../utils/api')

Page({
  data: {
    questionnaireId: '',
    childInfo: {},
    childSummary: '请先完善孩子档案后再查看问卷预览',
    childInitial: '?',
    questionnaire: null,
    questionnaireDesc: '问卷预览页用于确认规则、结构和填写记录后再进入填写。',
    sections: [],
    sectionCards: [],
    matchedRule: null,
    matchedRuleName: '默认派发规则',
    availability: null,
    historyList: [],
    draftSubmissionId: '',
    statusText: '待发布',
    remainingText: '加载中',
    ruleText: '提交规则加载中',
    overview: {
      totalPages: 0,
      totalQuestions: 0,
      historyCount: 0
    },
    draftCount: 0,
    submittedCount: 0,
    actionText: '开始填写',
    actionHint: '确认规则后即可开始填写问卷',
    canStart: true,
    loading: true
  },

  /**
   * 页面加载时记录问卷 ID，供后续详情接口请求使用。
   * @param {Record<string, string>} options 页面路由参数，包含问卷 ID。
   * @returns {void} 无返回值，直接更新页面数据。
   */
  onLoad(options) {
    this.setData({
      questionnaireId: options && options.id ? String(options.id) : ''
    })
  },

  /**
   * 页面显示时刷新问卷详情、填写对象和历史记录。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部触发页面数据初始化。
   */
  onShow() {
    this.initData()
  },

  /**
   * 处理下拉刷新，刷新完成后关闭系统刷新态。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部完成数据刷新与收尾。
   */
  onPullDownRefresh() {
    this.initData().finally(() => wx.stopPullDownRefresh())
  },

  /**
   * 初始化问卷预览页数据，包括孩子信息、详情信息和历史记录。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回初始化 Promise，供页面生命周期和下拉刷新复用。
   */
  async initData() {
    if (!this.data.questionnaireId) {
      this.setData({
        questionnaire: null,
        sectionCards: [],
        overview: this.createEmptyOverview(),
        actionHint: '未获取到问卷编号，请返回后重新进入',
        canStart: false,
        loading: false
      })
      return
    }

    this.setData({ loading: true })

    const childInfo = await this.ensureChildInfo()
    this.applyChildInfo(childInfo)

    if (!childInfo || !childInfo._id) {
      this.resetDetailState({
        actionHint: '请先完善孩子档案，系统需要按学校、年级和班级匹配问卷',
        canStart: false
      })
      this.setData({ loading: false })
      return
    }

    try {
      const [detail, history] = await Promise.all([
        getQuestionnaireDetail(this.data.questionnaireId, childInfo._id),
        getQuestionnaireSubmissions(this.data.questionnaireId, childInfo._id)
      ])

      const questionnaire = detail && detail.questionnaire ? detail.questionnaire : null
      const sections = detail && Array.isArray(detail.sections) ? detail.sections : []
      const availability = detail && detail.availability ? detail.availability : null
      const matchedRule = detail && detail.matched_rule ? detail.matched_rule : null
      const draftSubmissionId = detail && detail.draft_submission_id ? String(detail.draft_submission_id) : ''
      const historyList = history && Array.isArray(history.list) ? history.list : []
      const sectionCards = this.normalizeSections(sections)
      const overview = this.buildOverview(sectionCards, historyList)
      const submittedCount = this.getSubmittedCount(historyList)
      const canStart = Boolean(draftSubmissionId) || this.canStartQuestionnaire(availability)

      this.setData({
        questionnaire,
        questionnaireDesc: this.getQuestionnaireDescription(questionnaire),
        sections,
        sectionCards,
        matchedRule,
        matchedRuleName: this.getMatchedRuleName(matchedRule),
        availability,
        historyList,
        draftSubmissionId,
        statusText: this.getStatusText(questionnaire && questionnaire.status),
        remainingText: this.getRemainingText(availability),
        ruleText: this.getRuleTextFromAvailability(availability),
        overview,
        draftCount: draftSubmissionId ? 1 : 0,
        submittedCount,
        actionText: draftSubmissionId ? '继续填写' : '开始填写',
        actionHint: this.getActionHint({
          draftSubmissionId,
          availability,
          submittedCount
        }),
        canStart
      })

      if (questionnaire && questionnaire.title) {
        wx.setNavigationBarTitle({
          title: questionnaire.title
        })
      }
    } catch (error) {
      console.error(error)
      this.resetDetailState({
        actionHint: '问卷信息加载失败，请稍后重试',
        canStart: false
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
   * 获取当前可用的孩子档案，并优先恢复最近一次选择的孩子。
   * @param {void} 无 无入参。
   * @returns {Promise<Object>} 返回命中的孩子对象；未找到时返回空对象。
   */
  async ensureChildInfo() {
    if (app.globalData.currentChild && app.globalData.currentChild._id) {
      return app.globalData.currentChild
    }

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
   * 将孩子档案转换为页面直接可用的摘要展示字段。
   * @param {Object} childInfo 孩子档案对象，用于生成摘要和头像首字。
   * @returns {void} 无返回值，直接更新页面数据。
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
   * 在问卷详情不可用或加载失败时重置详情展示状态。
   * @param {Record<string, any>} extra 需要额外覆盖的状态字段。
   * @returns {void} 无返回值，直接回填页面默认状态。
   */
  resetDetailState(extra) {
    this.setData(Object.assign({
      questionnaire: null,
      questionnaireDesc: '问卷预览页用于确认规则、结构和填写记录后再进入填写。',
      sections: [],
      sectionCards: [],
      matchedRule: null,
      matchedRuleName: '默认派发规则',
      availability: null,
      historyList: [],
      draftSubmissionId: '',
      statusText: '待发布',
      remainingText: '暂不可填写',
      ruleText: '提交规则暂不可用',
      overview: this.createEmptyOverview(),
      draftCount: 0,
      submittedCount: 0,
      actionText: '开始填写',
      actionHint: '确认规则后即可开始填写问卷',
      canStart: false
    }, extra || {}))
  },

  /**
   * 生成默认的问卷概览统计对象。
   * @param {void} 无 无入参。
   * @returns {{totalPages: number, totalQuestions: number, historyCount: number}} 返回空统计对象。
   */
  createEmptyOverview() {
    return {
      totalPages: 0,
      totalQuestions: 0,
      historyCount: 0
    }
  },

  /**
   * 根据孩子档案生成摘要文案。
   * @param {Object} child 孩子档案对象，包含学校、年级和班级信息。
   * @returns {string} 返回可直接展示的摘要文案。
   */
  getChildSummary(child) {
    if (!child || !child._id) return '请先完善孩子档案后再查看问卷预览'

    const parts = [
      child.school,
      child.grade_name || '未设置年级',
      child.class_name
    ].filter(Boolean)

    return parts.length > 0 ? parts.join(' · ') : '已绑定当前孩子档案'
  },

  /**
   * 提取孩子姓名首字作为头像占位字符。
   * @param {Object} child 孩子档案对象，包含姓名字段。
   * @returns {string} 返回单字符首字；缺失时回退为问号。
   */
  getChildInitial(child) {
    if (!child || !child.name) return '?'
    return String(child.name).slice(0, 1)
  },

  /**
   * 生成问卷简介文案，避免描述缺失时页面出现空白区域。
   * @param {Object|null} questionnaire 问卷对象，包含标题和描述信息。
   * @returns {string} 返回问卷简介或默认说明文案。
   */
  getQuestionnaireDescription(questionnaire) {
    if (questionnaire && questionnaire.description) return questionnaire.description
    return '填写前可先查看问卷结构、适用规则和历史记录，确认后再进入正式填写。'
  },

  /**
   * 将问卷状态值转换为更易读的中文文案。
   * @param {string} status 问卷状态值，如 published 或 draft。
   * @returns {string} 返回中文状态文案。
   */
  getStatusText(status) {
    if (status === 'published') return '已发布'
    if (status === 'draft') return '草稿中'
    if (status === 'disabled') return '已停用'
    return status || '待发布'
  },

  /**
   * 生成当前问卷的剩余提交次数文案。
   * @param {Object|null} availability 提交可用性对象，包含剩余次数信息。
   * @returns {string} 返回适合标签展示的剩余次数说明。
   */
  getRemainingText(availability) {
    if (!availability) return '规则待确认'
    if (availability.remaining_count === null) return '不限次数'
    return `剩余 ${availability.remaining_count} 次`
  },

  /**
   * 根据可用性对象生成完整的提交规则说明。
   * @param {Object|null} availability 提交可用性对象，包含生效规则。
   * @returns {string} 返回完整的中文规则说明。
   */
  getRuleTextFromAvailability(availability) {
    const effectiveRule = availability && availability.effective_rule ? availability.effective_rule : {}
    if (effectiveRule.submit_rule_type === 'unlimited') return '不限提交次数'
    if (effectiveRule.submit_rule_type === 'once') return '仅可提交 1 次'

    const count = effectiveRule.max_submit_count || 1
    if (effectiveRule.cycle_type === 'term') return `每学期可提交 ${count} 次`
    if (effectiveRule.cycle_type === 'month') return `每月可提交 ${count} 次`
    if (effectiveRule.cycle_type === 'week') return `每周可提交 ${count} 次`
    if (effectiveRule.cycle_type === 'day') return `每日可提交 ${count} 次`
    return `最多可提交 ${count} 次`
  },

  /**
   * 生成派发规则名称文案。
   * @param {Object|null} matchedRule 命中的派发规则对象。
   * @returns {string} 返回可直接展示的派发规则名称。
   */
  getMatchedRuleName(matchedRule) {
    if (matchedRule && matchedRule.rule_name) return matchedRule.rule_name
    return '默认派发规则'
  },

  /**
   * 将问卷分组数据转换为页面结构预览卡片数据。
   * @param {Array<Object>} sections 接口返回的分组列表。
   * @returns {Array<Object>} 返回带页码和题目数的展示卡片列表。
   */
  normalizeSections(sections) {
    return (sections || []).map((item, index) => {
      const pageNo = Number(item && item.page_no) || index + 1
      const questionCount = Array.isArray(item && item.questions) ? item.questions.length : 0

      return Object.assign({}, item, {
        pageNo,
        pageText: `第 ${pageNo} 页`,
        displayIndex: pageNo < 10 ? `0${pageNo}` : String(pageNo),
        questionCount,
        descriptionText: item && item.description ? item.description : '本页内容将在正式填写时按题型逐步展示。'
      })
    })
  },

  /**
   * 汇总问卷结构与历史记录概览数据。
   * @param {Array<Object>} sectionCards 结构卡片列表，用于统计页数和题数。
   * @param {Array<Object>} historyList 历史提交列表，用于统计历史提交次数。
   * @returns {{totalPages: number, totalQuestions: number, historyCount: number}} 返回详情页顶部概览统计。
   */
  buildOverview(sectionCards, historyList) {
    return {
      totalPages: sectionCards.length,
      totalQuestions: sectionCards.reduce((sum, item) => sum + (Number(item.questionCount) || 0), 0),
      historyCount: this.getSubmittedCount(historyList)
    }
  },

  /**
   * 统计历史记录中已正式提交的次数。
   * @param {Array<Object>} historyList 历史记录列表，包含草稿和提交状态。
   * @returns {number} 返回正式提交次数。
   */
  getSubmittedCount(historyList) {
    return (historyList || []).filter((item) => item && item.status === 'submitted').length
  },

  /**
   * 判断当前问卷是否允许开始新的填写。
   * @param {Object|null} availability 提交可用性对象，包含 can_submit 字段。
   * @returns {boolean} 返回是否允许开始填写；已有草稿时由调用方单独放行。
   */
  canStartQuestionnaire(availability) {
    if (!availability) return true
    return availability.can_submit !== false
  },

  /**
   * 生成底部操作区的提示文案。
   * @param {{draftSubmissionId: string, availability: Object|null, submittedCount: number}} payload 页面关键状态数据。
   * @returns {string} 返回操作提示文案，帮助用户判断下一步操作。
   */
  getActionHint(payload) {
    if (payload.draftSubmissionId) return '检测到未完成草稿，可继续填写并提交。'
    if (payload.availability && payload.availability.can_submit === false) return '当前提交次数已用完，可先查看历史填写记录。'
    if (payload.submittedCount > 0) return `当前已提交 ${payload.submittedCount} 次，可继续查看历史或开始新一轮填写。`
    return '确认规则和问卷结构后，即可进入正式填写。'
  },

  /**
   * 跳转到问卷填写页；若当前无剩余次数且无草稿，则给出提示。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部执行页面跳转或提示。
   */
  goFill() {
    if (!this.data.canStart && !this.data.draftSubmissionId) {
      wx.showToast({
        title: '当前暂无可用提交次数',
        icon: 'none'
      })
      return
    }

    const submissionId = this.data.draftSubmissionId
    const query = submissionId ? `&submission_id=${encodeURIComponent(submissionId)}` : ''
    wx.navigateTo({
      url: `/pages/questionnaire/fill/index?id=${encodeURIComponent(this.data.questionnaireId)}${query}`
    })
  },

  /**
   * 跳转到当前问卷的填写历史页。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  goHistory() {
    wx.navigateTo({
      url: `/pages/questionnaire/history/index?questionnaire_id=${encodeURIComponent(this.data.questionnaireId)}`
    })
  },

  /**
   * 跳转到孩子选择页，允许用户切换当前问卷的匹配对象。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  goSelectChild() {
    wx.navigateTo({
      url: '/pages/children/select/index'
    })
  },

  /**
   * 跳转到档案完善页，引导用户先补齐孩子信息。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit/index'
    })
  }
})