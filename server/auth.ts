import type { MiddlewareHandler } from "hono";
import { apiKeyGate } from "@shared/api-key";

/** API-key gate for the Node/Synology server. Off when CLIPSYNC_API_KEY is empty (trusted LAN only). */
export function requireApiKey(key = process.env.CLIPSYNC_API_KEY || ""): MiddlewareHandler {
  return apiKeyGate(() => key, "open");
}
