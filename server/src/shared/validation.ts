import { DomainError } from './errors'

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('VALIDATION_ERROR', `${field} is required`)
  }
  return value.trim()
}

export function requirePositiveInt(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be a positive integer`)
  }
  return n
}

export function requireNonNegativeInt(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) {
    throw new DomainError('VALIDATION_ERROR', `${field} must be a non-negative integer`)
  }
  return n
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}
