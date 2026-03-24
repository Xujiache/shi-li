const app = getApp()
const {
  getChildren,
  getQuestionnaireSubmissions,
  getQuestionnaireSubmissionDetail
} = require('../../../utils/api')

Page({
  data: {
    mode: 'list',
    questionnaireId: '',
    submissionId: '',
    childInfo: {},
    childSummary: '请先完善孩子档案后再查看填写记录',
    heroTitle: '记录概览',
    heroDesc: '提交问卷后，这里会展示草稿和已提交答卷。',
    heroTags: [],
    submissions: [],
    submission: null,
    answerCards: [],
    listStats: {
      total: 0,
      draftCount: 0,
      submittedCount: 0
    },
    loading: true
  },

  /**
   * 页面加载时记录问卷 ID、答卷 ID 与当前模式。
   * @param {Record<string, string>} options 页面路由参数，包含问卷 ID 和答卷 ID。
   * @returns {void} 无返回值，直接更新页面基础数据。
   */
  onLoad(options) {
    this.setData({
      questionnaireId: options && options.questionnaire_id ? String(options.questionnaire_id) : '',
      submissionId: options && options.submission_id ? String(options.submission_id) : '',
      mode: options && options.submission_id ? 'detail' : 'list'
    })
  },

  /**
   * 页面展示时刷新列表态或详情态数据。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部触发页面初始化。
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
   * 按当前模式初始化填写记录页数据。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回初始化 Promise，供生命周期和刷新复用。
   */
  async initData() {
    this.setData({ loading: true })

    try {
      if (this.data.mode === 'detail' && this.data.submissionId) {
        await this.loadSubmissionDetail()
      } else {
        await this.loadSubmissionList()
      }
    } catch (error) {
      console.error(error)
      this.setData({
        submission: null,
        submissions: [],
        answerCards: [],
        listStats: this.createEmptyListStats(),
        heroTitle: this.data.mode === 'detail' ? '答卷详情' : '记录概览',
        heroDesc: '加载失败，请稍后重试',
        heroTags: []
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
   * 加载当前问卷的历史记录列表。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回列表加载 Promise，完成后更新 hero 与记录列表。
   */
  async loadSubmissionList() {
    const childInfo = await this.ensureChildInfo()
    this.applyChildInfo(childInfo)
    wx.setNavigationBarTitle({ title: '填写记录' })

    if (!childInfo || !childInfo._id || !this.data.questionnaireId) {
      this.setData({
        submissions: [],
        submission: null,
        answerCards: [],
        listStats: this.createEmptyListStats(),
        heroTitle: childInfo && childInfo.name ? `${childInfo.name}的记录` : '记录概览',
        heroDesc: childInfo && childInfo._id ? '请先选择问卷后再查看填写记录。' : '请先完善孩子档案后再查看填写记录。',
        heroTags: this.buildListHeroTags(this.createEmptyListStats())
      })
      return
    }

    const data = await getQuestionnaireSubmissions(this.data.questionnaireId, childInfo._id)
    const submissions = this.normalizeSubmissions(data && Array.isArray(data.list) ? data.list : [])
    const listStats = this.buildListStats(submissions)

    this.setData({
      submissions,
      submission: null,
      answerCards: [],
      listStats,
      heroTitle: childInfo.name ? `${childInfo.name}的记录` : '记录概览',
      heroDesc: this.data.childSummary || '可查看当前问卷的草稿和历史答卷。',
      heroTags: this.buildListHeroTags(listStats)
    })
  },

  /**
   * 加载单条答卷详情与答案列表。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回详情加载 Promise，完成后更新 hero 和答案列表。
   */
  async loadSubmissionDetail() {
    const detail = await getQuestionnaireSubmissionDetail(this.data.submissionId)
    const submission = this.normalizeSubmissionDetail(detail && detail.submission ? detail.submission : null)
    const answerCards = this.normalizeAnswerCards(detail && Array.isArray(detail.answers) ? detail.answers : [])

    this.setData({
      submission,
      answerCards,
      submissions: [],
      heroTitle: submission ? submission.attemptTitle : '答卷详情',
      heroDesc: submission && submission.questionnaire_title ? submission.questionnaire_title : '当前答卷详情如下',
      heroTags: submission ? this.buildDetailHeroTags(submission) : []
    })

    wx.setNavigationBarTitle({ title: '答卷详情' })
  },

  /**
   * 获取当前可用的孩子档案，并优先恢复最近一次选择的孩子。
   * @param {void} 无 无入参。
   * @returns {Promise<Object>} 返回命中的孩子档案对象；未命中时返回空对象。
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
   * @param {Object} childInfo 孩子档案对象，用于生成记录页描述文案。
   * @returns {void} 无返回值，直接更新页面数据。
   */
  applyChildInfo(childInfo) {
    const child = childInfo && childInfo._id ? childInfo : {}
    this.setData({
      childInfo: child,
      childSummary: this.getChildSummary(child)
    })
  },

  /**
   * 生成空列表统计对象。
   * @param {void} 无 无入参。
   * @returns {{total: number, draftCount: number, submittedCount: number}} 返回默认统计对象。
   */
  createEmptyListStats() {
    return {
      total: 0,
      draftCount: 0,
      submittedCount: 0
    }
  },

  /**
   * 将历史记录列表标准化为页面展示层数据。
   * @param {Array<Object>} list 原始答卷列表。
   * @returns {Array<Object>} 返回适合直接渲染的记录卡片数据。
   */
  normalizeSubmissions(list) {
    return (list || []).map((item) => {
      const statusText = this.getSubmissionStatusText(item && item.status)
      const statusClass = item && item.status === 'submitted' ? 'submitted' : 'draft'
      const timeValue = item && (item.submitted_at || item.updated_at) ? String(item.submitted_at || item.updated_at) : '—'

      return Object.assign({}, item, {
        statusText,
        statusClass,
        attemptTitle: `第 ${Number(item && item.attempt_no ? item.attempt_no : 1)} 次${item && item.status === 'submitted' ? '提交' : '草稿'}`,
        schoolSummary: this.joinParts([item && item.school, item && (item.grade_name || '未设置年级'), item && item.class_name]),
        timeText: `${item && item.status === 'submitted' ? '提交时间' : '更新时间'}：${timeValue}`,
        answeredText: `${Number(item && item.answered_count ? item.answered_count : 0)} 题`,
        scoreText: item && item.total_score != null ? String(item.total_score) : '未评分',
        cardHint: '点击查看本次答卷详情'
      })
    })
  },

  /**
   * 将单条答卷详情对象标准化为页面展示层数据。
   * @param {Object|null} submission 原始答卷详情对象。
   * @returns {Object|null} 返回处理后的答卷详情；无数据时返回空值。
   */
  normalizeSubmissionDetail(submission) {
    if (!submission) return null

    return Object.assign({}, submission, {
      statusText: this.getSubmissionStatusText(submission.status),
      statusClass: submission.status === 'submitted' ? 'submitted' : 'draft',
      attemptTitle: `第 ${Number(submission.attempt_no || 1)} 次${submission.status === 'submitted' ? '提交' : '草稿'}`,
      schoolSummary: this.joinParts([submission.school, submission.grade_name || '未设置年级', submission.class_name]),
      timeText: `${submission.status === 'submitted' ? '提交时间' : '更新时间'}：${submission.submitted_at || submission.updated_at || '—'}`,
      scoreText: submission.total_score != null ? String(submission.total_score) : '未评分',
      initial: this.getNameInitial(submission.child_name)
    })
  },

  /**
   * 将答案数组标准化为答卷详情页的答案卡片数据。
   * @param {Array<Object>} answers 原始答案列表。
   * @returns {Array<Object>} 返回适合答卷详情渲染的答案卡片数据。
   */
  normalizeAnswerCards(answers) {
    return (answers || []).map((item, index) => Object.assign({}, item, {
      displayIndex: index + 1 < 10 ? `0${index + 1}` : String(index + 1),
      displayText: this.getAnswerDisplayText(item)
    }))
  },

  /**
   * 汇总列表态顶部 hero 的统计数据。
   * @param {Array<Object>} list 标准化后的答卷列表。
   * @returns {{total: number, draftCount: number, submittedCount: number}} 返回列表概览统计。
   */
  buildListStats(list) {
    return list.reduce((result, item) => {
      result.total += 1
      if (item && item.status === 'submitted') {
        result.submittedCount += 1
      } else {
        result.draftCount += 1
      }
      return result
    }, this.createEmptyListStats())
  },

  /**
   * 构造列表态 hero 标签数组。
   * @param {{total: number, draftCount: number, submittedCount: number}} stats 列表统计对象。
   * @returns {string[]} 返回适合顶部展示的标签文案数组。
   */
  buildListHeroTags(stats) {
    return [
      `${stats.total} 条记录`,
      `${stats.draftCount} 草稿`,
      `${stats.submittedCount} 已提交`
    ]
  },

  /**
   * 构造详情态 hero 标签数组。
   * @param {Object} submission 标准化后的答卷详情对象。
   * @returns {string[]} 返回适合顶部展示的标签文案数组。
   */
  buildDetailHeroTags(submission) {
    return [
      submission.statusText,
      `已答 ${Number(submission.answered_count || 0)} 题`,
      submission.total_score != null ? `得分 ${submission.total_score}` : '未评分'
    ]
  },

  /**
   * 生成人类可读的提交状态文案。
   * @param {string} status 提交状态值，如 submitted 或 draft。
   * @returns {string} 返回中文状态文案。
   */
  getSubmissionStatusText(status) {
    return status === 'submitted' ? '已提交' : '草稿'
  },

  /**
   * 生成当前孩子档案摘要文案。
   * @param {Object} child 孩子档案对象。
   * @returns {string} 返回学校、年级和班级组成的摘要文案。
   */
  getChildSummary(child) {
    if (!child || !child._id) return '请先完善孩子档案后再查看填写记录'
    return this.joinParts([child.school, child.grade_name || '未设置年级', child.class_name]) || '已绑定当前孩子档案'
  },

  /**
   * 拼接多个文案片段并自动过滤空值。
   * @param {Array<any>} parts 待拼接的文案片段数组。
   * @returns {string} 返回使用分隔符连接后的字符串。
   */
  joinParts(parts) {
    return (parts || []).filter(Boolean).join(' · ')
  },

  /**
   * 提取姓名首字作为头像占位字符。
   * @param {string} name 姓名字符串。
   * @returns {string} 返回单字符首字；缺失时回退为问号。
   */
  getNameInitial(name) {
    if (!name) return '?'
    return String(name).slice(0, 1)
  },

  /**
   * 将答案对象转换为详情页可读的展示文案。
   * @param {Object} answer 单条答案对象。
   * @returns {string} 返回适合直接展示的答案文本。
   */
  getAnswerDisplayText(answer) {
    if (answer && answer.answer_text) return String(answer.answer_text)

    const value = answer ? answer.answer : null
    if (Array.isArray(value)) return value.length > 0 ? value.join('、') : '—'
    if (value && typeof value === 'object') {
      try {
        return JSON.stringify(value)
      } catch (error) {
        return '—'
      }
    }
    if (value === null || value === undefined || value === '') return '—'
    return String(value)
  },

  /**
   * 打开单条答卷详情页。
   * @param {WechatMiniprogram.BaseEvent} e 点击事件对象，包含提交记录 ID。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  openSubmissionDetail(e) {
    const submissionId = e.currentTarget.dataset.id
    if (!submissionId) return

    wx.navigateTo({
      url: `/pages/questionnaire/history/index?questionnaire_id=${encodeURIComponent(this.data.questionnaireId)}&submission_id=${encodeURIComponent(submissionId)}`
    })
  },

  /**
   * 跳转到档案编辑页，供用户先完善孩子资料。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部执行页面跳转。
   */
  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit/index'
    })
  }
})