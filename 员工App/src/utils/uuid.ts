/**
 * 自实现 UUID v4，避免引入外部包。
 * 满足 RFC 4122 §4.4 的版本/变体位要求，但随机源用 Math.random()，
 * 仅用于客户端临时 id（如离线队列、文件 nonce），不要用于安全场景。
 */
export function v4(): string {
  const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  return tpl.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
