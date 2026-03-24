import { adminLogin, adminMe } from '@/api/vision-admin'

/**
 * 登录（对接云函数 admin_manager.admin_login）
 * @param params 登录参数，phone 或 userName 均可（均作为手机号）
 * @returns 登录响应
 */
export async function fetchLogin(
  params: Api.Auth.LoginParams
): Promise<Api.Auth.LoginResponse> {
  const phone = params.phone ?? params.userName
  if (!phone || !params.password) {
    return Promise.reject(new Error('请填写手机号和密码'))
  }
  const res = await adminLogin({ phone, password: params.password })
  return {
    token: res.token,
    refreshToken: undefined
  }
}

/**
 * 获取当前管理员信息（对接云函数 admin_manager.admin_me）
 * @returns 用户信息（映射为模板 UserInfo 格式）
 */
export async function fetchGetUserInfo(): Promise<Api.Auth.UserInfo> {
  const res = await adminMe()
  const admin = res.admin
  if (!admin) {
    return Promise.reject(new Error('未获取到管理员信息'))
  }
  return {
    userId: admin.user_id || '',
    userName: admin.display_name || admin.phone || admin.user_id || '',
    email: '',
    avatar: undefined,
    roles: admin.is_admin ? ['R_SUPER'] : [],
    buttons: []
  }
}
