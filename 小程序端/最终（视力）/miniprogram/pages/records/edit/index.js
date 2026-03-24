const app = getApp()
const {
  getChildren,
  getCheckupRecord,
  createCheckupRecord,
  updateCheckupRecord
} = require('../../../utils/api')

function toYmd(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

Page({
  data: {
    childInfo: {},
    tongueShapeOptions: ['正常', '胖大', '瘦薄', '裂纹', '齿痕', '不清楚'],
    tongueColorOptions: ['淡红', '红', '暗红', '淡白', '紫暗', '不清楚'],
    tongueCoatingOptions: ['薄白', '厚白', '黄苔', '少苔', '无苔', '不清楚'],
    tongue_shape_index: -1,
    tongue_color_index: -1,
    tongue_coating_index: -1,
    mode: 'create',
    recordId: '',
    saving: false,
    errors: {
      date: ''
    },
    form: {
      date: '',
      height: '',
      weight: '',
      tongue_shape: '',
      tongue_color: '',
      tongue_coating: '',
      vision_l: '',
      vision_r: '',
      refraction_r_s: '',
      refraction_r_c: '',
      refraction_r_a: '',
      refraction_l_s: '',
      refraction_l_c: '',
      refraction_l_a: '',
      diagnosis_vision_status: '',
      diagnosis_refraction_status: '',
      diagnosis_axis_status: '',
      diagnosis_cornea_status: '',
      conclusion: ''
    }
  },

  onShow() {
    const current = app.globalData.currentChild
    if (current && current._id && (!this.data.childInfo._id || this.data.childInfo._id !== current._id)) {
      this.setData({
        childInfo: current,
        mode: 'create',
        recordId: '',
        errors: { date: '' },
        form: {
          date: toYmd(new Date()),
          height: '',
          weight: '',
          tongue_shape: '',
          tongue_color: '',
          tongue_coating: '',
          vision_l: '',
          vision_r: '',
          refraction_r_s: '',
          refraction_r_c: '',
          refraction_r_a: '',
          refraction_l_s: '',
          refraction_l_c: '',
          refraction_l_a: '',
          diagnosis_vision_status: '',
          diagnosis_refraction_status: '',
          diagnosis_axis_status: '',
          diagnosis_cornea_status: '',
          conclusion: ''
        },
        tongue_shape_index: -1,
        tongue_color_index: -1,
        tongue_coating_index: -1
      })
    }
  },

  onLoad(options) {
    this.init(options)
  },

  async init(options) {
    const childId = options && options.child_id ? String(options.child_id) : ''
    const recordId = options && options.record_id ? String(options.record_id) : ''

    await this.ensureChild(childId)

    if (recordId) {
      this.setData({ recordId, mode: 'update' })
      await this.loadRecord(recordId)
    } else {
      if (!this.data.form.date) {
        this.setData({ 'form.date': toYmd(new Date()) })
      }
    }
  },

  async ensureChild(preferId) {
    const current = app.globalData.currentChild
    if (current && current._id && (!preferId || current._id === preferId)) {
      this.setData({ childInfo: current })
      return
    }
    await this.fetchChildInfo(preferId)
  },

  async fetchChildInfo(preferId) {
    try {
      const data = await getChildren()
      if (data && Array.isArray(data.list)) {
        const list = data.list.filter((c) => c && c._id)
        const cachedId = wx.getStorageSync('current_child_id') || ''
        const fromPrefer = preferId ? list.find((c) => c._id === preferId) : null
        const fromCache = cachedId ? list.find((c) => c._id === cachedId) : null
        const child = fromPrefer || fromCache || list[0] || null
        if (child) {
          app.globalData.currentChild = child
          wx.setStorageSync('current_child_id', child._id)
          this.setData({ childInfo: child })
          return
        }
      }
      this.setData({ childInfo: {} })
    } catch (e) {
      this.setData({ childInfo: {} })
    }
  },

  async loadRecord(recordId) {
    wx.showLoading({ title: '加载中...' })
    try {
      const data = await getCheckupRecord(recordId)
      wx.hideLoading()

      if (data && data.record) {
        this.fillForm(data.record)
        return
      }
      wx.showToast({ title: '加载失败', icon: 'none' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  fillForm(record) {
    const r = record || {}
    const rl = (r.refraction_l && typeof r.refraction_l === 'object') ? r.refraction_l : {}
    const rr = (r.refraction_r && typeof r.refraction_r === 'object') ? r.refraction_r : {}
    const d = (r.diagnosis && typeof r.diagnosis === 'object') ? r.diagnosis : {}

    this.setData({
      form: {
        date: r.date || '',
        height: r.height === undefined || r.height === null ? '' : String(r.height),
        weight: r.weight === undefined || r.weight === null ? '' : String(r.weight),
        tongue_shape: r.tongue_shape || '',
        tongue_color: r.tongue_color || '',
        tongue_coating: r.tongue_coating || '',
        vision_l: r.vision_l || '',
        vision_r: r.vision_r || '',
        refraction_r_s: rr.s || '',
        refraction_r_c: rr.c || '',
        refraction_r_a: rr.a || '',
        refraction_l_s: rl.s || '',
        refraction_l_c: rl.c || '',
        refraction_l_a: rl.a || '',
        diagnosis_vision_status: d.vision_status || '',
        diagnosis_refraction_status: d.refraction_status || '',
        diagnosis_axis_status: d.axis_status || '',
        diagnosis_cornea_status: d.cornea_status || '',
        conclusion: r.conclusion || ''
      }
    })
    this.updateTonguePickerIndexes()
  },

  changeChild() {
    wx.navigateTo({ url: '/pages/children/select/index?from=record' })
  },

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return
    const value = e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ [`form.${field}`]: value })
  },

  /**
   * 处理舌诊选择字段的变更并同步当前下标。
   * @param {WechatMiniprogram.CustomEvent} e 选择器事件对象，包含字段名、选项数组键和选中下标。
   * @returns {void} 无返回值，直接更新表单值和对应下标。
   */
  onPickerFieldChange(e) {
    const field = e.currentTarget.dataset.field
    const rangeKey = e.currentTarget.dataset.range
    const idx = e.detail.valueIndex
    const options = this.data[rangeKey] || []
    const value = options[idx] || ''
    if (!field) return

    this.setData({
      [`form.${field}`]: value,
      [`${field}_index`]: idx
    })
  },

  onDateChange(e) {
    const value = e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    this.setData({ 'form.date': value })
  },

  onTextareaInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail && typeof e.detail.value === 'string' ? e.detail.value : ''
    if (!field) return
    this.setData({ [`form.${field}`]: value })
  },

  validate() {
    const errors = { date: '' }
    if (!this.data.childInfo._id) {
      wx.showToast({ title: '请先选择孩子', icon: 'none' })
      return { ok: false, errors }
    }
    if (!this.data.form.date) {
      errors.date = '请选择检测日期'
    }
    this.setData({ errors })
    return { ok: !errors.date, errors }
  },

  /**
   * 根据当前表单值刷新舌诊选择器下标，便于编辑回填时正确显示。
   * @param {void} 无 无入参。
   * @returns {void} 无返回值，直接更新三个舌诊字段的索引状态。
   */
  updateTonguePickerIndexes() {
    const f = this.data.form || {}
    const idx = (arr, v) => {
      const i = (arr || []).indexOf(v)
      return i >= 0 ? i : -1
    }

    this.setData({
      tongue_shape_index: idx(this.data.tongueShapeOptions, f.tongue_shape),
      tongue_color_index: idx(this.data.tongueColorOptions, f.tongue_color),
      tongue_coating_index: idx(this.data.tongueCoatingOptions, f.tongue_coating)
    })
  },

  buildRecordFromForm() {
    const f = this.data.form
    return {
      child_id: this.data.childInfo._id,
      date: f.date,
      height: f.height,
      weight: f.weight,
      tongue_shape: f.tongue_shape,
      tongue_color: f.tongue_color,
      tongue_coating: f.tongue_coating,
      vision_l: f.vision_l,
      vision_r: f.vision_r,
      refraction_l: { s: f.refraction_l_s, c: f.refraction_l_c, a: f.refraction_l_a },
      refraction_r: { s: f.refraction_r_s, c: f.refraction_r_c, a: f.refraction_r_a },
      diagnosis: {
        vision_status: f.diagnosis_vision_status,
        refraction_status: f.diagnosis_refraction_status,
        axis_status: f.diagnosis_axis_status,
        cornea_status: f.diagnosis_cornea_status
      },
      conclusion: f.conclusion
    }
  },

  async onSave() {
    if (this.data.saving) return
    const v = this.validate()
    if (!v.ok) return

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const record = this.buildRecordFromForm()

      if (this.data.mode === 'update' && this.data.recordId) {
        await updateCheckupRecord(this.data.recordId, record)
        wx.hideLoading()
        this.setData({ saving: false })
        wx.showToast({ title: '已保存' })
        this.goToDashboard()
        return
      }

      await createCheckupRecord(record)

      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({ title: '已保存' })
      this.goToDashboard()
    } catch (e) {
      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({ title: (e && e.message) ? String(e.message) : '保存失败', icon: 'none' })
    }
  },

  goToDashboard() {
    wx.navigateTo({ url: '/pages/dashboard/index/index' })
  }
})
