-- 历史列表查询优化：按结账时间倒序
CREATE INDEX IF NOT EXISTS idx_session_closed_timeline
  ON table_session (closed_at DESC, id DESC)
  WHERE status = 'CLOSED';

-- 菜品删除引用检查
CREATE INDEX IF NOT EXISTS idx_ticket_item_source_dish
  ON order_ticket_item (source_dish_id);
