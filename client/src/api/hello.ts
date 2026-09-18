import { apiFetch } from './client'

export async function getHello(signal?: AbortSignal): Promise<string> {
  const { message } = await apiFetch<{ message: string }>('/api/hello', { signal })
  return message
}
