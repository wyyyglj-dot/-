ALTER TABLE menu_dish ADD COLUMN has_spice_option INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_ticket_item ADD COLUMN spice_level TEXT;
