import type { Context, MiddlewareHandler } from "hono";

/**
 * API-key gate for /api/*, shared by the Node server and the Cloudflare Worker.
 * Accepts `X-API-Key: <key>` or `Authorization: Bearer <key>`; /api/health stays open.
 * `whenUnset` decides what happens if no key is configured: "open" (trusted LAN) or
 * "refuse" (public deployments: every API call gets 503 until a key is set).
 */
export function apiKeyGate(
  getKey: (c: Context) => string | undefined,
  whenUnset: "open" | "refuse",
): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.path === "/api/health") return next();
    const key = getKey(c) || "";
    if (!key) {
      if (whenUnset === "open") return next();
      return c.json({ message: "Server has no CLIPSYNC_API_KEY configured; API is disabled until one is set." }, 503);
    }
    const given = c.req.header("x-api-key") || c.req.header("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!(await sameSecret(given, key))) return c.json({ message: "API key required" }, 401);
    return next();
  };
}

/** Constant-time comparison via SHA-256 digests (Web Crypto: Workers and Node 20+). */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
