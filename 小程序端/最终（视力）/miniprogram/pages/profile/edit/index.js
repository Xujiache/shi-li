const app = getApp()
const { getSchoolOptions, getChildren, createChild, updateChild } = require('../../../utils/api')

const TCM_SYMPTOM_KEYS = [
  { key: 'eye_fatigue', label: '眼干易疲劳' },
  { key: 'blurred', label: '视物昏花' },
  { key: 'night_vision', label: '夜视力差' },
  { key: 'waist_leg', label: '腰酸腿软' },
  { key: 'poor_sleep', label: '睡眠差多梦' },
  { key: 'fatigue_attention', label: '乏力注意力差' },
  { key: 'pale_face', label: '面色少华' },
  { key: 'tongue_pulse_a', label: '舌质淡/少苔' },
  { key: 'weak_pulse', label: '脉细弱' }
]

const SEVERITY_OPTIONS = ['无', '轻', '中', '重']

const SYNDROME_OPTIONS = ['肝肾亏虚证', '肾精不足证', '肝血不足证', '脾气虚弱证', '心脾两虚证']

const RISK_OPTIONS = ['低危', '中危', '高危（眼轴快涨型）']

const TREATMENT_OPTIONS = ['补肾填精固轴', '养肝血明目', '健脾益气升清', '综合干预（中药+外治+训练）']

const DIAG_VISION_OPTIONS = ['正常', '不正常']
const DIAG_REFRACTION_OPTIONS = ['正常', '近视', '散光', '弱视', '原始储备低']
const DIAG_AXIAL_OPTIONS = ['正常', '眼轴长', '眼轴短']
const DIAG_CURVATURE_OPTIONS = ['正常', '曲率陡', '曲率平']
const DIAG_AXIAL_RATIO_OPTIONS = ['3.0', '＞3.1', '＞3.3']

Page({
  data: {
    childId: null,
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

    tcmSymptomKeys: TCM_SYMPTOM_KEYS,
    severityOptions: SEVERITY_OPTIONS,
    syndromeOptions: SYNDROME_OPTIONS,
    riskOptions: RISK_OPTIONS,
    treatmentOptions: TREATMENT_OPTIONS,
    diagVisionOptions: DIAG_VISION_OPTIONS,
    diagRefractionOptions: DIAG_REFRACTION_OPTIONS,
    diagAxialOptions: DIAG_AXIAL_OPTIONS,
    diagCurvatureOptions: DIAG_CURVATURE_OPTIONS,
    diagAxialRatioOptions: DIAG_AXIAL_RATIO_OPTIONS,

    sections: {
      basic: true,
      vision: false,
      diagnosis: false,
      tcm: false
    },

    syndromeSelected: {},
    diagRefractionSelected: {},
    treatmentSelected: {},

    risk_index: -1,
    diag_vision_index: -1,
    diag_axial_index: -1,
    diag_curvature_index: -1,
    diag_axial_ratio_index: -1,

    form: {
      name: '',
      gender: '',
      dob: '',
      school: '',
      class_name: '',
      height: '',
      weight: '',
      vision_r: '',
      vision_l: '',
      vision_both: '',
      refraction_r_detail: { s: '', c: '', a: '' },
      refraction_l_detail: { s: '', c: '', a: '' },
      curvature_r: '',
      curvature_l: '',
      axial_length_r: '',
      axial_length_l: '',
      diagnosis_json: {
        vision: '',
        refraction: [],
        axial: '',
        curvature: '',
        axial_ratio: ''
      },
      management_plan: '',
      optometrist_name: '',
      exam_date: '',
      tcm_symptoms_json: {},
      tcm_symptom_other: '',
      tcm_syndrome_types: [],
      tcm_syndrome_other: '',
      risk_level: '',
      treatment_plans: [],
      treatment_other: '',
      doctor_name: ''
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
    this.loadSchoolOptions()
    this.loadCurrentChild()
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

          const syndromeSelected = {}
          ;(Array.isArray(child.tcm_syndrome_types) ? child.tcm_syndrome_types : []).forEach((s) => { if (s) syndromeSelected[s] = true })

          const diagRefractionSelected = {}
          const diagJson = child.diagnosis_json && typeof child.diagnosis_json === 'object' ? child.diagnosis_json : {}
          ;(Array.isArray(diagJson.refraction) ? diagJson.refraction : []).forEach((s) => { if (s) diagRefractionSelected[s] = true })

          const treatmentSelected = {}
          ;(Array.isArray(child.treatment_plans) ? child.treatment_plans : []).forEach((s) => { if (s) treatmentSelected[s] = true })

          this.setData({
            childId: child._id,
            syndromeSelected,
            diagRefractionSelected,
            treatmentSelected,
            form: {
              ...this.data.form,
              name: child.name || '',
              gender: child.gender || '',
              dob: child.dob || '',
              school: child.school || '',
              class_name: child.class_name || '',
              height: child.height != null ? String(child.height) : '',
              weight: child.weight != null ? String(child.weight) : '',
              vision_r: child.vision_r || '',
              vision_l: child.vision_l || '',
              vision_both: child.vision_both || '',
              refraction_r_detail: child.refraction_r_detail && typeof child.refraction_r_detail === 'object'
                ? { s: child.refraction_r_detail.s || '', c: child.refraction_r_detail.c || '', a: child.refraction_r_detail.a || '' }
                : { s: '', c: '', a: '' },
              refraction_l_detail: child.refraction_l_detail && typeof child.refraction_l_detail === 'object'
                ? { s: child.refraction_l_detail.s || '', c: child.refraction_l_detail.c || '', a: child.refraction_l_detail.a || '' }
                : { s: '', c: '', a: '' },
              curvature_r: child.curvature_r || '',
              curvature_l: child.curvature_l || '',
              axial_length_r: child.axial_length_r || '',
              axial_length_l: child.axial_length_l || '',
              diagnosis_json: {
                vision: diagJson.vision || '',
                refraction: Array.isArray(diagJson.refraction) ? diagJson.refraction : [],
                axial: diagJson.axial || '',
                curvature: diagJson.curvature || '',
                axial_ratio: diagJson.axial_ratio || ''
              },
              management_plan: child.management_plan || '',
              optometrist_name: child.optometrist_name || '',
              exam_date: child.exam_date || '',
              tcm_symptoms_json: child.tcm_symptoms_json && typeof child.tcm_symptoms_json === 'object' ? child.tcm_symptoms_json : {},
              tcm_symptom_other: child.tcm_symptom_other || '',
              tcm_syndrome_types: Array.isArray(child.tcm_syndrome_types) ? child.tcm_syndrome_types : [],
              tcm_syndrome_other: child.tcm_syndrome_other || '',
              risk_level: child.risk_level || '',
              treatment_plans: Array.isArray(child.treatment_plans) ? child.treatment_plans : [],
              treatment_other: child.treatment_other || '',
              doctor_name: child.doctor_name || ''
            }
          })
          this.syncSchoolClassFromForm(false)
        }
      }
      this.updatePickerIndexes()
      this.updateAgeAndSubmit()
    } catch (e) {
      console.error(e)
      this.syncSchoolClassFromForm(false)
      this.updatePickerIndexes()
      this.updateAgeAndSubmit()
    }
  },

  onFieldChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ [`form.${field}`]: value })
    this.updateAgeAndSubmit()
  },

  onTextAreaInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ [`form.${field}`]: value })
  },

  onGenderChange(e) {
    this.setData({ 'form.gender': e.detail.value })
    this.updateAgeAndSubmit()
  },

  onDatePickerChange(e) {
    this.setData({ 'form.dob': e.detail.value })
    this.updateAgeAndSubmit()
  },

  onExamDateChange(e) {
    this.setData({ 'form.exam_date': e.detail.value })
  },

  onNestedFieldChange(e) {
    const path = e.currentTarget.dataset.path
    const value = e.detail.value
    if (path) this.setData({ [`form.${path}`]: value })
  },

  onTcmSeverityChange(e) {
    const key = e.currentTarget.dataset.key
    const idx = e.detail.value
    const severity = SEVERITY_OPTIONS[idx] || ''
    this.setData({ [`form.tcm_symptoms_json.${key}`]: severity })
  },

  onTcmSeverityTap(e) {
    const key = e.currentTarget.dataset.key
    const value = e.currentTarget.dataset.value
    if (!key || !value) return
    const current = (this.data.form.tcm_symptoms_json || {})[key]
    this.setData({ [`form.tcm_symptoms_json.${key}`]: current === value ? '' : value })
  },

  toggleSyndrome(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    const selected = { ...(this.data.syndromeSelected || {}) }
    selected[value] = !selected[value]
    const types = Object.keys(selected).filter((k) => selected[k])
    this.setData({ syndromeSelected: selected, 'form.tcm_syndrome_types': types })
  },

  toggleDiagRefraction(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    const selected = { ...(this.data.diagRefractionSelected || {}) }
    selected[value] = !selected[value]
    const items = Object.keys(selected).filter((k) => selected[k])
    this.setData({ diagRefractionSelected: selected, 'form.diagnosis_json.refraction': items })
  },

  toggleTreatment(e) {
    const value = e.currentTarget.dataset.value
    if (!value) return
    const selected = { ...(this.data.treatmentSelected || {}) }
    selected[value] = !selected[value]
    const plans = Object.keys(selected).filter((k) => selected[k])
    this.setData({ treatmentSelected: selected, 'form.treatment_plans': plans })
  },

  onDiagPickerChange(e) {
    const field = e.currentTarget.dataset.field
    const rangeKey = e.currentTarget.dataset.range
    const idx = e.detail.value != null ? Number(e.detail.value) : (e.detail.valueIndex != null ? e.detail.valueIndex : -1)
    const options = this.data[rangeKey] || []
    const value = options[idx] || ''
    this.setData({ [`form.diagnosis_json.${field}`]: value, [`diag_${field}_index`]: idx })
  },

  onRiskChange(e) {
    const idx = e.detail.value != null ? Number(e.detail.value) : (e.detail.valueIndex != null ? e.detail.valueIndex : -1)
    const value = RISK_OPTIONS[idx] || ''
    this.setData({ 'form.risk_level': value, risk_index: idx })
  },

  updatePickerIndexes() {
    const f = this.data.form
    const diagJson = f.diagnosis_json || {}
    const idxOf = (arr, v) => {
      const i = (arr || []).indexOf(v)
      return i >= 0 ? i : -1
    }
    this.setData({
      risk_index: idxOf(RISK_OPTIONS, f.risk_level),
      diag_vision_index: idxOf(DIAG_VISION_OPTIONS, diagJson.vision),
      diag_axial_index: idxOf(DIAG_AXIAL_OPTIONS, diagJson.axial),
      diag_curvature_index: idxOf(DIAG_CURVATURE_OPTIONS, diagJson.curvature),
      diag_axial_ratio_index: idxOf(DIAG_AXIAL_RATIO_OPTIONS, diagJson.axial_ratio)
    })
  },

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

  async onSubmit() {
    const f = this.data.form
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请完善必填信息', icon: 'none' })
      return
    }

    wx.showLoading({ title: '提交中...' })
    try {
      const payload = {
        name: f.name,
        gender: f.gender,
        dob: f.dob,
        age: this.data.age ? Number(this.data.age) : null,
        school: f.school,
        class_name: f.class_name,
        height: f.height === '' ? null : Number(f.height),
        weight: f.weight === '' ? null : Number(f.weight),
        vision_r: f.vision_r,
        vision_l: f.vision_l,
        vision_both: f.vision_both,
        refraction_r_detail: f.refraction_r_detail,
        refraction_l_detail: f.refraction_l_detail,
        curvature_r: f.curvature_r,
        curvature_l: f.curvature_l,
        axial_length_r: f.axial_length_r,
        axial_length_l: f.axial_length_l,
        diagnosis_json: f.diagnosis_json,
        tcm_symptoms_json: f.tcm_symptoms_json,
        tcm_symptom_other: f.tcm_symptom_other,
        tcm_syndrome_types: f.tcm_syndrome_types,
        tcm_syndrome_other: f.tcm_syndrome_other,
        risk_level: f.risk_level,
        treatment_plans: f.treatment_plans,
        treatment_other: f.treatment_other
      }

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
