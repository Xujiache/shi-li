const app = getApp()
const {
  getChildren,
  getUserProfile,
  getQuestionnaireDetail,
  saveQuestionnaireDraft,
  submitQuestionnaire,
  getQuestionnaireSubmissionDetail
} = require('../../../utils/api')

Page({
  data: {
    questionnaireId: '',
    submissionId: '',
    questionnaire: null,
    sections: [],
    currentPageNo: 1,
    totalPages: 1,
    currentSections: [],
    childInfo: {},
    userProfile: {},
    answers: {},
    pageProgressText: '第 1 / 1 页',
    progressPercent: 0,
    currentPageTitle: '当前页面',
    currentPageSummary: '页面正在准备题目内容',
    currentPageQuestionCount: 0,
    currentPageAnsweredCount: 0,
    currentPageStatusText: '0 / 0 已填写',
    entryModeText: '实时填写',
    loading: true,
    savingDraft: false,
    submitting: false
  },

  /**
   * 页面加载时记录问卷 ID 和草稿提交 ID。
   * @param {Record<string, string>} options 页面路由参数，包含问卷 ID 与提交 ID。
   * @returns {void} 无返回值，直接更新页面基础参数。
   */
  onLoad(options) {
    this.setData({
      questionnaireId: options && options.id ? String(options.id) : '',
      submissionId: options && options.submission_id ? String(options.submission_id) : ''
    })
  },

  /**
   * 页面显示时刷新填写上下文与问卷内容。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部触发页面初始化。
   */
  onShow() {
    this.initData()
  },

  /**
   * 处理下拉刷新，并在完成后关闭系统刷新态。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部完成页面刷新与收尾。
   */
  onPullDownRefresh() {
    this.initData().finally(() => wx.stopPullDownRefresh())
  },

  /**
   * 初始化填写页数据，包括档案上下文和问卷题目内容。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回初始化 Promise，供页面生命周期与下拉刷新复用。
   */
  async initData() {
    if (!this.data.questionnaireId) {
      this.resetQuestionnaireState({
        loading: false,
        currentPageSummary: '未获取到问卷编号，请返回后重新进入'
      })
      return
    }

    this.setData({ loading: true })

    await this.ensureProfileContext()

    if (!this.data.childInfo || !this.data.childInfo._id) {
      this.resetQuestionnaireState({
        loading: false,
        currentPageSummary: '请先完善孩子档案，系统需要按学校、年级和班级匹配问卷'
      })
      return
    }

    try {
      await this.loadQuestionnaire()
    } catch (error) {
      console.error(error)
      this.resetQuestionnaireState({
        currentPageSummary: '问卷加载失败，请稍后重试'
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
   * 获取填写页需要的孩子档案和当前用户资料。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回上下文加载 Promise，完成后更新页面展示信息。
   */
  async ensureProfileContext() {
    const childInfo = await this.resolveChildInfo()
    let userProfile = {}

    try {
      const profileData = await getUserProfile()
      userProfile = profileData && profileData.profile ? profileData.profile : {}
    } catch (error) {
      console.error(error)
      userProfile = {}
    }

    this.setData({
      childInfo,
      userProfile
    })
  },

  /**
   * 解析当前应使用的孩子档案，并优先恢复最近一次选择的孩子。
   * @param {void} 无 无入参。
   * @returns {Promise<Object>} 返回命中的孩子档案对象；未命中时返回空对象。
   */
  async resolveChildInfo() {
    if (app.globalData.currentChild && app.globalData.currentChild._id) {
      return app.globalData.currentChild
    }

    try {
      const childData = await getChildren()
      if (childData && Array.isArray(childData.list) && childData.list.length > 0) {
        const list = childData.list.filter((child) => child && child._id)
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
   * 重置填写页的问卷相关状态，供异常或空数据场景兜底使用。
   * @param {Record<string, any>} extra 需要额外覆盖的状态字段。
   * @returns {void} 无返回值，直接回填默认状态。
   */
  resetQuestionnaireState(extra) {
    this.setData(Object.assign({
      questionnaire: null,
      sections: [],
      currentPageNo: 1,
      totalPages: 1,
      currentSections: [],
      answers: {},
      pageProgressText: '第 1 / 1 页',
      progressPercent: 0,
      currentPageTitle: '当前页面',
      currentPageSummary: '页面正在准备题目内容',
      currentPageQuestionCount: 0,
      currentPageAnsweredCount: 0,
      currentPageStatusText: '0 / 0 已填写',
      entryModeText: '实时填写'
    }, extra || {}))
  },

  /**
   * 根据当前孩子和问卷 ID 拉取题目内容、草稿数据与初始答案。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回问卷加载 Promise，完成后更新当前页内容。
   */
  async loadQuestionnaire() {
    const detail = await getQuestionnaireDetail(this.data.questionnaireId, this.data.childInfo._id)
    const questionnaire = detail && detail.questionnaire ? detail.questionnaire : null
    const sections = detail && Array.isArray(detail.sections) ? detail.sections : []
    const pageNos = Array.from(new Set(
      sections.map((section) => Number(section && section.page_no ? section.page_no : 1))
    )).sort((a, b) => a - b)
    const currentPageNo = pageNos[0] || 1

    let answers = this.buildPrefillAnswers(sections)
    const targetSubmissionId = this.data.submissionId || (detail && detail.draft_submission_id ? String(detail.draft_submission_id) : '')

    if (targetSubmissionId) {
      const submissionDetail = await getQuestionnaireSubmissionDetail(targetSubmissionId)
      answers = this.mergeSubmissionAnswers(
        answers,
        submissionDetail && submissionDetail.answers ? submissionDetail.answers : [],
        sections
      )
    }

    this.setData({
      questionnaire,
      sections,
      answers,
      submissionId: targetSubmissionId,
      currentPageNo,
      totalPages: pageNos.length || 1,
      entryModeText: targetSubmissionId ? '草稿继续填写' : '实时填写'
    })

    this.refreshCurrentSections()

    if (questionnaire && questionnaire.title) {
      wx.setNavigationBarTitle({ title: questionnaire.title })
    }
  },

  /**
   * 基于基础档案信息生成预填答案对象。
   * @param {Array<Object>} sections 问卷分组列表，包含题目数组。
   * @returns {Record<string, any>} 返回按题目 ID 和题目 code 建立的预填答案映射。
   */
  buildPrefillAnswers(sections) {
    const answers = {}
    ;(sections || []).forEach((section) => {
      ;(section.questions || []).forEach((question) => {
        const value = this.getPrefillValue(question)
        if (value !== null && value !== undefined && value !== '') {
          answers[String(question.id)] = value
          if (question.code) answers[question.code] = value
        }
      })
    })
    return answers
  },

  /**
   * 将草稿/历史提交中的答案合并到当前答案对象中。
   * @param {Record<string, any>} baseAnswers 预填答案对象。
   * @param {Array<Object>} answerRows 提交记录中的答案明细列表。
   * @param {Array<Object>} sections 问卷分组列表，用于建立题目 ID 到 code 的映射。
   * @returns {Record<string, any>} 返回合并后的完整答案对象。
   */
  mergeSubmissionAnswers(baseAnswers, answerRows, sections) {
    const next = { ...baseAnswers }
    const codeMap = {}

    ;(sections || []).forEach((section) => {
      ;(section.questions || []).forEach((question) => {
        codeMap[String(question.id)] = question.code || ''
      })
    })

    ;(answerRows || []).forEach((row) => {
      const value = row && row.answer !== undefined ? row.answer : null
      next[String(row.question_id)] = value
      if (codeMap[String(row.question_id)]) {
        next[codeMap[String(row.question_id)]] = value
      }
    })

    return next
  },

  /**
   * 根据题目绑定的档案字段读取默认预填值。
   * @param {Object} question 单个题目对象，包含 settings.profile_key 配置。
   * @returns {string} 返回可用于题目初始化的预填字符串。
   */
  getPrefillValue(question) {
    const settings = question && question.settings ? question.settings : {}
    const profileKey = settings.profile_key
    if (!profileKey) return ''

    const child = this.data.childInfo || {}
    const userProfile = this.data.userProfile || {}
    const sourceMap = {
      name: child.name || '',
      child_name: child.name || '',
      school: child.school || '',
      grade_name: child.grade_name || '',
      class_name: child.class_name || '',
      gender: child.gender || '',
      dob: child.dob || '',
      child_no: child.child_no || '',
      parent_phone: child.parent_phone || '',
      user_no: userProfile.user_no || '',
      display_name: userProfile.display_name || '',
      phone: userProfile.phone || ''
    }

    return Object.prototype.hasOwnProperty.call(sourceMap, profileKey) ? sourceMap[profileKey] : ''
  },

  /**
   * 根据当前答案和比较规则判断单个显隐条件是否成立。
   * @param {Object} condition 单个显隐条件对象。
   * @returns {boolean} 返回该条件是否满足。
   */
  evaluateCondition(condition) {
    const sourceType = condition.source_type || 'question'
    const comparator = condition.comparator || 'eq'
    const answers = this.data.answers || {}
    let leftValue = ''

    if (sourceType === 'profile') {
      const profileQuestion = { settings: { profile_key: condition.field_key } }
      leftValue = this.getPrefillValue(profileQuestion)
    } else if (condition.question_code) {
      leftValue = answers[condition.question_code]
    } else {
      leftValue = answers[String(condition.question_id || '')]
    }

    const rightValue = condition.value
    const left = Array.isArray(leftValue) ? leftValue.map(String) : leftValue
    const right = Array.isArray(rightValue) ? rightValue.map(String) : rightValue

    switch (comparator) {
      case 'neq':
        return left !== right
      case 'includes':
        return Array.isArray(left) ? left.includes(String(right)) : String(left || '').indexOf(String(right || '')) >= 0
      case 'not_includes':
        return Array.isArray(left) ? !left.includes(String(right)) : String(left || '').indexOf(String(right || '')) < 0
      case 'gt':
        return Number(left) > Number(right)
      case 'gte':
        return Number(left) >= Number(right)
      case 'lt':
        return Number(left) < Number(right)
      case 'lte':
        return Number(left) <= Number(right)
      case 'in':
        return Array.isArray(right) ? right.includes(String(left)) : false
      case 'eq':
      default:
        return left === right
    }
  },

  /**
   * 判断题目在当前答案上下文中是否需要展示。
   * @param {Object} question 单个题目对象，可能包含显隐规则。
   * @returns {boolean} 返回题目是否可见。
   */
  isQuestionVisible(question) {
    const rule = question && question.visibility_rule ? question.visibility_rule : {}
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
    if (conditions.length === 0) return true

    const operator = String(rule.operator || 'and').toLowerCase()
    const results = conditions.map((condition) => this.evaluateCondition(condition))
    return operator === 'or' ? results.some(Boolean) : results.every(Boolean)
  },

  /**
   * 生成题目输入时的占位文案。
   * @param {Object} question 单个题目对象，包含 settings 和 placeholder 配置。
   * @returns {string} 返回适合当前题型的占位提示文案。
   */
  getQuestionPlaceholder(question) {
    const settings = question && question.settings ? question.settings : {}
    if (settings.placeholder) return settings.placeholder
    if (question && question.placeholder) return question.placeholder
    if (question && question.type === 'date') return '请选择日期'
    return '请输入'
  },

  /**
   * 刷新当前页可见题目列表和进度统计。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，直接更新当前页展示数据。
   */
  refreshCurrentSections() {
    const currentPageNo = Number(this.data.currentPageNo || 1)
    const currentSections = (this.data.sections || [])
      .filter((section) => Number(section.page_no || 1) === currentPageNo)
      .map((section) => ({
        ...section,
        displayIndex: currentPageNo < 10 ? `0${currentPageNo}` : String(currentPageNo),
        questions: (section.questions || [])
          .filter((question) => this.isQuestionVisible(question))
          .map((question) => {
            const currentValue = this.getAnswer(question.id)
            const ratingValue = Number(currentValue)

            return {
              ...question,
              settings: question && question.settings ? question.settings : {},
              current_value: currentValue,
              placeholder_text: this.getQuestionPlaceholder(question),
              selected_rating: Number.isNaN(ratingValue) ? 0 : ratingValue,
              options: (question.options || []).map((option) => ({
                ...option,
                checked: Array.isArray(currentValue)
                  ? currentValue.map(String).includes(String(option.value))
                  : String(currentValue) === String(option.value)
              }))
            }
          })
      }))
      .filter((section) => (section.questions || []).length > 0)

    const currentPageQuestionCount = currentSections.reduce(
      (sum, section) => sum + ((section.questions || []).length),
      0
    )
    const currentPageAnsweredCount = this.getAnsweredCount(currentSections)
    const progressPercent = Math.round((currentPageNo / Math.max(Number(this.data.totalPages || 1), 1)) * 100)
    const currentPageTitle = currentSections.length === 1
      ? (currentSections[0].title || '当前页面')
      : currentSections.length > 1
        ? `当前页共 ${currentSections.length} 个分组`
        : '当前页暂无可见题目'
    const currentPageSummary = currentSections.length === 1
      ? (currentSections[0].description || `本页共 ${currentPageQuestionCount} 题，支持保存草稿后稍后继续填写。`)
      : currentSections.length > 1
        ? `本页共 ${currentPageQuestionCount} 题，题目会根据前面答案动态显示。`
        : '本页暂无需要填写的题目，可继续下一页或直接保存草稿。'

    this.setData({
      currentSections,
      pageProgressText: `第 ${currentPageNo} / ${this.data.totalPages} 页`,
      progressPercent,
      currentPageTitle,
      currentPageSummary,
      currentPageQuestionCount,
      currentPageAnsweredCount,
      currentPageStatusText: currentPageQuestionCount > 0
        ? `${currentPageAnsweredCount} / ${currentPageQuestionCount} 已填写`
        : '本页无题目'
    })
  },

  /**
   * 统计当前页已填写题目数量。
   * @param {Array<Object>} sections 当前页分组列表，题目对象中已注入 current_value。
   * @returns {number} 返回当前页已填写题目数量。
   */
  getAnsweredCount(sections) {
    return (sections || []).reduce((sectionTotal, section) => {
      return sectionTotal + (section.questions || []).reduce((questionTotal, question) => {
        return questionTotal + (this.hasAnswerValue(question.current_value) ? 1 : 0)
      }, 0)
    }, 0)
  },

  /**
   * 判断答案值是否可视为“已填写”。
   * @param {any} value 当前题目的答案值。
   * @returns {boolean} 返回该题是否已有有效答案。
   */
  hasAnswerValue(value) {
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && String(value) !== ''
  },

  /**
   * 读取指定题目的当前答案。
   * @param {string|number} questionId 题目 ID。
   * @returns {any} 返回题目的当前答案；无值时返回空字符串。
   */
  getAnswer(questionId) {
    const answers = this.data.answers || {}
    const value = answers[String(questionId)]
    return value === undefined || value === null ? '' : value
  },

  /**
   * 处理文本、数字和只读以外的通用输入变更。
   * @param {WechatMiniprogram.CustomEvent} e 输入事件对象，包含题目 ID、code 与最新值。
   * @returns {void} 无返回值，内部更新答案并刷新当前页。
   */
  onInputChange(e) {
    const questionId = String(e.currentTarget.dataset.questionId || '')
    const code = e.currentTarget.dataset.code || ''
    const value = e.detail.value
    const answers = { ...(this.data.answers || {}) }

    answers[questionId] = value
    if (code) answers[code] = value

    this.setData({ answers })
    this.refreshCurrentSections()
  },

  /**
   * 处理日期题的选值变更。
   * @param {WechatMiniprogram.CustomEvent} e 日期选择事件对象。
   * @returns {void} 无返回值，内部复用通用输入逻辑。
   */
  onDateChange(e) {
    this.onInputChange(e)
  },

  /**
   * 处理单选题的值变更。
   * @param {WechatMiniprogram.CustomEvent} e 单选组 change 事件对象。
   * @returns {void} 无返回值，内部复用通用输入逻辑。
   */
  onSingleChoiceChange(e) {
    this.onInputChange(e)
  },

  /**
   * 处理多选题的值变更。
   * @param {WechatMiniprogram.CustomEvent} e 多选组 change 事件对象。
   * @returns {void} 无返回值，内部更新数组答案并刷新当前页。
   */
  onMultiChoiceChange(e) {
    const questionId = String(e.currentTarget.dataset.questionId || '')
    const code = e.currentTarget.dataset.code || ''
    const value = e.detail.value || []
    const answers = { ...(this.data.answers || {}) }

    answers[questionId] = value
    if (code) answers[code] = value

    this.setData({ answers })
    this.refreshCurrentSections()
  },

  /**
   * 处理评分题点击，写入当前分值并刷新视图。
   * @param {WechatMiniprogram.CustomEvent} e 点击事件对象，包含题目 ID、code 和评分值。
   * @returns {void} 无返回值，内部更新答案并刷新当前页。
   */
  onRatingTap(e) {
    const questionId = String(e.currentTarget.dataset.questionId || '')
    const code = e.currentTarget.dataset.code || ''
    const value = Number(e.currentTarget.dataset.value || 0)
    const answers = { ...(this.data.answers || {}) }

    answers[questionId] = value
    if (code) answers[code] = value

    this.setData({ answers })
    this.refreshCurrentSections()
  },

  /**
   * 切换到上一页题目。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部更新页码并刷新当前页。
   */
  goPrevPage() {
    if (this.data.currentPageNo <= 1) return
    this.setData({ currentPageNo: this.data.currentPageNo - 1 })
    this.refreshCurrentSections()
  },

  /**
   * 切换到下一页题目。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，内部更新页码并刷新当前页。
   */
  goNextPage() {
    if (this.data.currentPageNo >= this.data.totalPages) return
    this.setData({ currentPageNo: this.data.currentPageNo + 1 })
    this.refreshCurrentSections()
  },

  /**
   * 组装草稿保存和正式提交所需的统一载荷。
   * @param {void} 无 无入参。
   * @returns {{child_id: string|number, submission_id: string|undefined, answers: Record<string, any>}} 返回统一提交数据。
   */
  buildPayload() {
    return {
      child_id: this.data.childInfo._id,
      submission_id: this.data.submissionId || undefined,
      answers: this.data.answers || {}
    }
  },

  /**
   * 保存当前填写内容为草稿。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回保存草稿 Promise，成功后更新 submissionId。
   */
  async saveDraft() {
    if (this.data.savingDraft) return

    this.setData({ savingDraft: true })
    wx.showLoading({ title: '保存草稿...' })

    try {
      const detail = await saveQuestionnaireDraft(this.data.questionnaireId, this.buildPayload())
      const submissionId = detail && detail.submission ? detail.submission._id : ''
      if (submissionId) {
        this.setData({
          submissionId,
          entryModeText: '草稿继续填写'
        })
      }
      wx.hideLoading()
      wx.showToast({ title: '草稿已保存' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: error && error.message ? String(error.message) : '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ savingDraft: false })
    }
  },

  /**
   * 提交当前问卷，并在成功后跳转到历史记录页。
   * @param {void} 无 无入参。
   * @returns {Promise<void>} 返回提交 Promise，成功后跳转到历史页。
   */
  async submit() {
    if (this.data.submitting) return

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交问卷...' })

    try {
      const detail = await submitQuestionnaire(this.data.questionnaireId, this.buildPayload())
      const submissionId = detail && detail.submission ? detail.submission._id : ''

      wx.hideLoading()
      wx.showToast({ title: '提交成功' })

      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/questionnaire/history/index?questionnaire_id=${encodeURIComponent(this.data.questionnaireId)}${submissionId ? `&submission_id=${encodeURIComponent(submissionId)}` : ''}`
        })
      }, 800)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: error && error.message ? String(error.message) : '提交失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
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