import { apiFetch } from './client'

export function pingAdmin(signal?: AbortSignal) {
  return apiFetch<{ ok: boolean }>('/api/admin/ping', { signal })
}
