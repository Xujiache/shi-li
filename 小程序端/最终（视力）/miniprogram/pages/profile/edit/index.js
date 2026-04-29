const app = getApp()
const { getSchoolOptions, getChildren, createChild, updateChild, getProfileFieldConfig, getChildAnalysis } = require('../../../utils/api')

const KNOWN_CHILD_COLUMNS = new Set([
  'vision_r', 'vision_l', 'vision_both',
  'refraction_r_detail', 'refraction_l_detail',
  'curvature_r', 'curvature_l',
  'axial_length_r', 'axial_length_l',
  'diagnosis_json', 'management_plan', 'optometrist_name', 'exam_date',
  'tcm_symptoms_json', 'tcm_symptom_other',
  'tcm_syndrome_types', 'tcm_syndrome_other',
  'risk_level', 'treatment_plans', 'treatment_other', 'doctor_name'
])

var NESTED_FIELD_MAP = {
  'diagnosis_vision': { parent: 'diagnosis_json', subkey: 'vision' },
  'diagnosis_refraction': { parent: 'diagnosis_json', subkey: 'refraction' },
  'diagnosis_axial': { parent: 'diagnosis_json', subkey: 'axial' },
  'diagnosis_curvature': { parent: 'diagnosis_json', subkey: 'curvature' },
  'diagnosis_axial_ratio': { parent: 'diagnosis_json', subkey: 'axial_ratio' }
}

var ALIAS_FIELD_MAP = {
  'tcm_symptoms': 'tcm_symptoms_json'
}

var COMPOUND_FIELDS = new Set(['refraction_r_detail', 'refraction_l_detail'])

function compoundToString(obj) {
  if (!obj || typeof obj !== 'object') return ''
  var parts = []
  if (obj.s) parts.push('S:' + obj.s)
  if (obj.c) parts.push('C:' + obj.c)
  if (obj.a) parts.push('A:' + obj.a)
  return parts.join(' ')
}

function stringToCompound(str) {
  if (!str || typeof str !== 'string') return { s: '', c: '', a: '' }
  var result = { s: '', c: '', a: '' }
  var parts = str.split(/\s+/)
  parts.forEach(function(p) {
    var kv = p.split(':')
    if (kv.length === 2) {
      var k = kv[0].toUpperCase()
      if (k === 'S') result.s = kv[1]
      else if (k === 'C') result.c = kv[1]
      else if (k === 'A') result.a = kv[1]
    }
  })
  return result
}

Page({
  data: {
    childId: null,
    analysis: null,
    analysisLoading: false,
    age: '',
    canSubmit: false,
    schoolOptions: [],
    classOptions: [],
    schoolClassMap: {},
    school_index: -1,
    class_index: -1,
    schoolHelper: '',
    classHelper: '',
    from: '',

    dynamicSections: [],
    formValues: {},
    pickerIndexes: {},
    multiSelectState: {},

    sections: { basic: true },

    form: {
      name: '',
      gender: '',
      dob: '',
      school: '',
      class_name: '',
      height: '',
      weight: ''
    }
  },

  toggleSection(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ [`sections.${key}`]: !this.data.sections[key] })
  },

  onLoad(options) {
    const id = options && (options.id || options.childId) ? String(options.id || options.childId) : ''
    const from = options && options.from ? String(options.from) : ''
    if (id) this.setData({ childId: id })
    if (from) this.setData({ from })
    this.loadFieldConfig()
    this.loadSchoolOptions()
    this.loadCurrentChild()
  },

  async loadFieldConfig() {
    try {
      const data = await getProfileFieldConfig()
      if (data && data.config && Array.isArray(data.config.sections)) {
        const dynamicSections = data.config.sections.map((s) => ({
          key: s.key,
          label: s.label || '',
          enabled: s.enabled !== false,
          sort_order: s.sort_order || 0,
          fields: Array.isArray(s.fields) ? s.fields.map((f) => ({
            key: f.key,
            label: f.label || '',
            type: f.type || 'text',
            options: Array.isArray(f.options) ? f.options : [],
            placeholder: f.placeholder || '',
            enabled: f.enabled !== false,
            required: f.required === true,
            sort_order: f.sort_order || 0,
            readonly: f.readonly === true
          })) : []
        }))
        const sectionToggles = {}
        dynamicSections.forEach((s) => { sectionToggles[s.key] = false })
        this.setData({
          dynamicSections,
          sections: { basic: true, ...sectionToggles }
        })
      }
    } catch (e) {
      console.warn('加载档案字段配置失败，使用默认配置', e)
    }
  },

  async loadSchoolOptions() {
    try {
      const data = await getSchoolOptions()
      if (data) {
        const schools = Array.isArray(data.schools) ? data.schools : []
        const classesMap = data.classes_map && typeof data.classes_map === 'object' ? data.classes_map : {}
        const helper = schools.length === 0 ? '请联系管理员在后台配置学校/班级' : ''
        this.setData({
          schoolOptions: schools,
          schoolClassMap: classesMap,
          schoolHelper: helper,
          classHelper: helper
        })
        this.syncSchoolClassFromForm(false)
        this.updateAgeAndSubmit()
      } else {
        const helper = '请联系管理员在后台配置学校/班级'
        this.setData({ schoolOptions: [], classOptions: [], schoolClassMap: {}, schoolHelper: helper, classHelper: helper })
        this.updateAgeAndSubmit()
      }
    } catch (e) {
      const helper = '请联系管理员在后台配置学校/班级'
      this.setData({ schoolOptions: [], classOptions: [], schoolClassMap: {}, schoolHelper: helper, classHelper: helper })
      this.updateAgeAndSubmit()
    }
  },

  syncSchoolClassFromForm(showToast = true) {
    const f = this.data.form || {}
    const schools = this.data.schoolOptions || []
    const map = this.data.schoolClassMap || {}

    let school = typeof f.school === 'string' ? f.school : ''
    let cls = typeof f.class_name === 'string' ? f.class_name : ''

    let schoolIndex = schools.indexOf(school)
    if (school && schools.length > 0 && schoolIndex < 0) {
      school = ''
      cls = ''
      schoolIndex = -1
      if (showToast) wx.showToast({ title: '学校需从后台选项中选择', icon: 'none' })
    }

    const classOptions = school ? (Array.isArray(map[school]) ? map[school] : []) : []
    let classIndex = classOptions.indexOf(cls)
    if (cls && classOptions.length > 0 && classIndex < 0) {
      cls = ''
      classIndex = -1
      if (showToast) wx.showToast({ title: '班级需从后台选项中选择', icon: 'none' })
    }

    if (school !== f.school || cls !== f.class_name) {
      this.setData({
        form: { ...f, school, class_name: cls },
        school_index: schoolIndex,
        class_index: classIndex,
        classOptions
      })
    } else {
      this.setData({ school_index: schoolIndex, class_index: classIndex, classOptions })
    }
  },

  onSchoolPickerChange(e) {
    const idx = e.detail.valueIndex
    const schools = this.data.schoolOptions || []
    const school = schools[idx] || ''
    const map = this.data.schoolClassMap || {}
    const classOptions = school ? (Array.isArray(map[school]) ? map[school] : []) : []
    this.setData({
      form: { ...this.data.form, school, class_name: '' },
      school_index: idx,
      class_index: -1,
      classOptions
    })
    this.updateAgeAndSubmit()
  },

  onClassPickerChange(e) {
    const idx = e.detail.valueIndex
    const options = this.data.classOptions || []
    const className = options[idx] || ''
    this.setData({
      form: { ...this.data.form, class_name: className },
      class_index: idx
    })
    this.updateAgeAndSubmit()
  },

  async loadCurrentChild() {
    try {
      const data = await getChildren()
      if (data && Array.isArray(data.list) && data.list.length > 0) {
        const list = data.list.filter((c) => c && c._id)
        const preferId = this.data.childId || wx.getStorageSync('current_child_id') || ''
        const child = preferId ? list.find((c) => c._id === preferId) : list[0]
        if (child) {
          app.globalData.currentChild = child
          wx.setStorageSync('current_child_id', child._id)
          this.setData({ childId: child._id })
          this.fillFormFromChild(child)
          this.loadAnalysis(child._id)
        }
      }
      this.updateAgeAndSubmit()
    } catch (e) {
      console.error(e)
      this.syncSchoolClassFromForm(false)
      this.updateAgeAndSubmit()
    }
  },

  async loadAnalysis(childId) {
    if (!childId) return
    this.setData({ analysisLoading: true, analysis: null })
    try {
      const data = await getChildAnalysis(childId)
      this.setData({ analysis: (data && data.analysis) || null })
    } catch (e) {
      this.setData({ analysis: null })
    } finally {
      this.setData({ analysisLoading: false })
    }
  },

  fillFormFromChild(child) {
    this.setData({
      form: {
        name: child.name || '',
        gender: child.gender || '',
        dob: child.dob || '',
        school: child.school || '',
        class_name: child.class_name || '',
        height: child.height != null ? String(child.height) : '',
        weight: child.weight != null ? String(child.weight) : ''
      }
    })
    this.syncSchoolClassFromForm(false)

    const formValues = {}
    const multiSelectState = {}
    const pickerIndexes = {}

    const dynSections = this.data.dynamicSections || []
    dynSections.forEach((section) => {
      section.fields.forEach((field) => {
        const val = this._getChildFieldValue(child, field.key)

        if (field.type === 'multi_select') {
          const arr = Array.isArray(val) ? val : []
          formValues[field.key] = arr
          arr.forEach((v) => { multiSelectState[field.key + '_' + v] = true })
          ;(field.options || []).forEach((opt) => {
            if (!arr.includes(opt)) multiSelectState[field.key + '_' + opt] = false
          })
        } else if (field.type === 'select') {
          const strVal = typeof val === 'string' ? val : ''
          formValues[field.key] = strVal
          const idx = (field.options || []).indexOf(strVal)
          pickerIndexes[field.key] = idx >= 0 ? idx : -1
        } else {
          formValues[field.key] = val != null ? String(val) : ''
        }
      })
    })

    this.setData({ formValues, multiSelectState, pickerIndexes })
  },

  _getChildFieldValue(child, fieldKey) {
    if (!child) return ''

    if (NESTED_FIELD_MAP[fieldKey]) {
      var map = NESTED_FIELD_MAP[fieldKey]
      var parentObj = child[map.parent]
      if (parentObj && typeof parentObj === 'object') {
        var v = parentObj[map.subkey]
        return v != null ? v : ''
      }
      return ''
    }

    if (ALIAS_FIELD_MAP[fieldKey]) {
      var aliasKey = ALIAS_FIELD_MAP[fieldKey]
      var raw = child[aliasKey]
      return raw != null ? raw : ''
    }

    if (COMPOUND_FIELDS.has(fieldKey)) {
      var obj = child[fieldKey]
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return compoundToString(obj)
      }
      return typeof obj === 'string' ? obj : ''
    }

    if (KNOWN_CHILD_COLUMNS.has(fieldKey)) {
      var val = child[fieldKey]
      return val != null ? val : ''
    }

    var custom = child.custom_fields_json
    if (custom && typeof custom === 'object' && custom[fieldKey] !== undefined) {
      return custom[fieldKey]
    }
    return ''
  },

  // ── 基础信息事件 ──

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ [`form.${field}`]: value })
    this.updateAgeAndSubmit()
  },

  onGenderChange(e) {
    this.setData({ 'form.gender': e.detail.value })
    this.updateAgeAndSubmit()
  },

  onDatePickerChange(e) {
    this.setData({ 'form.dob': e.detail.value })
    this.updateAgeAndSubmit()
  },

  // ── 动态字段事件 ──

  onDynamicFieldChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value || ''
    this.setData({ [`formValues.${field}`]: value })
  },

  onDynamicPickerChange(e) {
    const field = e.currentTarget.dataset.field
    const options = e.currentTarget.dataset.options || []
    const idx = Number(e.detail.value)
    const value = options[idx] || ''
    this.setData({
      [`formValues.${field}`]: value,
      [`pickerIndexes.${field}`]: idx
    })
  },

  onDynamicMultiToggle(e) {
    const field = e.currentTarget.dataset.field
    const value = e.currentTarget.dataset.value
    if (!field || !value) return

    const stateKey = field + '_' + value
    const isOn = !this.data.multiSelectState[stateKey]
    this.setData({ [`multiSelectState.${stateKey}`]: isOn })

    const dynSections = this.data.dynamicSections || []
    let fieldOptions = []
    for (const s of dynSections) {
      const f = s.fields.find((ff) => ff.key === field)
      if (f) { fieldOptions = f.options || []; break }
    }

    const selected = fieldOptions.filter((opt) => {
      if (opt === value) return isOn
      return !!this.data.multiSelectState[field + '_' + opt]
    })
    this.setData({ [`formValues.${field}`]: selected })
  },

  onDynamicDateChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value || ''
    this.setData({ [`formValues.${field}`]: value })
  },

  onDynamicTextarea(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value || ''
    this.setData({ [`formValues.${field}`]: value })
  },

  // ── 提交逻辑 ──

  updateAgeAndSubmit() {
    const dob = this.data.form.dob
    let age = ''
    if (dob) {
      const d = new Date(dob)
      if (!Number.isNaN(d.getTime())) {
        const now = new Date()
        let years = now.getFullYear() - d.getFullYear()
        const m = now.getMonth() - d.getMonth()
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1
        age = years >= 0 ? String(years) : ''
      }
    }
    const f = this.data.form
    const canSubmit = Boolean(f.name && f.gender && f.dob && f.school && f.class_name)
    this.setData({ age, canSubmit })
  },

  _buildPayload() {
    const f = this.data.form
    const payload = {
      name: f.name,
      gender: f.gender,
      dob: f.dob,
      age: this.data.age ? Number(this.data.age) : null,
      school: f.school,
      class_name: f.class_name,
      height: f.height === '' ? null : Number(f.height),
      weight: f.weight === '' ? null : Number(f.weight)
    }

    const formValues = this.data.formValues || {}
    const customFields = {}
    const nestedAccum = {}

    const dynSections = this.data.dynamicSections || []
    dynSections.forEach((section) => {
      if (!section.enabled) return
      section.fields.forEach((field) => {
        if (!field.enabled) return
        const val = formValues[field.key]

        if (NESTED_FIELD_MAP[field.key]) {
          var map = NESTED_FIELD_MAP[field.key]
          if (!nestedAccum[map.parent]) nestedAccum[map.parent] = {}
          if (field.type === 'multi_select') {
            nestedAccum[map.parent][map.subkey] = Array.isArray(val) ? val : []
          } else {
            nestedAccum[map.parent][map.subkey] = val != null ? val : ''
          }
        } else if (ALIAS_FIELD_MAP[field.key]) {
          var dbKey = ALIAS_FIELD_MAP[field.key]
          if (field.type === 'multi_select') {
            payload[dbKey] = Array.isArray(val) ? val : []
          } else {
            payload[dbKey] = val != null ? val : ''
          }
        } else if (COMPOUND_FIELDS.has(field.key)) {
          payload[field.key] = typeof val === 'string' ? stringToCompound(val) : (val || { s: '', c: '', a: '' })
        } else if (KNOWN_CHILD_COLUMNS.has(field.key)) {
          if (field.type === 'multi_select') {
            payload[field.key] = Array.isArray(val) ? val : []
          } else {
            payload[field.key] = val != null ? val : ''
          }
        } else {
          if (val !== undefined && val !== '' && (!Array.isArray(val) || val.length > 0)) {
            customFields[field.key] = val
          }
        }
      })
    })

    Object.keys(nestedAccum).forEach(function(parentKey) {
      payload[parentKey] = nestedAccum[parentKey]
    })

    if (Object.keys(customFields).length > 0) {
      payload.custom_fields_json = customFields
    }

    return payload
  },

  async onSubmit() {
    const f = this.data.form
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请完善必填信息', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中...' })
    try {
      const payload = this._buildPayload()

      let childId = this.data.childId
      if (childId) {
        await updateChild(childId, payload)
      } else {
        const created = await createChild(payload)
        childId = created && created.child ? created.child._id : ''
      }

      wx.hideLoading()
      wx.showToast({ title: '档案提交成功' })
      try {
        const nextData = await getChildren()
        if (nextData && Array.isArray(nextData.list) && nextData.list.length > 0) {
          const list = nextData.list.filter((c) => c && c._id)
          const child = childId ? list.find((c) => c._id === childId) : list[0]
          if (child) {
            app.globalData.currentChild = child
            wx.setStorageSync('current_child_id', child._id)
          }
        }
      } catch (_) {}
      setTimeout(() => {
        if (this.data.from === 'child_select') {
          wx.navigateBack({ delta: 1, fail: () => { wx.reLaunch({ url: '/pages/children/select/index' }) } })
          return
        }
        wx.reLaunch({ url: '/pages/home/index/index', fail: () => { wx.switchTab({ url: '/pages/home/index/index' }) } })
      }, 1200)
    } catch (e) {
      wx.hideLoading()
      wx.showModal({
        title: '提交失败',
        content: e && e.message ? String(e.message) : '网络异常，请稍后重试',
        showCancel: false
      })
      console.error(e)
    }
  }
})
