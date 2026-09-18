// Environment for automated tests. No secrets needed: the JWT secret is test-only.
export const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://app:app@localhost:5433/interview_prep_test',
  JWT_ACCESS_SECRET: 'test-only-secret-test-only-secret-test-only',
}
