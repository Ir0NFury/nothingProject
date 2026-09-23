import { apiFetch } from './client'
import type { Category } from './types'

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const { categories } = await apiFetch<{ categories: Category[] }>('/api/categories', { signal })
  return categories
}
