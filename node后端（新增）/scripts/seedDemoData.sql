-- ============================================================
-- shi-li 员工 App 演示数据种子（可重复跑）
--
-- 故事背景：一家儿童视力管理机构有"市场部"和"客服部"两个团队，
--   - 市场部：演示主管李四（id=33, manager）+ 演示员工小张（id=32, staff）
--   - 客服部：测试主管B（id=2, manager）+ 测试员工A-改（id=1, staff）
-- 每位员工有 4 个客户，状态 / 等级 / 跟进时间错落分布；
-- 跟进日志、转出审批（pending/approved/rejected）、通知、公告全链路演示。
--
-- 跑法：mysql -uvision_user -p<密码> vision_management < seedDemoData.sql
-- 幂等：所有客户用 client_uuid='demo-...' 标记，重跑前先 DELETE 这部分。
-- ============================================================

-- 0. 清理旧 demo 数据 + 之前测试残留（保留种子标签）
DELETE FROM follow_ups WHERE client_uuid LIKE 'demo-%';
DELETE FROM customer_transfers WHERE client_uuid LIKE 'demo-%';
DELETE FROM customer_attachments WHERE customer_id IN (SELECT id FROM customers WHERE client_uuid LIKE 'demo-%');
DELETE FROM customers WHERE client_uuid LIKE 'demo-%';
DELETE FROM customers WHERE client_uuid LIKE 'perf-%' OR client_uuid LIKE 'phase%' OR client_uuid LIKE 'sync-%' OR client_uuid LIKE 'pm-%';
DELETE FROM follow_ups WHERE client_uuid LIKE 'perf-%' OR client_uuid LIKE 'phase%' OR client_uuid LIKE 'sync-%' OR client_uuid LIKE 'pm-%';
DELETE FROM notifications WHERE title LIKE '【演示】%';
DELETE FROM system_announcements WHERE title LIKE '【演示】%';
-- 清理之前手测留下的杂碎客户（保留 children/users 等家长端数据）
DELETE FROM customers WHERE display_name IN ('幂等测试','重复测试','批量A','批量B','overflow','测试客户A','同步测试客户','通知触发客户','附件测试客户','附件客户2','重复客户','Postman 客户','改名后') OR display_name LIKE '%overflow-%';

-- 1. 部门：补"市场部" id=10 + "客服部" id=11
INSERT INTO departments (id, name, parent_id, sort_order, active, created_at, updated_at)
  VALUES
    (10, '市场部', NULL, 1, 1, NOW(), NOW()),
    (11, '客服部', NULL, 2, 1, NOW(), NOW())
  ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), active = 1;

-- 2. 员工归属
UPDATE employees SET department_id = 10 WHERE id IN (32, 33);
UPDATE employees SET department_id = 11 WHERE id IN (1, 2);
UPDATE departments SET manager_id = 33 WHERE id = 10;
UPDATE departments SET manager_id = 2 WHERE id = 11;

-- 3. 标签字典补 3 个（已有 5 个种子）
INSERT IGNORE INTO customer_tags (name, color, sort_order, active) VALUES
  ('新签', '#722ED1', 6, 1),
  ('复购', '#13C2C2', 7, 1),
  ('转介绍', '#EB2F96', 8, 1);

-- 4. 客户：每位员工 4 个，共 16 个
-- ============================================================
-- 演示员工小张 (id=32, staff, 市场部)
INSERT INTO customers (customer_no, display_name, phone, gender, age, school, class_name, source, status, level, tags, remark, assigned_employee_id, next_follow_up_at, next_follow_up_text, last_follow_up_at, active, client_uuid, created_by, created_at, updated_at)
VALUES
('CDM10001', '王雨涵妈妈', '13912340001', 'female', 35, '阳光小学', '一年级（3）班', 'employee', 'signed', 'A', '["A级","新签"]', '已购年卡，孩子假性近视控制中', 32, DATE_ADD(NOW(), INTERVAL 2 DAY), '寄送月度复查报告', DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 'demo-c-32-001', 32, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
('CDM10002', '李梓萱妈妈', '13912340002', 'female', 32, '实验小学', '二年级（2）班', 'employee', 'interested', 'A', '["A级","急客"]', '关心控制方案，下周到店面谈', 32, DATE_ADD(NOW(), INTERVAL 1 DAY), '上门拜访', DATE_SUB(NOW(), INTERVAL 2 DAY), 1, 'demo-c-32-002', 32, DATE_SUB(NOW(), INTERVAL 14 DAY), NOW()),
('CDM10003', '陈思源爸爸', '13912340003', 'male', 38, '红星小学', '三年级（1）班', 'miniprogram', 'potential', 'B', '["B级"]', '小程序自注册，已发优惠券', 32, DATE_ADD(NOW(), INTERVAL 5 DAY), '电话回访促单', NULL, 1, 'demo-c-32-003', 32, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
('CDM10004', '张子轩妈妈', '13912340004', 'female', 36, '阳光小学', '四年级（5）班', 'employee', 'lost', 'C', '["C级"]', '孩子已就读外校，暂无需求', 32, NULL, '', DATE_SUB(NOW(), INTERVAL 20 DAY), 1, 'demo-c-32-004', 32, DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY));

-- 演示主管李四 (id=33, manager, 市场部)
INSERT INTO customers (customer_no, display_name, phone, gender, age, school, class_name, source, status, level, tags, remark, assigned_employee_id, next_follow_up_at, next_follow_up_text, last_follow_up_at, active, client_uuid, created_by, created_at, updated_at)
VALUES
('CDM10011', '黄佳怡妈妈', '13912340011', 'female', 40, '示范小学', '五年级（2）班', 'transferred', 'signed', 'A', '["A级","复购","转介绍"]', '老客户复购，介绍 2 位朋友', 33, DATE_ADD(NOW(), INTERVAL 7 DAY), '续约洽谈', DATE_SUB(NOW(), INTERVAL 3 DAY), 1, 'demo-c-33-001', 33, DATE_SUB(NOW(), INTERVAL 90 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
('CDM10012', '刘雨彤爸爸', '13912340012', 'male', 42, '实验中学', '初一（4）班', 'employee', 'interested', 'B', '["B级","转介绍"]', '由黄佳怡妈妈介绍', 33, DATE_ADD(NOW(), INTERVAL 3 DAY), '面谈定方案', DATE_SUB(NOW(), INTERVAL 5 DAY), 1, 'demo-c-33-002', 33, DATE_SUB(NOW(), INTERVAL 21 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('CDM10013', '徐若曦妈妈', '13912340013', 'female', 34, '阳光小学', '一年级（5）班', 'miniprogram', 'potential', 'B', '["B级","急客"]', '近视急加深，急需控制', 33, DATE_ADD(NOW(), INTERVAL 1 DAY), '紧急回访', DATE_SUB(NOW(), INTERVAL 6 HOUR), 1, 'demo-c-33-003', 33, DATE_SUB(NOW(), INTERVAL 3 DAY), NOW()),
('CDM10014', '孙浩然妈妈', '13912340014', 'female', 37, '红星小学', '六年级（1）班', 'employee', 'signed', 'A', '["A级","新签"]', '本月新签年卡', 33, DATE_ADD(NOW(), INTERVAL 14 DAY), '一周后复查跟进', DATE_SUB(NOW(), INTERVAL 7 DAY), 1, 'demo-c-33-004', 33, DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY));

-- 测试员工A-改 (id=1, staff, 客服部)
INSERT INTO customers (customer_no, display_name, phone, gender, age, school, class_name, source, status, level, tags, remark, assigned_employee_id, next_follow_up_at, next_follow_up_text, last_follow_up_at, active, client_uuid, created_by, created_at, updated_at)
VALUES
('CDM10021', '吴语桐妈妈', '13912340021', 'female', 33, '实验小学', '二年级（4）班', 'transferred', 'signed', 'A', '["A级","复购"]', '从市场部转过来跟进，已续约', 1, DATE_ADD(NOW(), INTERVAL 4 DAY), '月度回访', DATE_SUB(NOW(), INTERVAL 2 DAY), 1, 'demo-c-01-001', 1, DATE_SUB(NOW(), INTERVAL 50 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('CDM10022', '周可馨爸爸', '13912340022', 'male', 39, '阳光小学', '三年级（2）班', 'miniprogram', 'interested', 'B', '["B级"]', '小程序咨询过 2 次', 1, DATE_ADD(NOW(), INTERVAL 2 DAY), '电话沟通方案', DATE_SUB(NOW(), INTERVAL 3 DAY), 1, 'demo-c-01-002', 1, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
('CDM10023', '冯安宁妈妈', '13912340023', 'female', 35, '红星小学', '四年级（3）班', 'employee', 'potential', 'C', '["C级"]', '初次接触，发资料中', 1, DATE_ADD(NOW(), INTERVAL 6 DAY), '资料反馈跟进', NULL, 1, 'demo-c-01-003', 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('CDM10024', '林思琪妈妈', '13912340024', 'female', 31, '示范小学', '一年级（1）班', 'employee', 'lost', 'C', '["C级"]', '反馈价格偏高，转他家', 1, NULL, '', DATE_SUB(NOW(), INTERVAL 15 DAY), 1, 'demo-c-01-004', 1, DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY));

-- 测试主管B (id=2, manager, 客服部)
INSERT INTO customers (customer_no, display_name, phone, gender, age, school, class_name, source, status, level, tags, remark, assigned_employee_id, next_follow_up_at, next_follow_up_text, last_follow_up_at, active, client_uuid, created_by, created_at, updated_at)
VALUES
('CDM10031', '何嘉欣妈妈', '13912340031', 'female', 36, '示范小学', '三年级（3）班', 'employee', 'signed', 'A', '["A级","续约"]', '主管直接对接的大客户，多孩家庭', 2, DATE_ADD(NOW(), INTERVAL 10 DAY), 'VIP 客户半年深度服务', DATE_SUB(NOW(), INTERVAL 4 DAY), 1, 'demo-c-02-001', 2, DATE_SUB(NOW(), INTERVAL 120 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
('CDM10032', '罗子涵爸爸', '13912340032', 'male', 41, '实验中学', '初二（1）班', 'transferred', 'interested', 'A', '["A级","转介绍"]', '何嘉欣介绍', 2, DATE_ADD(NOW(), INTERVAL 2 DAY), '面谈套餐', DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 'demo-c-02-002', 2, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
('CDM10033', '高梦琪妈妈', '13912340033', 'female', 34, '阳光小学', '二年级（5）班', 'miniprogram', 'potential', 'B', '["B级","急客"]', '电话咨询过', 2, DATE_ADD(NOW(), INTERVAL 1 DAY), '尽快回访锁单', NULL, 1, 'demo-c-02-003', 2, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
('CDM10034', '邓子墨妈妈', '13912340034', 'female', 38, '红星小学', '五年级（4）班', 'employee', 'lost', 'C', '["C级"]', '已选其他机构', 2, NULL, '', DATE_SUB(NOW(), INTERVAL 25 DAY), 1, 'demo-c-02-004', 2, DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY));

-- 5. 跟进日志：每客户 1~3 条，共约 32 条
-- ============================================================
-- 小张的客户跟进
INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 32, DATE_SUB(NOW(), INTERVAL 1 DAY), 'phone', 'signed', '客户已支付年卡费用，签订服务协议；约下周来店采集首次基础数据。',
       NULL, DATE_ADD(NOW(), INTERVAL 2 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-32-001';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 32, DATE_SUB(NOW(), INTERVAL 2 DAY), 'wechat', 'interested', '客户在微信咨询了 OK 镜和角膜塑形镜的差异；建议下周面谈让医生评估。',
       NULL, DATE_ADD(NOW(), INTERVAL 1 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-32-002';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 32, DATE_SUB(NOW(), INTERVAL 5 DAY), 'face', 'follow_up', '初步面谈；客户咨询价位，已发详细资料和优惠券给孩子妈妈。', NULL, DATE_ADD(NOW(), INTERVAL 1 DAY), CONCAT('demo-fu-', c.id, '-2'), DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-32-002';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 32, DATE_SUB(NOW(), INTERVAL 20 DAY), 'phone', 'lost', '客户反馈孩子已就读外地学校，暂无需求；标记流失。', NULL, NULL, CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-32-004';

-- 李四的客户跟进
INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 33, DATE_SUB(NOW(), INTERVAL 3 DAY), 'face', 'signed', '客户来店复购，购入第二期年卡套餐，并主动介绍 2 位邻居家长。', NULL, DATE_ADD(NOW(), INTERVAL 7 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-33-001';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 33, DATE_SUB(NOW(), INTERVAL 5 DAY), 'phone', 'interested', '黄佳怡介绍来的客户，电话沟通顺利，下周面谈定方案。', NULL, DATE_ADD(NOW(), INTERVAL 3 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-33-002';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 33, DATE_SUB(NOW(), INTERVAL 6 HOUR), 'phone', 'follow_up', '紧急回访：孩子近 3 个月近视加深 50 度，急需控制方案。已约明天上门评估。', NULL, DATE_ADD(NOW(), INTERVAL 1 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 6 HOUR), DATE_SUB(NOW(), INTERVAL 6 HOUR)
FROM customers c WHERE c.client_uuid = 'demo-c-33-003';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 33, DATE_SUB(NOW(), INTERVAL 7 DAY), 'face', 'signed', '本月新签，已交付角膜塑形镜首付 + 方案确认。', NULL, DATE_ADD(NOW(), INTERVAL 14 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-33-004';

-- 测试员工A 的客户跟进
INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), 'wechat', 'signed', '已续约第二年服务，赠送复查 4 次。', NULL, DATE_ADD(NOW(), INTERVAL 4 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-01-001';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 1, DATE_SUB(NOW(), INTERVAL 3 DAY), 'phone', 'interested', '客户对方案感兴趣，要求下次面谈带孩子一起。', NULL, DATE_ADD(NOW(), INTERVAL 2 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-01-002';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), 'wechat', 'no_progress', '初次微信沟通，已发送品牌资料和适合年龄段的方案介绍。', NULL, DATE_ADD(NOW(), INTERVAL 6 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-01-003';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 1, DATE_SUB(NOW(), INTERVAL 15 DAY), 'phone', 'lost', '客户反馈价格偏高，已转其他机构。', NULL, NULL, CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 15 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-01-004';

-- 主管B 的客户跟进
INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 2, DATE_SUB(NOW(), INTERVAL 4 DAY), 'face', 'signed', 'VIP 客户半年深度服务回访，孩子视力指标趋稳，家长满意度高。', NULL, DATE_ADD(NOW(), INTERVAL 10 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-02-001';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 2, DATE_SUB(NOW(), INTERVAL 1 DAY), 'phone', 'interested', '何嘉欣介绍的客户，已发资料；下周面谈定套餐。', NULL, DATE_ADD(NOW(), INTERVAL 2 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-02-002';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 2, DATE_SUB(NOW(), INTERVAL 2 DAY), 'phone', 'follow_up', '客户咨询过两次，对价格仍犹豫；可能需要送试用券。', NULL, DATE_ADD(NOW(), INTERVAL 1 DAY), CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-02-003';

INSERT INTO follow_ups (customer_id, employee_id, follow_at, type, result, content, attachments, next_follow_up_at, client_uuid, created_at, updated_at)
SELECT c.id, 2, DATE_SUB(NOW(), INTERVAL 25 DAY), 'phone', 'lost', '已选竞品。', NULL, NULL, CONCAT('demo-fu-', c.id, '-1'), DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-02-004';

-- 6. 转出申请：4 条（pending 2 / approved 1 / rejected 1）
-- ============================================================
-- (a) 小张提交：把 demo-c-32-003（陈思源爸爸）转给李四，pending 状态
INSERT INTO customer_transfers (customer_id, from_employee_id, to_employee_id, reason, status, approved_by, approved_at, approval_remark, client_uuid, created_at, updated_at)
SELECT c.id, 32, NULL, '客户更适合主管李四长期跟进（其父母倾向更资深的顾问）', 'pending', NULL, NULL, '', 'demo-xfer-001', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-32-003';

-- (b) 测试员工A 提交：把 demo-c-01-002（周可馨爸爸）转给主管B，pending 状态
INSERT INTO customer_transfers (customer_id, from_employee_id, to_employee_id, reason, status, approved_by, approved_at, approval_remark, client_uuid, created_at, updated_at)
SELECT c.id, 1, NULL, '客户表示希望由经验更丰富的主管沟通方案细节', 'pending', NULL, NULL, '', 'demo-xfer-002', DATE_SUB(NOW(), INTERVAL 6 HOUR), DATE_SUB(NOW(), INTERVAL 6 HOUR)
FROM customers c WHERE c.client_uuid = 'demo-c-01-002';

-- (c) 历史 approved：测试员工A 之前提交，主管B 已通过
INSERT INTO customer_transfers (customer_id, from_employee_id, to_employee_id, reason, status, approved_by, approved_at, approval_remark, client_uuid, created_at, updated_at)
SELECT c.id, 32, 1, '客户在客服部所在区域，由小A就近跟进更方便', 'approved', 33, DATE_SUB(NOW(), INTERVAL 50 DAY), '同意，已与该员工沟通', 'demo-xfer-003', DATE_SUB(NOW(), INTERVAL 51 DAY), DATE_SUB(NOW(), INTERVAL 50 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-01-001';

-- (d) 历史 rejected：小张提交但被李四驳回
INSERT INTO customer_transfers (customer_id, from_employee_id, to_employee_id, reason, status, approved_by, approved_at, approval_remark, client_uuid, created_at, updated_at)
SELECT c.id, 32, NULL, '客户挑三拣四，不想再跟', 'rejected', 33, DATE_SUB(NOW(), INTERVAL 18 DAY), '原因不充分，请继续耐心跟进；如有具体障碍可单独沟通', 'demo-xfer-004', DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY)
FROM customers c WHERE c.client_uuid = 'demo-c-32-004';

-- 7. 通知：给 4 个员工各发若干
-- ============================================================
-- 小张 id=32：客户分配 + 转出待审批结果 + 公告
INSERT INTO notifications (employee_id, type, title, body, payload, is_read, read_at, created_at)
VALUES
(32, 'customer_assigned',           '【演示】您有 1 位新分配客户', '陈思源爸爸（潜在客户）已分配给您，请尽快首次联系。', JSON_OBJECT('customer_uuid','demo-c-32-003'), 0, NULL, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(32, 'customer_transfer_result',    '【演示】您的转出申请已被驳回', '客户「张子轩妈妈」的转出申请被主管驳回。原因：原因不充分，请继续耐心跟进；如有具体障碍可单独沟通', JSON_OBJECT('transfer_uuid','demo-xfer-004'), 1, DATE_SUB(NOW(), INTERVAL 17 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY)),
(32, 'follow_up_reminder',          '【演示】跟进提醒：李梓萱妈妈', '今日需上门拜访，请准备方案资料。', JSON_OBJECT('customer_uuid','demo-c-32-002'), 0, NULL, DATE_SUB(NOW(), INTERVAL 12 HOUR)),
(32, 'system_announcement',         '【演示】公告：本月新签客户激励政策', '本月新签客户超 3 位的员工，额外奖励 5%。', NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY));

-- 李四 id=33（manager）：待审批 + 客户转入 + 公告
INSERT INTO notifications (employee_id, type, title, body, payload, is_read, read_at, created_at)
VALUES
(33, 'pending_approval',            '【演示】有 1 条转出申请待审批', '员工小张提交：陈思源爸爸 → 转出原因「客户更适合主管李四长期跟进」', JSON_OBJECT('transfer_uuid','demo-xfer-001'), 0, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(33, 'customer_modified',           '【演示】部门内客户信息变更', '小张更新了客户「李梓萱妈妈」的状态：potential → interested', JSON_OBJECT('customer_uuid','demo-c-32-002'), 1, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
(33, 'follow_up_reminder',          '【演示】跟进提醒：徐若曦妈妈', '紧急客户，今日需回访，请优先处理。', JSON_OBJECT('customer_uuid','demo-c-33-003'), 0, NULL, DATE_SUB(NOW(), INTERVAL 6 HOUR)),
(33, 'system_announcement',         '【演示】公告：本月新签客户激励政策', '本月新签客户超 3 位的员工，额外奖励 5%。', NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY));

-- 测试员工A id=1：客户转入 + 待跟进
INSERT INTO notifications (employee_id, type, title, body, payload, is_read, read_at, created_at)
VALUES
(1, 'customer_transfer_in',         '【演示】1 位客户已转入', '由小张转入：吴语桐妈妈（A 级客户，已签约），请按月维护。', JSON_OBJECT('customer_uuid','demo-c-01-001','transfer_uuid','demo-xfer-003'), 1, DATE_SUB(NOW(), INTERVAL 49 DAY), DATE_SUB(NOW(), INTERVAL 50 DAY)),
(1, 'follow_up_reminder',           '【演示】跟进提醒：周可馨爸爸', '今日电话沟通方案，请准备好套餐报价。', JSON_OBJECT('customer_uuid','demo-c-01-002'), 0, NULL, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(1, 'system_announcement',          '【演示】公告：本月新签客户激励政策', '本月新签客户超 3 位的员工，额外奖励 5%。', NULL, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY));

-- 主管B id=2：待审批 + 跟进 + 公告
INSERT INTO notifications (employee_id, type, title, body, payload, is_read, read_at, created_at)
VALUES
(2, 'pending_approval',             '【演示】有 1 条转出申请待审批', '员工小A提交：周可馨爸爸 → 转出原因「客户表示希望由经验更丰富的主管沟通方案细节」', JSON_OBJECT('transfer_uuid','demo-xfer-002'), 0, NULL, DATE_SUB(NOW(), INTERVAL 6 HOUR)),
(2, 'follow_up_reminder',           '【演示】跟进提醒：罗子涵爸爸', '今日需面谈，主推 A 级套餐。', JSON_OBJECT('customer_uuid','demo-c-02-002'), 0, NULL, DATE_SUB(NOW(), INTERVAL 12 HOUR)),
(2, 'follow_up_reminder',           '【演示】跟进提醒：高梦琪妈妈', '今日尽快回访锁单。', JSON_OBJECT('customer_uuid','demo-c-02-003'), 0, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 'system_announcement',          '【演示】公告：本月新签客户激励政策', '本月新签客户超 3 位的员工，额外奖励 5%。', NULL, 0, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY));

-- 8. 系统公告：5 条
-- ============================================================
INSERT INTO system_announcements (title, body, is_top, must_popup, publish_at, expires_at, active, created_by, created_at, updated_at)
VALUES
('【演示】本月新签客户激励政策（置顶）', '尊敬的同事们：\n\n本月（2026-04）单人新签客户达成 3 位以上的员工，将获得额外 5% 的销售奖励。多签多得，上不封顶。\n\n— 公司管理团队', 1, 1, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), 1, 1, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY)),
('【演示】App 上线公告', '员工 App 正式上线，请所有同事在我的中心 → 修改密码 → 完成首登流程。如有问题联系 IT。', 0, 0, DATE_SUB(NOW(), INTERVAL 5 DAY), NULL, 1, 1, DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)),
('【演示】五月份团建预告', '5 月 18 日（周六）公司团建，地点：南山泉庄，请所有员工提前预留时间。', 0, 0, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 25 DAY), 1, 1, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY)),
('【演示】客户跟进规范更新', '即日起：A 级客户每周至少 1 次跟进，B 级 2 周 1 次，C 级 1 月 1 次。请大家严格执行。', 0, 0, DATE_SUB(NOW(), INTERVAL 7 DAY), NULL, 1, 1, DATE_SUB(NOW(), INTERVAL 7 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
('【演示】新增"急客"标签使用说明', '"急客"标签用于标记 7 天内必须签约的高优先级客户，主管可在工作台优先看到。', 0, 0, DATE_SUB(NOW(), INTERVAL 10 DAY), NULL, 1, 1, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_SUB(NOW(), INTERVAL 10 DAY));

-- 9. 同步 customer 的 last_follow_up_at（部分）
-- 不需要手动 sync —— 已在每条 customer 的 last_follow_up_at 手写入，与 follow_ups 时间一致。

-- ============================================================
-- 完成
-- ============================================================
SELECT '✅ 演示数据灌入完成' AS msg, NOW() AS at;
SELECT
  (SELECT COUNT(*) FROM customers WHERE client_uuid LIKE 'demo-%') AS customers_seeded,
  (SELECT COUNT(*) FROM follow_ups WHERE client_uuid LIKE 'demo-fu-%') AS follow_ups_seeded,
  (SELECT COUNT(*) FROM customer_transfers WHERE client_uuid LIKE 'demo-xfer-%') AS transfers_seeded,
  (SELECT COUNT(*) FROM notifications WHERE title LIKE '【演示】%') AS notifications_seeded,
  (SELECT COUNT(*) FROM system_announcements WHERE title LIKE '【演示】%') AS announcements_seeded;
