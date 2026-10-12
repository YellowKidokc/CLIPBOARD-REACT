import { timingSafeEqual } from "crypto";
import type { MiddlewareHandler } from "hono";

/**
 * API-key gate for /api/*. Off when CLIPSYNC_API_KEY is empty (trusted LAN only).
 * Accepts `X-API-Key: <key>` or `Authorization: Bearer <key>`. /api/health stays open
 * for the Docker health check.
 */
export function requireApiKey(key = process.env.CLIPSYNC_API_KEY || ""): MiddlewareHandler {
  const expected = Buffer.from(key);
  return async (c, next) => {
    if (!key || c.req.path === "/api/health") return next();
    const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const given = Buffer.from(c.req.header("x-api-key") || bearer || "");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return c.json({ message: "API key required" }, 401);
    }
    return next();
  };
}
