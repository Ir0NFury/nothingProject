import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { db } from '../src/db/client.js'
import { categories } from '../src/db/schema.js'

function category(position: number, slug: string, name = slug) {
  return { position, slug, name, description: `About ${name}` }
}

describe('GET /api/categories', () => {
  it('returns an empty list when there are no categories', async () => {
    const res = await request(app).get('/api/categories')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ categories: [] })
  })

  it('orders categories by position', async () => {
    await db.insert(categories).values([category(3, 'c'), category(1, 'a'), category(2, 'b')])

    const res = await request(app).get('/api/categories')

    expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['a', 'b', 'c'])
  })

  it('breaks position ties by name', async () => {
    await db.insert(categories).values([category(1, 'second', 'Beta'), category(1, 'first', 'Alpha')])

    const res = await request(app).get('/api/categories')

    expect(res.body.categories.map((c: { slug: string }) => c.slug)).toEqual(['first', 'second'])
  })

  it('returns only the public fields', async () => {
    await db.insert(categories).values(category(1, 'react-theory', 'React theory'))

    const res = await request(app).get('/api/categories')

    expect(res.body.categories).toEqual([
      { id: expect.any(String), slug: 'react-theory', name: 'React theory', description: 'About React theory' },
    ])
  })

  it('ignores an invalid Authorization header', async () => {
    const res = await request(app).get('/api/categories').set('Authorization', 'Bearer not-a-real-token')

    expect(res.status).toBe(200)
  })
})
