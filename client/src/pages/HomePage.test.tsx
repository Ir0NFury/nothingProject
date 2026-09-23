// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

const categories = [
  { id: '1', slug: 'react-theory', name: 'React theory', description: 'Hooks and rendering' },
  { id: '2', slug: 'js-theory', name: 'JavaScript theory', description: 'Closures and the event loop' },
]

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderPage() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  it('renders a linked tile for each category', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { categories }))
    renderPage()

    expect(screen.getByRole('status')).toBeTruthy()
    const react = await screen.findByRole('link', { name: /React theory/ })
    expect(react.getAttribute('href')).toBe('/categories/react-theory')
    expect(react.textContent).toContain('Hooks and rendering')
    const js = screen.getByRole('link', { name: /JavaScript theory/ })
    expect(js.getAttribute('href')).toBe('/categories/js-theory')
    expect(js.textContent).toContain('Closures and the event loop')
  })

  it('shows an error with Retry, and Retry refetches', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }))
      .mockResolvedValueOnce(json(200, { categories }))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Something went wrong')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('link', { name: /React theory/ })).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows an empty state when there are no categories', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { categories: [] }))
    renderPage()

    expect(await screen.findByText('No categories yet')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
