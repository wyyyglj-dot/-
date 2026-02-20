import { Request, Response, NextFunction } from 'express'
import { fail } from './response'

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 400,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404)
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, code = 'CONFLICT') {
    super(code, message, 409)
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as any).requestId || ''
  if (err instanceof DomainError) {
    res.status(err.httpStatus).json(fail(err.code, err.message, requestId))
    return
  }
  console.error('Unhandled error:', err)
  res.status(500).json(fail('INTERNAL_ERROR', 'Internal server error', requestId))
}
