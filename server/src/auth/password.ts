import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// scrypt is deliberately slow and memory-hungry, which makes brute-forcing leaked hashes expensive.
const PARAMS = { N: 16384, r: 8, p: 1 }
const SALT_BYTES = 16
const KEY_BYTES = 64

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

// Format: scrypt$N$r$p$<saltB64>$<hashB64>. Keeping the parameters in the string
// lets us change them later without breaking existing hashes.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await scryptAsync(password, salt, KEY_BYTES, PARAMS)
  const { N, r, p } = PARAMS
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`
}

// A positive integer. Node's scrypt treats 0 as falsy and silently substitutes its own
// default for that param (which happens to equal this app's PARAMS), so a stored hash with
// a 0 must be rejected here up front — a try/catch around scrypt can't catch a non-throw.
function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, saltB64, hashB64] = parts
  const params = { N: Number(N), r: Number(r), p: Number(p) }
  const expected = Buffer.from(hashB64, 'base64')
  // An empty hash would trivially match scrypt's 0-length output below.
  if (expected.length === 0) return false
  if (!isPositiveInt(params.N) || !isPositiveInt(params.r) || !isPositiveInt(params.p)) return false
  let actual: Buffer
  try {
    actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, params)
  } catch (err) {
    // A positive integer can still be a param scrypt itself rejects (e.g. a non-power-of-two
    // N, or params over its memory limit) — Node reports those as a RangeError.
    if (err instanceof RangeError) return false
    throw err
  }
  // Constant-time comparison, so timing doesn't leak how many bytes matched.
  return timingSafeEqual(actual, expected)
}

// Used when a login email doesn't exist: doing the same amount of work
// keeps response times similar, so they don't reveal which emails are registered.
const dummyHash = hashPassword('dummy-password-for-timing')

export async function verifyDummyPassword(password: string): Promise<void> {
  await verifyPassword(password, await dummyHash)
}
