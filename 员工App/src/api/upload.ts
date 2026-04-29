/**
 * 文件上传封装。
 * 后端字段名为 file（注意不是 image），路径 /api/v1/employee/uploads/image。
 */
import { useAuthStore } from '@/stores/auth'

// #ifdef H5
const UPLOAD_BASE = '/api/v1/employee'
// #endif
// #ifdef APP-PLUS
const UPLOAD_BASE = 'https://api.gmxd.asia/api/v1/employee'
// #endif
// #ifdef MP-WEIXIN
const UPLOAD_BASE = 'https://api.gmxd.asia/api/v1/employee'
// #endif

export interface UploadResult {
  id: number       // uploads 表主键，用作 upload_id 关联到附件 / 跟进
  url: string
  file_url?: string
  relative_path?: string
  name?: string
  size?: number
  type?: string
  [k: string]: any
}

/**
 * 上传一张图片，返回服务端响应 data 字段。
 * @param filePath 本地文件路径（uni.chooseImage 拿到的 tempFilePath）
 */
/**
 * H5 端原生 fetch 上传（接受 File / Blob 对象）。
 * 用于绕开 uni.chooseImage / uni.uploadFile 的内部异步，避免浏览器
 * "文件选择器对话框只能在由用户激活时显示" 的限制 — 配合原生 <input type=file>。
 */
export function uploadFileBlob(file: Blob, filename = 'upload.jpg'): Promise<UploadResult> {
  const auth = useAuthStore()
  const fd = new FormData()
  fd.append('file', file, filename)
  const headers: Record<string, string> = {}
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  return fetch(UPLOAD_BASE + '/uploads/image', {
    method: 'POST',
    headers,
    body: fd
  }).then(async (resp) => {
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }
    const body = await resp.json().catch(() => null)
    if (!body || body.code < 200 || body.code >= 300) {
      throw new Error((body && body.message) || '上传失败')
    }
    return body.data as UploadResult
  })
}

export function uploadImage(filePath: string): Promise<UploadResult> {
  const auth = useAuthStore()
  const header: Record<string, string> = {}
  if (auth.token) header.Authorization = `Bearer ${auth.token}`
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: UPLOAD_BASE + '/uploads/image',
      filePath,
      name: 'file',
      header,
      success: (res) => {
        try {
          const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          if (!body || typeof body !== 'object') {
            return reject(new Error('上传响应格式异常'))
          }
          if (body.code >= 200 && body.code < 300) {
            return resolve(body.data as UploadResult)
          }
          uni.showToast({ title: body.message || '上传失败', icon: 'none' })
          const err: any = new Error(body.message || '上传失败')
          err.code = body.code
          reject(err)
        } catch (e) {
          reject(e)
        }
      },
      fail: (err) => {
        uni.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      }
    })
  })
}
