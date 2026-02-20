CREATE INDEX IF NOT EXISTS idx_dish_category ON menu_dish(category_id);
CREATE INDEX IF NOT EXISTS idx_session_table ON table_session(table_id);
CREATE INDEX IF NOT EXISTS idx_session_status ON table_session(status);
CREATE INDEX IF NOT EXISTS idx_ticket_session ON order_ticket(session_id);
CREATE INDEX IF NOT EXISTS idx_ticket_item_ticket ON order_ticket_item(ticket_id);
CREATE INDEX IF NOT EXISTS idx_payment_business_day ON payment(business_day);
CREATE INDEX IF NOT EXISTS idx_payment_session ON payment(session_id);
