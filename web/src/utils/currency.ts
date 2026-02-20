export function centsToYuan(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

export function centsToYuanNumber(cents: number): number {
  return cents / 100
}

export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100)
}
