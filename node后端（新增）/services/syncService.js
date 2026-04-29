const { StatusCodes } = require('http-status-codes')
const { createAppError } = require('../utils/appError')
const config = require('../config')
const customerService = require('./customerService')
const followUpService = require('./followUpService')
const transferService = require('./transferService')

/**
 * 校验 actor。
 */
function assertActor(actor) {
  if (!actor || !actor.id) {
    throw createAppError('当前会话异常，请重新登录', StatusCodes.UNAUTHORIZED)
  }
}

/**
 * 把抛出的 createAppError 转为 status='conflict' / 'validation_failed' / 'error'。
 * @param {Error} err
 * @returns {{status:string, errors:string[]}}
 */
function classifyError(err) {
  const status = err && err.statusCode
  if (status === 409 || status === StatusCodes.CONFLICT) {
    return { status: 'conflict', errors: [err.message || '数据冲突'] }
  }
  if (status === 422 || status === StatusCodes.UNPROCESSABLE_ENTITY) {
    return { status: 'validation_failed', errors: [err.message || '校验失败'] }
  }
  if (status === 400 || status === StatusCodes.BAD_REQUEST) {
    return { status: 'validation_failed', errors: [err.message || '参数错误'] }
  }
  if (status === 403 || status === StatusCodes.FORBIDDEN) {
    return { status: 'forbidden', errors: [err.message || '无权限'] }
  }
  if (status === 404 || status === StatusCodes.NOT_FOUND) {
    return { status: 'not_found', errors: [err.message || '记录不存在'] }
  }
  return { status: 'error', errors: [err && err.message ? err.message : '服务器内部错误'] }
}

/**
 * 处理客户类 op。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {{op:string, type:string, client_uuid?:string, base_version?:string, payload?:Record<string,any>, server_id?:number}} op
 */
async function processCustomerOp(actor, op) {
  const action = String(op.op || '').toLowerCase()
  const payload = op.payload || {}

  if (action === 'create') {
    const { customer, status, server_id } = await customerService.createCustomer(actor, {
      ...payload,
      client_uuid: op.client_uuid
    })
    return {
      client_uuid: op.client_uuid,
      type: 'customer',
      status,
      server_id: server_id || (customer && customer.id) || null
    }
  }

  if (action === 'update') {
    const targetId = op.server_id || payload.id
    if (!targetId) {
      throw createAppError('update 缺少 server_id', StatusCodes.BAD_REQUEST)
    }
    const result = await customerService.updateCustomer(actor, targetId, {
      ...payload,
      base_version: op.base_version
    })
    if (result.status === 'conflict') {
      return {
        client_uuid: op.client_uuid,
        type: 'customer',
        status: 'conflict',
        server_id: Number(targetId),
        current_payload: result.current_payload,
        current_version: result.current_version
      }
    }
    return {
      client_uuid: op.client_uuid,
      type: 'customer',
      status: 'ok',
      server_id: Number(targetId)
    }
  }

  if (action === 'delete') {
    const targetId = op.server_id || payload.id
    if (!targetId) {
      throw createAppError('delete 缺少 server_id', StatusCodes.BAD_REQUEST)
    }
    await customerService.softDeleteCustomer(actor, targetId)
    return {
      client_uuid: op.client_uuid,
      type: 'customer',
      status: 'ok',
      server_id: Number(targetId)
    }
  }

  throw createAppError(`不支持的 customer op: ${action}`, StatusCodes.BAD_REQUEST)
}

/**
 * 处理跟进类 op。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {{op:string, type:string, client_uuid?:string, payload?:Record<string,any>, server_id?:number}} op
 */
async function processFollowUpOp(actor, op) {
  const action = String(op.op || '').toLowerCase()
  const payload = op.payload || {}

  if (action === 'create') {
    const { follow_up: fu, status, server_id } = await followUpService.createFollowUp(actor, {
      ...payload,
      client_uuid: op.client_uuid
    })
    return {
      client_uuid: op.client_uuid,
      type: 'follow_up',
      status,
      server_id: server_id || (fu && fu.id) || null
    }
  }

  if (action === 'update') {
    const targetId = op.server_id || payload.id
    if (!targetId) {
      throw createAppError('update 缺少 server_id', StatusCodes.BAD_REQUEST)
    }
    await followUpService.updateFollowUp(actor, targetId, payload)
    return {
      client_uuid: op.client_uuid,
      type: 'follow_up',
      status: 'ok',
      server_id: Number(targetId)
    }
  }

  if (action === 'delete') {
    const targetId = op.server_id || payload.id
    if (!targetId) {
      throw createAppError('delete 缺少 server_id', StatusCodes.BAD_REQUEST)
    }
    await followUpService.deleteFollowUp(actor, targetId)
    return {
      client_uuid: op.client_uuid,
      type: 'follow_up',
      status: 'ok',
      server_id: Number(targetId)
    }
  }

  throw createAppError(`不支持的 follow_up op: ${action}`, StatusCodes.BAD_REQUEST)
}

/**
 * 处理转出类 op（仅支持 create）。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {{op:string, type:string, client_uuid?:string, payload?:Record<string,any>}} op
 */
async function processTransferOp(actor, op) {
  const action = String(op.op || '').toLowerCase()
  if (action !== 'create') {
    throw createAppError(`不支持的 transfer op: ${action}`, StatusCodes.BAD_REQUEST)
  }
  const { transfer, status, server_id } = await transferService.submitTransfer(actor, {
    ...(op.payload || {}),
    client_uuid: op.client_uuid
  })
  return {
    client_uuid: op.client_uuid,
    type: 'customer_transfer',
    status,
    server_id: server_id || (transfer && transfer.id) || null
  }
}

/**
 * 处理批量同步：每个 op 独立 try/catch。
 * @param {{id:number, role:string, department_id?:number}} actor
 * @param {Array<Record<string,any>>} ops
 * @returns {Promise<{results:Array<Record<string,any>>}>}
 */
async function processBatch(actor, ops) {
  assertActor(actor)
  const list = Array.isArray(ops) ? ops : []
  const limit = Number(config.employee.syncBatchMax) || 200
  if (list.length > limit) {
    throw createAppError(`单次同步最多 ${limit} 条`, StatusCodes.BAD_REQUEST)
  }

  const results = []
  for (const op of list) {
    const t = String(op && op.type || '').toLowerCase()
    try {
      let result
      if (t === 'customer') {
        result = await processCustomerOp(actor, op)
      } else if (t === 'follow_up' || t === 'followup') {
        result = await processFollowUpOp(actor, op)
      } else if (t === 'customer_transfer' || t === 'transfer') {
        result = await processTransferOp(actor, op)
      } else {
        result = {
          client_uuid: op && op.client_uuid,
          type: t || 'unknown',
          status: 'validation_failed',
          errors: [`不支持的 type: ${t}`]
        }
      }
      results.push(result)
    } catch (err) {
      const cls = classifyError(err)
      const baseResult = {
        client_uuid: op && op.client_uuid,
        type: t || 'unknown',
        status: cls.status,
        errors: cls.errors
      }
      // 冲突时尝试拉服务端最新数据
      if (cls.status === 'conflict' && t === 'customer') {
        try {
          const targetId = op.server_id || (op.payload && op.payload.id)
          if (targetId) {
            const detail = await customerService.getCustomerDetail(actor, targetId).catch(() => null)
            if (detail) {
              baseResult.server_id = Number(targetId)
              baseResult.current_payload = detail
              baseResult.current_version = detail.updated_at
            }
          }
        } catch (innerErr) {
          // 忽略
        }
      }
      results.push(baseResult)
    }
  }

  return { results }
}

module.exports = {
  processBatch,
  processCustomerOp,
  processFollowUpOp,
  processTransferOp
}
