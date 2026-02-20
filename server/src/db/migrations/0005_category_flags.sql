ALTER TABLE menu_category ADD COLUMN skip_queue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_category ADD COLUMN discount_rate REAL NOT NULL DEFAULT 1.0;
ALTER TABLE menu_category ADD COLUMN is_discount_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_ticket_item ADD COLUMN skip_queue_snapshot INTEGER NOT NULL DEFAULT 0;
