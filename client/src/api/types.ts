export type Role = 'user' | 'admin'

export type User = {
  id: string
  email: string
  role: Role
  createdAt: string
}

export type AuthResponse = { accessToken: string; user: User }

export type Category = {
  id: string
  slug: string
  name: string
  description: string
}
