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

export type SpiceLevel = 'MILD' | 'MEDIUM' | 'HOT'
export const SPICE_LABELS: Record<SpiceLevel, string> = {
  MILD: '微辣',
  MEDIUM: '中辣',
  HOT: '特辣',
}
export const SPICE_COLORS: Record<SpiceLevel, string> = {
  MILD: '#f59e0b',
  MEDIUM: '#f97316',
  HOT: '#ef4444',
}

export interface DiningTable {
  id: number
  table_no: string
  sort_order: number
  is_enabled: number
}

export type SessionStatus = 'DINING' | 'PENDING_CHECKOUT' | 'CLOSED'
export type PaymentMethod = 'CASH' | 'WECHAT' | 'ALIPAY'

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
  items: OrderTicketItem[]
}

export interface OrderTicketItem {
  id: number
  ticket_id: number
  source_dish_id: number | null
  dish_name_snapshot: string
  category_snapshot: string
  unit_sell_price_cents: number
  unit_cost_price_cents: number
  qty_ordered: number
  qty_served: number
  qty_voided: number
  spice_level?: string | null
}

export interface Payment {
  id: number
  session_id: number
  method: PaymentMethod
  amount_cents: number
  paid_at: string
  business_day: string
}

export interface CartItem {
  _key: string
  dish_id: number | null
  name: string
  price_cents: number
  cost_cents: number
  quantity: number
  spice_level?: string | null
}

export interface ServingQueueItem {
  item_id: number
  ticket_id: number
  table_no: string
  table_id: number
  session_id: number
  dish_name: string
  quantity: number
  ordered_at: string
  spice_level?: string | null
}

export interface ServedItem {
  item_id: number
  ticket_id: number
  table_no: string
  table_id: number
  session_id: number
  dish_name: string
  qty_served: number
  qty_ordered: number
  ordered_at: string
  spice_level?: string | null
}

export interface TableDishItem {
  name: string
  qty_ordered: number
  qty_served: number
  qty_unserved: number
  unit_price_cents: number
  skip_queue: number
  status: 'unserved' | 'partial' | 'served'
  spice_level?: string | null
}

export interface TableSummary {
  id: number
  table_no: string
  sort_order: number
  is_enabled: number
  status: 'idle' | 'dining' | 'pending_checkout'
  session_id: number | null
  total_cents: number
  dishes: TableDishItem[]
  unserved_count: number
}

export interface SessionDetail {
  id: number
  table_id: number
  status: SessionStatus
  opened_at: string
  tickets: OrderTicket[]
  total_cents: number
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
  meta: { requestId: string; ts: string }
}

export interface DashboardData {
  revenue_cents: number
  cost_cents: number
  profit_cents: number
  order_count: number
  quantity_ranking: RankingItem[]
  revenue_ranking: RankingItem[]
  profit_ranking: RankingItem[]
}

export interface RankingItem {
  name: string
  value: number
}

export interface ClosedSessionListItem {
  session_id: number
  table_id: number
  table_no: string
  opened_at: string
  closed_at: string
  amount_cents: number
  payment_method: PaymentMethod | null
  paid_at: string | null
}

export interface ClosedSessionDetail {
  session: {
    id: number
    table_id: number
    table_no: string
    status: SessionStatus
    opened_at: string
    closed_at: string | null
  }
  payment: Payment | null
  tickets: OrderTicket[]
  total_cents: number
}

export interface RestoreResult {
  source_session_id: number
  new_session: TableSession
  restored_tickets: number
  restored_items: number
}

export interface AuthStateResponse {
  setupRequired: boolean
  securityQuestion?: string
}

export interface AuthTokenResponse {
  token: string
}

export interface AuthSetupRequest {
  pin: string
  question: string
  answer: string
}

export interface AuthLoginRequest {
  pin: string
}

export interface AuthRecoverRequest {
  answer: string
  newPin: string
}
