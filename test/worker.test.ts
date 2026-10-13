import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index";

// Just enough of a D1 binding for drizzle's select: every query returns no rows.
const stmt = { bind: () => stmt, all: async () => ({ results: [] }), raw: async () => [], first: async () => null, run: async () => ({}) };
const DB = { prepare: () => stmt, batch: async () => [] };
const env = (key?: string) => ({ DB, OPENAI_API_KEY: "", ENVIRONMENT: "test", ASSETS: {}, CLIPSYNC_API_KEY: key });

test("worker refuses the API when no key is configured", async () => {
  const res = await worker.request("/api/clips", {}, env());
  assert.equal(res.status, 503);
  assert.equal((await worker.request("/api/health", {}, env())).status, 200);
});

test("worker requires the configured key", async () => {
  const e = env("k-123");
  assert.equal((await worker.request("/api/clips", {}, e)).status, 401);
  assert.equal((await worker.request("/api/mcp/tools", {}, e)).status, 401);
  assert.equal((await worker.request("/api/clips", { headers: { "X-API-Key": "k-12" } }, e)).status, 401);
  const ok = await worker.request("/api/clips", { headers: { "X-API-Key": "k-123" } }, e);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), []);
  assert.equal((await worker.request("/api/clips", { headers: { Authorization: "Bearer k-123" } }, e)).status, 200);
  assert.equal((await worker.request("/api/health", {}, e)).status, 200);
});
