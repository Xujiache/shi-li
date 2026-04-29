/**
 * 本地 SQLite 表结构定义。
 *
 * 严格只用 Android 5+ SQLite（3.8.x）兼容子集：
 *   - CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
 *   - TEXT / INTEGER / REAL / 主键 / UNIQUE
 *   - 不用 STRICT、不用 JSON 函数、不用窗口函数、不用 WAL
 *
 * 业务实体的本地主键统一用 client_uuid（TEXT），server_id 单独存列；
 * 外键也用 client_uuid（不要在本地把外键替换成 server_id）。
 *
 * INIT_SQLS 每条 SQL 一项，**不要** 用分号合并到一条字符串。
 */

export const SCHEMA_VERSION = 1

export const INIT_SQLS: string[] = [
  // ---------- local_employee：单行 KV 缓存（id=1） ----------
  `CREATE TABLE IF NOT EXISTS local_employee (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER,
    phone TEXT,
    display_name TEXT,
    role TEXT,
    department_id INTEGER,
    avatar_url TEXT,
    position TEXT,
    token TEXT,
    profile_json TEXT,
    last_sync_at INTEGER,
    updated_at INTEGER
  )`,

  // ---------- local_customers ----------
  `CREATE TABLE IF NOT EXISTS local_customers (
    client_uuid TEXT PRIMARY KEY,
    server_id INTEGER,
    owner_employee_id INTEGER NOT NULL,
    name TEXT,
    phone TEXT,
    gender TEXT,
    age INTEGER,
    level TEXT,
    status TEXT,
    source TEXT,
    department_id INTEGER,
    next_follow_up_at TEXT,
    next_follow_up_text TEXT,
    remark TEXT,
    extra_json TEXT,
    base_version TEXT,
    dirty INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_customers_owner ON local_customers(owner_employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_local_customers_server ON local_customers(server_id)`,
  `CREATE INDEX IF NOT EXISTS idx_local_customers_dirty ON local_customers(dirty)`,
  `CREATE INDEX IF NOT EXISTS idx_local_customers_phone ON local_customers(phone)`,
  `CREATE INDEX IF NOT EXISTS idx_local_customers_updated ON local_customers(updated_at)`,

  // ---------- local_follow_ups ----------
  `CREATE TABLE IF NOT EXISTS local_follow_ups (
    client_uuid TEXT PRIMARY KEY,
    server_id INTEGER,
    owner_employee_id INTEGER NOT NULL,
    customer_uuid TEXT,
    customer_server_id INTEGER,
    type TEXT,
    result TEXT,
    content TEXT,
    next_follow_up_at TEXT,
    attachments_json TEXT,
    extra_json TEXT,
    base_version TEXT,
    dirty INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_follow_ups_owner ON local_follow_ups(owner_employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_local_follow_ups_customer ON local_follow_ups(customer_uuid)`,
  `CREATE INDEX IF NOT EXISTS idx_local_follow_ups_server ON local_follow_ups(server_id)`,
  `CREATE INDEX IF NOT EXISTS idx_local_follow_ups_dirty ON local_follow_ups(dirty)`,

  // ---------- local_notifications：缓存最近 200 条 ----------
  `CREATE TABLE IF NOT EXISTS local_notifications (
    server_id INTEGER PRIMARY KEY,
    owner_employee_id INTEGER NOT NULL,
    title TEXT,
    body TEXT,
    type TEXT,
    is_read INTEGER DEFAULT 0,
    payload_json TEXT,
    created_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_notifications_owner ON local_notifications(owner_employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_local_notifications_created ON local_notifications(created_at)`,

  // ---------- pending_op：核心同步队列 ----------
  `CREATE TABLE IF NOT EXISTS pending_op (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_employee_id INTEGER NOT NULL,
    client_uuid TEXT UNIQUE,
    type TEXT NOT NULL,
    op TEXT NOT NULL,
    payload TEXT,
    base_version TEXT,
    server_id INTEGER,
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    next_retry_at INTEGER DEFAULT 0,
    last_error TEXT,
    lock_token TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pending_op_owner ON pending_op(owner_employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pending_op_status ON pending_op(status)`,
  `CREATE INDEX IF NOT EXISTS idx_pending_op_retry ON pending_op(next_retry_at)`,
  `CREATE INDEX IF NOT EXISTS idx_pending_op_type ON pending_op(type)`,

  // ---------- local_attachment：附件懒上传 ----------
  `CREATE TABLE IF NOT EXISTS local_attachment (
    client_uuid TEXT PRIMARY KEY,
    owner_employee_id INTEGER NOT NULL,
    local_path TEXT,
    server_id INTEGER,
    server_url TEXT,
    ref_type TEXT,
    ref_client_uuid TEXT,
    status TEXT DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_local_attachment_owner ON local_attachment(owner_employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_local_attachment_status ON local_attachment(status)`,
  `CREATE INDEX IF NOT EXISTS idx_local_attachment_ref ON local_attachment(ref_client_uuid)`
]
