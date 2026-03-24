# DESIGN_vision_app: 系统架构与设计

## 1. 系统架构设计

### 1.1 总体架构
采用 **微信小程序 + 云开发** 架构。
- **Frontend**: 微信小程序原生页面 (WXML/WXSS/JS).
- **Backend**: 微信云函数 (Node.js).
- **Database**: 微信云数据库 (NoSQL).
- **Storage**: 微信云存储 (轮播图等图片资源).

### 1.2 目录结构规划
```
miniprogram/
  pages/
    auth/
      login/          # 登录/注册页
    profile/
      edit/           # 个人档案填写/编辑页
    home/
      index/          # 首页 (轮播图, 预约, 看板入口)
    history/
      list/           # 历史数据列表与趋势页
  components/         # 公共组件
  utils/              # 工具函数 (日期格式化, 校验等)
  app.js              # 全局逻辑 (云初始化, 路由守卫)
  app.wxss            # 全局样式 (基于 UI 配色规范)

cloudfunctions/
  login/              # 基础登录 (获取 OpenID)
  user_manager/       # 用户管理 (手机号注册/登录)
  profile_manager/    # 档案管理 (增删改查)
  appointment_manager/# 预约管理 (获取项目, 排班, 预约)
  data_manager/       # 数据查询 (轮播图, 检测记录)
```

## 2. 数据库设计 (Schema)

### 2.1 `users` (用户集合)
- `_id`: string
- `_openid`: string (微信OpenID, 索引)
- `phone`: string (手机号)
- `password`: string (简单加密或哈希)
- `created_at`: timestamp

### 2.2 `children` (孩子档案集合)
- `_id`: string
- `_openid`: string (关联家长)
- `name`: string
- `gender`: string (男/女)
- `dob`: string (YYYY-MM-DD)
- `school`: string
- `class_name`: string (班级)
- `height`: number
- `weight`: number
- `symptoms`: array<string> (症状标签)
- `vision_l`: string (左眼裸眼)
- `vision_r`: string (右眼裸眼)
- `refraction_l`: object { s, c, a }
- `refraction_r`: object { s, c, a }
- `other_info`: string
- `created_at`: timestamp
- `updated_at`: timestamp

### 2.3 `checkup_records` (检测记录集合)
- `_id`: string
- `child_id`: string (关联 children._id)
- `date`: string (YYYY-MM-DD)
- `height`: number
- `weight`: number
- `vision_l`: string
- `vision_r`: string
- `refraction_l`: object { s, c, a }
- `refraction_r`: object { s, c, a }
- `diagnosis`: object { vision_status, refraction_status, axis_status, cornea_status }
- `conclusion`: string (结论/建议)
- `created_at`: timestamp

### 2.4 `appointment_items` (预约项目)
- `_id`: string
- `name`: string (如 "视力复查")
- `active`: boolean

### 2.5 `appointment_schedules` (排班)
- `_id`: string
- `item_id`: string
- `date`: string (YYYY-MM-DD)
- `time_slot`: string (e.g. "09:00-10:00")
- `max_count`: number
- `booked_count`: number

### 2.6 `appointment_records` (预约记录)
- `_id`: string
- `_openid`: string
- `child_id`: string
- `child_name`: string
- `class_name`: string
- `schedule_id`: string
- `item_name`: string
- `date`: string
- `time_slot`: string
- `phone`: string
- `status`: string (pending/confirmed/cancelled)
- `created_at`: timestamp

### 2.7 `banners` (轮播图)
- `_id`: string
- `image_url`: string
- `order`: number
- `active`: boolean

## 3. 接口契约 (Cloud Functions)

### 3.1 `user_manager`
- `action: 'register'`: { phone, password } -> { success, msg }
- `action: 'login_phone'`: { phone, password } -> { success, token/user }

### 3.2 `profile_manager`
- `action: 'get'`: {} -> { profile }
- `action: 'update'`: { ...profile_data } -> { success }

### 3.3 `appointment_manager`
- `action: 'get_items'`: {} -> { list }
- `action: 'get_schedules'`: { item_id } -> { list }
- `action: 'book'`: { schedule_id, child_id, phone } -> { success }

### 3.4 `data_manager`
- `action: 'get_banners'`: {} -> { list }
- `action: 'get_records'`: { child_id } -> { list }

## 4. 样式变量 (UI Theme)
在 `app.wxss` 中定义 CSS Variables:
```css
page {
  --primary-100: #0077C2;
  --primary-200: #59a5f5;
  --primary-300: #c8ffff;
  --accent-100: #00BFFF;
  --accent-200: #00619a;
  --text-100: #333333;
  --text-200: #5c5c5c;
  --bg-100: #FFFFFF;
  --bg-200: #f5f5f5;
  --bg-300: #cccccc;
}
```
