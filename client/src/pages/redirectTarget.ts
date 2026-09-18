// RequireAuth stores the page the user wanted in location.state.from.
export function getRedirectTarget(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from = state.from as { pathname?: unknown; search?: unknown }
    if (typeof from.pathname === 'string' && from.pathname !== '/login' && from.pathname !== '/register') {
      return from.pathname + (typeof from.search === 'string' ? from.search : '')
    }
  }
  return '/'
}
