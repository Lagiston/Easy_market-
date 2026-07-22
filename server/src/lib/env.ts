// Fail fast on missing required env vars rather than silently falling back
// to insecure defaults or undefined behavior at call time.
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
