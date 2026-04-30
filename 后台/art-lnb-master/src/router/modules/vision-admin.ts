import { AppRouteRecord } from '@/types/router'

/** 儿童视力管理后台 - 与 C 端功能对应的菜单与路由 */
export const visionAdminRoutes: AppRouteRecord = {
  path: '/vision-admin',
  name: 'VisionAdmin',
  component: '/index/index',
  meta: {
    title: '儿童视力管理',
    icon: 'ri:eye-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    // ===== 1. 用户与权限 =====
    {
      path: 'access',
      name: 'VisionAdminAccess',
      component: '',
      meta: {
        title: '用户与权限',
        icon: 'ri:shield-user-line',
        roles: ['R_SUPER', 'R_ADMIN']
      },
      children: [
        {
          path: 'admins',
          name: 'VisionAdminAdmins',
          component: '/vision-admin/admins/index',
          meta: {
            title: '管理员管理',
            icon: 'ri:admin-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'employees',
          name: 'VisionAdminEmployees',
          component: '/vision-admin/employees/index',
          meta: {
            title: '员工管理',
            icon: 'ri:user-star-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'departments',
          name: 'VisionAdminDepartments',
          component: '/vision-admin/departments/index',
          meta: {
            title: '部门管理',
            icon: 'ri:building-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'users',
          name: 'VisionAdminUsers',
          component: '/vision-admin/users/index',
          meta: {
            title: '家长用户',
            icon: 'ri:user-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'operation-logs',
          name: 'VisionAdminOperationLogs',
          component: '/vision-admin/operation-logs/index',
          meta: {
            title: '操作日志',
            icon: 'ri:file-text-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        }
      ]
    },

    // ===== 2. 孩子档案 =====
    {
      path: 'profile',
      name: 'VisionAdminProfile',
      component: '',
      meta: {
        title: '孩子档案',
        icon: 'ri:user-smile-line',
        roles: ['R_SUPER', 'R_ADMIN']
      },
      children: [
        {
          path: 'children',
          name: 'VisionAdminChildren',
          component: '/vision-admin/children/index',
          meta: {
            title: '孩子档案',
            icon: 'ri:user-smile-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'checkup-records',
          name: 'VisionAdminCheckupRecords',
          component: '/vision-admin/checkup-records/index',
          meta: {
            title: '检测记录',
            icon: 'ri:heart-pulse-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'profile-fields',
          name: 'VisionAdminProfileFields',
          component: '/vision-admin/profile-fields/index',
          meta: {
            title: '档案字段配置',
            icon: 'ri:settings-3-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'dept-grants',
          name: 'VisionAdminDeptGrants',
          component: '/vision-admin/dept-grants/index',
          meta: {
            title: '部门字段授权',
            icon: 'ri:shield-check-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        }
      ]
    },

    // ===== 3. 客户跟进（CRM） =====
    {
      path: 'crm',
      name: 'VisionAdminCRM',
      component: '',
      meta: {
        title: '客户跟进',
        icon: 'ri:contacts-book-line',
        roles: ['R_SUPER', 'R_ADMIN']
      },
      children: [
        {
          path: 'customers',
          name: 'VisionAdminCustomers',
          component: '/vision-admin/customers/index',
          meta: {
            title: '员工客户管理',
            icon: 'ri:contacts-book-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'all-follow-ups',
          name: 'VisionAdminAllFollowUps',
          component: '/vision-admin/all-follow-ups/index',
          meta: {
            title: '全局跟进日志',
            icon: 'ri:chat-history-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        }
      ]
    },

    // ===== 4. 预约管理 =====
    {
      path: 'appointment',
      name: 'VisionAdminAppointment',
      component: '',
      meta: {
        title: '预约管理',
        icon: 'ri:calendar-event-line',
        roles: ['R_SUPER', 'R_ADMIN']
      },
      children: [
        {
          path: 'appointment-items',
          name: 'VisionAdminAppointmentItems',
          component: '/vision-admin/appointment-items/index',
          meta: {
            title: '预约项目',
            icon: 'ri:calendar-check-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'appointment-schedules',
          name: 'VisionAdminAppointmentSchedules',
          component: '/vision-admin/appointment-schedules/index',
          meta: {
            title: '预约排班',
            icon: 'ri:calendar-event-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'appointment-records',
          name: 'VisionAdminAppointmentRecords',
          component: '/vision-admin/appointment-records/index',
          meta: {
            title: '预约记录',
            icon: 'ri:file-list-3-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        }
      ]
    },

    // ===== 5. 问卷管理 =====
    {
      path: 'survey',
      name: 'VisionAdminSurvey',
      component: '',
      meta: {
        title: '问卷管理',
        icon: 'ri:file-edit-line',
        roles: ['R_SUPER', 'R_ADMIN']
      },
      children: [
        {
          path: 'questionnaires',
          name: 'VisionAdminQuestionnaires',
          component: '/vision-admin/questionnaires/index',
          meta: {
            title: '问卷配置',
            icon: 'ri:file-edit-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'questionnaire-responses',
          name: 'VisionAdminQuestionnaireResponses',
          component: '/vision-admin/questionnaire-responses/index',
          meta: {
            title: '问卷填写数据',
            icon: 'ri:file-list-2-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        }
      ]
    },

    // ===== 6. AI 智能 =====
    {
      path: 'ai',
      name: 'VisionAdminAi',
      component: '',
      meta: {
        title: 'AI 智能',
        icon: 'ri:sparkling-line',
        roles: ['R_SUPER', 'R_ADMIN']
      },
      children: [
        {
          path: 'ai-chat',
          name: 'VisionAdminAiChat',
          component: '/vision-admin/ai-chat/index',
          meta: {
            title: 'AI 助手对话',
            icon: 'ri:chat-smile-3-line',
            keepAlive: false,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'ai-analysis-config',
          name: 'VisionAdminAiAnalysisConfig',
          component: '/vision-admin/ai-analysis-config/index',
          meta: {
            title: 'AI 分析配置',
            icon: 'ri:settings-5-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'ai-correction-feedback',
          name: 'VisionAdminAiCorrectionFeedback',
          component: '/vision-admin/ai-correction-feedback/index',
          meta: {
            title: 'AI 修订反馈',
            icon: 'ri:message-2-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        }
      ]
    },

    // ===== 7. 内容运营 =====
    {
      path: 'content',
      name: 'VisionAdminContent',
      component: '',
      meta: {
        title: '内容运营',
        icon: 'ri:image-line',
        roles: ['R_SUPER', 'R_ADMIN']
      },
      children: [
        {
          path: 'banners',
          name: 'VisionAdminBanners',
          component: '/vision-admin/banners/index',
          meta: {
            title: '首页轮播',
            icon: 'ri:image-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'terms-and-privacy',
          name: 'VisionAdminTermsAndPrivacy',
          component: '/vision-admin/terms-and-privacy/index',
          meta: {
            title: '协议与隐私',
            icon: 'ri:file-shield-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        },
        {
          path: 'school-classes',
          name: 'VisionAdminSchoolClasses',
          component: '/vision-admin/school-classes/index',
          meta: {
            title: '学校/班级字典',
            icon: 'ri:school-line',
            keepAlive: true,
            roles: ['R_SUPER', 'R_ADMIN']
          }
        }
      ]
    }
  ]
}
