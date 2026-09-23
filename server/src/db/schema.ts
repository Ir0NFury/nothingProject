import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['user', 'admin'])
export type Role = (typeof userRole.enumValues)[number]

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Stored trimmed and lowercased (the Zod schema normalizes it).
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // SHA-256 of the raw token. The raw token only ever lives in the cookie.
    tokenHash: text('token_hash').notNull().unique(),
    // All tokens rotated from one login share a family.
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedBy: uuid('replaced_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_family_id_idx').on(table.familyId),
  ],
)

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  // URL key (/categories/react-theory) and the seed's conflict target.
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  // Sort order. Deliberately not unique: swapping two positions would violate
  // a unique constraint halfway through. Ties are broken by name.
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
export type RefreshTokenRow = typeof refreshTokens.$inferSelect
export type CategoryRow = typeof categories.$inferSelect
