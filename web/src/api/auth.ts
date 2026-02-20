import { get, post } from './client'
import type { AuthStateResponse, AuthTokenResponse, AuthSetupRequest, AuthRecoverRequest } from '../types'

export function getAuthState(): Promise<AuthStateResponse> {
  return get<AuthStateResponse>('/auth/state')
}

export function setupPin(data: AuthSetupRequest): Promise<AuthTokenResponse> {
  return post<AuthTokenResponse>('/auth/setup', data)
}

export function login(pin: string): Promise<AuthTokenResponse> {
  return post<AuthTokenResponse>('/auth/login', { pin })
}

export function recover(data: AuthRecoverRequest): Promise<AuthTokenResponse> {
  return post<AuthTokenResponse>('/auth/recover', data)
}

export function checkAuth(): Promise<void> {
  return get<void>('/auth/check')
}

export function logout(): Promise<void> {
  return post<void>('/auth/logout', {})
}
