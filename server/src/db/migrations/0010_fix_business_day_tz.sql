-- 修复时区问题：paid_at 存储的是 UTC 时间 (datetime('now'))，
-- 但 business_day 之前按服务器本地时间(UTC)写入，应为 UTC+8
-- 按 paid_at + 8 小时重算 business_day
UPDATE payment
SET business_day = date(paid_at, '+8 hours')
WHERE paid_at IS NOT NULL;
