# API设计

## 说明
当前后端继续使用微信云开发（云函数 + 云数据库）。

为便于“外部自建后台”对接，本项目提供两层接口：
- **C端接口**：小程序直接调用云函数（`wx.cloud.callFunction`）。
- **B端接口**：外部后台通过云函数 `admin_manager` 实现完整 CRUD（列表/详情/新增/编辑/删除/状态）。

外部后台对接方式建议：
- 方式A（推荐）：外部后台服务端使用 CloudBase Server SDK 调用云函数（不需要用户 OPENID）。
- 方式B：给云函数配置 HTTP 触发（如你团队已有网关），外部后台以 HTTP 调用并透传 `action/data`。

---

## 一、C端接口（从实际代码提取）

### 1) user_manager（云函数）
- `register`
  - 入参：`{ phone, password }`
  - 出参：`{ success, msg? }`
- `login_phone`
  - 入参：`{ phone, password }`
  - 出参：`{ success, user?, msg? }`
- `get_user_info`
  - 入参：`{}`
  - 出参：`{ success, user? }`
- `get_profile`
  - 入参：`{}`
  - 出参：`{ success, profile: { user_id, user_no, display_name, avatar_file_id, phone, is_admin } }`
- `update_profile`
  - 入参：`{ data: { display_name?, avatar_file_id?, user_no? } }`
  - 出参：`{ success, msg? }`
- `bootstrap_admin`
  - 入参：`{}`
  - 出参：`{ success, is_admin?, code?, msg? }`
- `set_admin_by_user_no`
  - 入参：`{ data: { user_no } }`
  - 出参：`{ success, msg? }`

### 2) profile_manager（云函数）
- `get`
  - 入参：`{}`
  - 出参：`{ success, list: children[] }`
- `update`
  - 入参：`{ data: child }`（有 `_id` 更新；无 `_id` 新增）
  - 出参：`{ success, msg? }`
- `delete_child`
  - 入参：`{ data: { _id } }`
  - 出参：`{ success, msg? }`
- `get_school_options`
  - 入参：`{}`
  - 出参：`{ success, schools: string[], classes_map: { [school]: string[] } }`

### 3) data_manager（云函数）
- `get_banners`
  - 入参：`{}`
  - 出参：`{ success, list: banners[] }`
- `get_records`
  - 入参：`{ data: { child_id } }`
  - 出参：`{ success, list: checkup_records[] }`
- `get_record`
  - 入参：`{ data: { record_id } }`
  - 出参：`{ success, record?, msg? }`
- `create_record`
  - 入参：`{ data: { record } }`
  - 出参：`{ success, record_id?, code?, msg? }`
- `update_record`
  - 入参：`{ data: { record_id, patch } }`
  - 出参：`{ success, code?, msg? }`

### 4) appointment_manager（云函数）
- `get_items`
  - 入参：`{}`
  - 出参：`{ success, list: appointment_items[] }`
- `get_schedules`
  - 入参：`{ data: { item_id } }`
  - 出参：`{ success, list: appointment_schedules[] }`
- `book`
  - 入参：`{ data: { schedule_id, child_id, child_name, item_name, date, time_slot, phone, class_name } }`
  - 出参：`{ success, msg? }`
- `get_my_records`
  - 入参：`{}`
  - 出参：`{ success, list: appointment_records[] }`
- `list_by_child`
  - 入参：`{ data: { child_id } }`
  - 出参：`{ success, list: appointment_records[] }`

---

## 二、B端接口（根据规划生成完整CRUD）

### 统一约定
- 所有 B 端接口都通过云函数：`admin_manager`
- 入参统一：`{ action, data }`
- 认证：除 `admin_login` 外，所有接口都必须传 `data.token`

#### 认证
- `admin_login`
  - 入参：`{ phone, password }`
  - 出参：`{ success, token, expires_in, admin: { user_id, phone, display_name, user_no } }`
- `admin_logout`
  - 入参：`{ token }`
  - 出参：`{ success }`

- `admin_me`
  - 入参：`{ token }`
  - 出参：`{ success, admin: { user_id, phone, display_name, user_no, is_admin } }`

---

### 1) 用户管理（users）
- `users_list`（列表）
  - 入参：`{ token, q?, page?, page_size? }`
  - 出参：`{ success, list, page, page_size, total }`
- `users_detail`（详情）
  - 入参：`{ token, user_id }`
  - 出参：`{ success, user }`
- `users_create`（新增）
  - 入参：`{ token, phone, password, display_name?, is_admin?, active? }`
  - 出参：`{ success, user_id }`
- `users_update`（编辑）
  - 入参：`{ token, user_id, patch: { phone?, display_name?, avatar_file_id? } }`
  - 出参：`{ success }`
- `users_delete`（删除，软删除）
  - 入参：`{ token, user_id }`
  - 出参：`{ success }`
- `users_toggle`（状态）
  - 入参：`{ token, user_id, active }`
  - 出参：`{ success }`
- `users_set_admin`（状态/权限）
  - 入参：`{ token, user_id, is_admin }`
  - 出参：`{ success }`



---

### 2) 学校/班级字典（school_classes）
- `school_classes_list`（列表）
  - 入参：`{ token, q?, active?, page?, page_size? }`
  - 出参：`{ success, list, page, page_size, total }`
- `school_classes_detail`（详情）
  - 入参：`{ token, _id }`
  - 出参：`{ success, row }`
- `school_classes_create`（新增）
  - 入参：`{ token, school, class_name, active? }`
  - 出参：`{ success, _id }`
- `school_classes_update`（编辑）
  - 入参：`{ token, _id, patch: { school?, class_name?, active? } }`
  - 出参：`{ success }`
- `school_classes_delete`（删除）
  - 入参：`{ token, _id }`
  - 出参：`{ success }`
- `school_classes_toggle`（状态）
  - 入参：`{ token, _id, active }`
  - 出参：`{ success }`

---

### 3) 首页轮播（banners）
- `banners_list`
- `banners_detail`
- `banners_create`
- `banners_update`
- `banners_delete`
- `banners_toggle`

---

### 4) 预约项目（appointment_items）
- `appointment_items_list`
- `appointment_items_detail`
- `appointment_items_create`
- `appointment_items_update`
- `appointment_items_delete`
- `appointment_items_toggle`

---

### 5) 预约排班（appointment_schedules）
- `appointment_schedules_list`
- `appointment_schedules_detail`
- `appointment_schedules_create`
- `appointment_schedules_update`
- `appointment_schedules_delete`
- `appointment_schedules_toggle`

---

### 6) 预约记录（appointment_records）
- `appointment_records_list`
- `appointment_records_detail`
- `appointment_records_create`
- `appointment_records_update`
- `appointment_records_delete`
- `appointment_records_set_status`

---

### 7) 孩子档案（children）
- `children_list`
- `children_detail`
- `children_create`
- `children_update`
- `children_delete`

- `children_toggle`（状态）
  - 入参：`{ token, child_id, active }`
  - 出参：`{ success }`

（补充：新增孩子建议仍由 C 端完成；后台新增如需开放可补 `children_create`。）

---

### 8) 检测记录（checkup_records）
- `checkup_records_list`
- `checkup_records_detail`
- `checkup_records_create`
- `checkup_records_update`
- `checkup_records_delete`

- `checkup_records_toggle`（状态）
  - 入参：`{ token, record_id, active }`
  - 出参：`{ success }`

---

## 三、数据模型（字段对齐）

### users
- `_id` string
- `_openid` string（绑定小程序用户）
- `phone` string
- `password` string
- `display_name` string
- `avatar_file_id` string
- `user_no` string（8位数字）
- `is_admin` boolean
- `active` boolean（默认 true；false 表示禁用登录）
- `deleted` boolean（软删除标记）
- `created_at` date
- `updated_at` date

### children
- `_id` string
- `_openid` string
- `parent_phone` string
- `name` string
- `gender` string
- `dob` string（YYYY-MM-DD）
- `school` string（必须来自 `school_classes`）
- `class_name` string（必须来自 `school_classes`）
- `height` number
- `weight` number
- `symptoms` string[]
- `symptom_other` string
- `additional_note` string
- `tongue_shape/tongue_color/tongue_coating/face_color/lip_color/hair` string
- `vision_status` string
- `refraction_l/refraction_r` string
- `avatar_file_id` string
- `child_no` string（8位数字）
- `active` boolean
- `created_at` date
- `updated_at` date

### school_classes
- `_id` string
- `school` string
- `class_name` string
- `active` boolean
- `created_at` date
- `updated_at` date

### banners
- `_id` string
- `image_url` string
- `order` number
- `active` boolean
- `created_at` date
- `updated_at` date

### appointment_items
- `_id` string
- `name` string
- `active` boolean
- `created_at` date
- `updated_at` date

### appointment_schedules
- `_id` string
- `item_id` string
- `date` string（YYYY-MM-DD）
- `time_slot` string
- `max_count` number
- `booked_count` number
- `active` boolean（B端使用）
- `created_at` date
- `updated_at` date

### appointment_records
- `_id` string
- `_openid` string
- `child_id` string
- `child_name` string
- `class_name` string
- `schedule_id` string
- `item_name` string
- `date` string
- `time_slot` string
- `phone` string
- `status` string
- `created_at` date
- `updated_at` date

### checkup_records
- `_id` string
- `child_id` string
- `date` string
- `height` number
- `weight` number
- `vision_l` string
- `vision_r` string
- `refraction_l` object `{ s, c, a }`
- `refraction_r` object `{ s, c, a }`
- `diagnosis` object `{ vision_status, refraction_status, axis_status, cornea_status }`
- `conclusion` string
- `active` boolean
- `created_at` date
- `updated_at` date

### admin_sessions
- `_id` string
- `token` string
- `user_id` string
- `expire_at_ms` number
- `created_at` date
