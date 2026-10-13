/**
 * The broker OAuth client secret comes from the environment only (GROK_AUTH_CLIENT_SECRET). There is no fallback
 * value in the code. While auth is on, a missing secret is a startup error, so the server refuses to start rather
 * than run sign-in with a guessed or shared credential. The secret's value is never logged or put in an error.
 */
export type EnvReader = (key: string) => string | undefined;

export class MissingAuthSecretError extends Error {
  constructor() {
    super(
      "[auth] GROK_AUTH_CLIENT_SECRET is not set. The server will not start with sign-in on and no client secret. " +
        "Set GROK_AUTH_CLIENT_SECRET in the deployment env (it is never in the repo), or set VITE_AUTH_ENABLED=false to run with auth off.",
    );
    this.name = "MissingAuthSecretError";
  }
}

/** Returns the client secret, or null when auth is explicitly off. Throws MissingAuthSecretError when auth is on and it is missing. */
export function requireGrokClientSecret(env: EnvReader): string | null {
  if (env("VITE_AUTH_ENABLED") === "false") return null;
  const secret = env("GROK_AUTH_CLIENT_SECRET");
  if (!secret) throw new MissingAuthSecretError();
  return secret;
}
