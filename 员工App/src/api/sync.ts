/**
 * Sync 批量提交 API。
 *
 * 后端：POST /sync/batch（已就绪，见 syncService.processBatch）
 * 请求 envelope：
 *   { ops: [{ op, type, client_uuid, base_version?, server_id?, payload }] }
 * 响应：
 *   { results: [{ client_uuid, type, status, server_id?, current_payload?, current_version?, errors? }] }
 *
 * 批量上限：50 条（前端切片，多余的留到下一轮 kick）。
 */
import { http } from './http'

export const SYNC_BATCH_MAX = 50

export interface SyncOp {
  op: 'create' | 'update' | 'delete'
  type: 'customer' | 'follow_up' | 'customer_transfer' | 'attachment_upload' | string
  client_uuid: string
  base_version?: string
  server_id?: number | null
  payload?: any
}

export interface SyncResult {
  client_uuid: string
  type: string
  status: 'ok' | 'duplicate' | 'conflict' | 'validation_failed' | 'forbidden' | 'not_found' | 'error'
  server_id?: number
  current_payload?: any
  current_version?: string
  errors?: string[]
}

/**
 * 提交一批 op。前端单批不超过 50 条；调用方自行切片。
 */
export async function submitBatch(ops: SyncOp[]): Promise<{ results: SyncResult[] }> {
  if (!ops || ops.length === 0) return { results: [] }
  if (ops.length > SYNC_BATCH_MAX) {
    throw new Error(`[sync] 单批最多 ${SYNC_BATCH_MAX} 条`)
  }
  const r: any = await http.post<any>('/sync/batch', { ops }, { hideError: true, timeout: 30000 })
  return { results: Array.isArray(r?.results) ? r.results : [] }
}
