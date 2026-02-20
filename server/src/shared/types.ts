export type SessionStatus = 'DINING' | 'PENDING_CHECKOUT' | 'CLOSED'
export type PaymentMethod = 'CASH' | 'WECHAT' | 'ALIPAY'

export interface Category {
  id: number
  name: string
  sort_order: number
  is_enabled: number
  skip_queue: number
  discount_rate: number
  is_discount_enabled: number
}

export interface Dish {
  id: number
  category_id: number
  name: string
  sell_price_cents: number
  cost_price_cents: number
  discount_rate: number
  is_discount_enabled: number
  has_spice_option: number
  is_enabled: number
  sort_order: number
}

export interface DiningTable {
  id: number
  table_no: string
  sort_order: number
  is_enabled: number
}

export interface TableSession {
  id: number
  table_id: number
  status: SessionStatus
  opened_at: string
  closed_at: string | null
}

export interface OrderTicket {
  id: number
  session_id: number
  created_at: string
  note: string | null
}

export interface OrderTicketItem {
  id: number
  ticket_id: number
  source_dish_id: number | null
  dish_name_snapshot: string
  category_snapshot: string
  spice_level: string | null
  unit_sell_price_cents: number
  unit_cost_price_cents: number
  qty_ordered: number
  qty_served: number
  qty_voided: number
}

export interface Payment {
  id: number
  session_id: number
  method: PaymentMethod
  amount_cents: number
  paid_at: string
  business_day: string
  idempotency_key: string | null
}
