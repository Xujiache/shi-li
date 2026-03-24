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
    {
      path: 'users',
      name: 'VisionAdminUsers',
      component: '/vision-admin/users/index',
      meta: {
        title: '用户管理',
        icon: 'ri:user-line',
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
    },
    {
      path: 'banners',
      name: 'VisionAdminBanners',
      component: '/vision-admin/banners/index',
      meta: {
        title: '首页轮播管理',
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
        icon: 'ri:shield-user-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
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
    },
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
}
