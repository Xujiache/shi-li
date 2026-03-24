Component({
  properties: {
    label: { type: String, value: '' },
    required: { type: Boolean, value: false },
    meta: { type: String, value: '' },
    range: { type: Array, value: [] },
    rangeKey: { type: String, value: '' },
    valueIndex: { type: Number, value: -1 },
    value: { type: String, value: '' },
    displayText: { type: String, value: '' },
    placeholder: { type: String, value: '请选择' },
    disabled: { type: Boolean, value: false },
    helper: { type: String, value: '' },
    errorText: { type: String, value: '' },
    error: { type: Boolean, value: false },
    mode: { type: String, value: 'selector' }
  },

  data: {
    focused: false
  },

  methods: {
    onTap() {
      if (this.data.disabled) return
      this.setData({ focused: true })
      setTimeout(() => this.setData({ focused: false }), 220)
    },
    onChange(e) {
      if (this.data.mode === 'date') {
        this.triggerEvent('change', { value: e.detail.value })
        return
      }
      this.triggerEvent('change', { valueIndex: Number(e.detail.value) })
    }
  }
})
