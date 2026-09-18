import { z } from 'zod'

export const credentialsSchema = z.object({
  // trim + lowercase first, then validate, so " A@B.com " is stored as "a@b.com"
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(128),
})

export type Credentials = z.infer<typeof credentialsSchema>
