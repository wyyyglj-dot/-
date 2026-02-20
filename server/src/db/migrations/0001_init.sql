-- 菜品分类
CREATE TABLE IF NOT EXISTS menu_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 菜品
CREATE TABLE IF NOT EXISTS menu_dish (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES menu_category(id),
  name TEXT NOT NULL,
  sell_price_cents INTEGER NOT NULL,
  cost_price_cents INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 桌位
CREATE TABLE IF NOT EXISTS dining_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_no TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 用餐会话
CREATE TABLE IF NOT EXISTS table_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL REFERENCES dining_table(id),
  status TEXT NOT NULL DEFAULT 'DINING' CHECK(status IN ('DINING','PENDING_CHECKOUT','CLOSED')),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

-- 点餐工单
CREATE TABLE IF NOT EXISTS order_ticket (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES table_session(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);

-- 工单明细
CREATE TABLE IF NOT EXISTS order_ticket_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES order_ticket(id),
  source_dish_id INTEGER REFERENCES menu_dish(id),
  dish_name_snapshot TEXT NOT NULL,
  category_snapshot TEXT NOT NULL DEFAULT '',
  unit_sell_price_cents INTEGER NOT NULL,
  unit_cost_price_cents INTEGER NOT NULL DEFAULT 0,
  qty_ordered INTEGER NOT NULL DEFAULT 1,
  qty_served INTEGER NOT NULL DEFAULT 0,
  qty_voided INTEGER NOT NULL DEFAULT 0
);

-- 支付记录
CREATE TABLE IF NOT EXISTS payment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL UNIQUE REFERENCES table_session(id),
  method TEXT NOT NULL CHECK(method IN ('CASH','WECHAT','ALIPAY')),
  amount_cents INTEGER NOT NULL,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  business_day TEXT NOT NULL,
  idempotency_key TEXT UNIQUE
);
