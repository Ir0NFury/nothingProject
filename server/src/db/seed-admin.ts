import { eq } from 'drizzle-orm'
import { credentialsSchema } from '../auth/auth.schemas.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { config } from '../config.js'
import { db, pool } from './client.js'
import { users } from './schema.js'

// Creates or updates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD.
// Idempotent: a second run with the same values changes nothing.
async function main() {
  const { email, password } = credentialsSchema.parse({
    email: config.ADMIN_EMAIL,
    password: config.ADMIN_PASSWORD,
  })

  const [existing] = await db.select().from(users).where(eq(users.email, email))

  if (!existing) {
    await db.insert(users).values({ email, passwordHash: await hashPassword(password), role: 'admin' })
    console.log(`Created admin ${email}`)
    return
  }

  const passwordMatches = await verifyPassword(password, existing.passwordHash)
  if (existing.role === 'admin' && passwordMatches) {
    console.log(`Admin ${email} is already up to date`)
    return
  }

  await db
    .update(users)
    .set({
      role: 'admin',
      // Only re-hash when the password changed: a new hash has a new salt.
      ...(passwordMatches ? {} : { passwordHash: await hashPassword(password) }),
    })
    .where(eq(users.id, existing.id))
  console.log(`Updated admin ${email}`)
}

try {
  await main()
} finally {
  await pool.end()
}
