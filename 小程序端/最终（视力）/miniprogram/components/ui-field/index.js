Component({
  properties: {
    label: { type: String, value: '' },
    required: { type: Boolean, value: false },
    meta: { type: String, value: '' },
    value: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    type: { type: String, value: 'text' },
    password: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    maxlength: { type: Number, value: 140 },
    helper: { type: String, value: '' },
    errorText: { type: String, value: '' },
    error: { type: Boolean, value: false },
    placeholderStyle: {
      type: String,
      value: 'color: rgba(0,0,0,0.35); font-size: 28rpx;'
    }
  },

  data: {
    focused: false
  },

  methods: {
    onFocus() {
      this.setData({ focused: true })
      this.triggerEvent('focus')
    },
    onBlur() {
      this.setData({ focused: false })
      this.triggerEvent('blur')
    },
    onInput(e) {
      const value = e.detail.value
      this.triggerEvent('change', { value })
    }
  }
})

