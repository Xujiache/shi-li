import api from '@/utils/http'

const tempUrlCache = new Map<string, string>()

export function isCloudFileId(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('cloud://')
}

/**
 * 上传图片到 Node 后端本地存储，返回可直接访问的 URL。
 */
export async function uploadCloudImage(
  file: File,
  options: { prefix?: string } = {}
): Promise<string> {
  if (!(file instanceof File)) throw new Error('上传失败：文件无效')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('prefix', (options.prefix || 'vision-admin').replace(/^\/+|\/+$/g, ''))

  const res = await api.request<{ url?: string; file_url?: string }>({
    url: '/api/v1/common/upload/image',
    method: 'POST',
    data: formData,
    showErrorMessage: false
  })

  const url = res?.url || res?.file_url
  if (!url) throw new Error('上传失败：未返回图片地址')
  tempUrlCache.set(url, url)
  return url
}

/**
 * 兼容旧调用：若仍传入 cloud://，直接原样返回空映射；普通 URL 则返回自身映射。
 */
export async function getTempFileURLs(fileIDs: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  ;(fileIDs || []).forEach((id) => {
    if (typeof id !== 'string') return
    if (!isCloudFileId(id)) out[id] = id
    const cached = tempUrlCache.get(id)
    if (cached) out[id] = cached
  })
  return out
}

/**
 * 将图片标识统一转成可预览 URL。
 */
export async function resolveCloudImageUrl(urlOrFileId: unknown): Promise<string> {
  if (!urlOrFileId) return ''
  const v = String(urlOrFileId)
  if (!isCloudFileId(v)) return v
  const map = await getTempFileURLs([v])
  return map[v] || ''
}

