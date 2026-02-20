import { get } from './client'
import type { DashboardData, RankingItem } from '../types'

function dateParams(from?: string, to?: string): string {
  const qs = new URLSearchParams()
  if (from) qs.set('from', from)
  if (to) qs.set('to', to)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const getRevenue = (from?: string, to?: string) =>
  get<{ total_cents: number; order_count: number }>(`/stats/revenue${dateParams(from, to)}`)

export const getRankings = (type: 'quantity' | 'revenue' | 'profit', from?: string, to?: string, limit = 10) =>
  get<RankingItem[]>(`/stats/rankings/${type}${dateParams(from, to)}&limit=${limit}`)

export const getDashboard = (from?: string, to?: string) =>
  get<DashboardData>(`/stats/dashboard${dateParams(from, to)}`)
