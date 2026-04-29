/**
 * 附件懒上传：UI 选完图后立即返回 client_uuid（不阻塞），
 * 实际上传由 sync 引擎在 attachment_upload op 中执行。
 *
 * 流程（两阶段）：
 *   1) UI 选图 → uploadImageDeferred() 写 local_attachment + push pending_op
 *      返回 attachment 的 client_uuid（业务表单 attachments 数组中占位）
 *   2) sync 引擎处理 attachment_upload op：调 uploadImage() → 拿 server_id
 *      → 写 local_attachment.setUploaded
 *   3) 业务 op（customer.create / follow_up.create）的 payload 中
 *      attachments 列表是 client_uuid 数组；sync 提交前替换为 server_id
 *
 * 注意：
 *   - client_uuid 一次性生成，不要每次重新生成
 *   - 离线选图照样能入队，等网络恢复自动上传
 */
import { v4 as uuidv4 } from '@/utils/uuid'
import { repo, type Actor } from '@/db'

export interface DeferredUploadInput {
  localPath: string
  refClientUuid: string // 关联的业务实体 client_uuid（如 customer.client_uuid）
  refType: 'customer' | 'follow_up' | string
}

/**
 * 同步函数（内部异步入库，但返回值不等待）。
 * 返回 attachment 的 client_uuid，业务 payload 中作为附件占位 ID。
 */
export function uploadImageDeferred(actor: Actor, input: DeferredUploadInput): string {
  const client_uuid = uuidv4()
  // 异步写入；不阻塞 UI
  ;(async () => {
    try {
      await repo.attachments.add(actor, {
        client_uuid,
        local_path: input.localPath,
        ref_type: input.refType,
        ref_client_uuid: input.refClientUuid,
        status: 'pending'
      })
      await repo.pendingOp.add(actor, {
        owner_employee_id: actor.employee_id,
        client_uuid,
        type: 'attachment_upload',
        op: 'create',
        payload: {
          local_path: input.localPath,
          ref_type: input.refType,
          ref_client_uuid: input.refClientUuid
        }
      })
    } catch (e) {
      console.warn('[uploadDeferred] enqueue failed', e)
    }
  })()
  return client_uuid
}
