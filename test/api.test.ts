import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";

process.env.CLIPSYNC_DATA_DIR = mkdtempSync(join(tmpdir(), "clipsync-test-"));

const { initializeDatabase } = await import("../server/db");
const { api, CLIP_PREVIEW_CHARS } = await import("../server/routes");
const { requireApiKey } = await import("../server/auth");
initializeDatabase();

function app(key = "") {
  const a = new Hono();
  a.use("/api/*", requireApiKey(key));
  a.get("/api/health", (c) => c.json({ ok: true }));
  a.route("/api", api);
  return a;
}

const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("API key gate", async () => {
  const locked = app("s3cret");
  assert.equal((await locked.request("/api/clips")).status, 401);
  assert.equal((await locked.request("/api/clips", { headers: { "X-API-Key": "wrong!" } })).status, 401);
  assert.equal((await locked.request("/api/clips", { headers: { "X-API-Key": "s3cret" } })).status, 200);
  assert.equal((await locked.request("/api/clips", { headers: { Authorization: "Bearer s3cret" } })).status, 200);
  assert.equal((await locked.request("/api/health")).status, 200);
  assert.equal((await app("").request("/api/clips")).status, 200);
});

test("long clips list as a preview, full text by id, preview can't overwrite", async () => {
  const a = app();
  const long = "x".repeat(CLIP_PREVIEW_CHARS + 500);
  const created = await (await a.request("/api/clips", json({ title: "big", content: long }))).json();
  await a.request("/api/clips", json({ title: "small", content: "needle in here" }));

  const list = await (await a.request("/api/clips")).json();
  const big = list.find((c: any) => c.id === created.id);
  assert.equal(big.truncated, true);
  assert.equal(big.content.length, CLIP_PREVIEW_CHARS);
  assert.equal(big.contentLength, long.length);

  const full = await (await a.request(`/api/clips/${created.id}`)).json();
  assert.equal(full.content, long);

  const patch = (body: unknown) => a.request(`/api/clips/${created.id}`, { ...json(body), method: "PATCH" });
  assert.equal((await patch({ content: big.content })).status, 409);
  assert.equal((await patch({ starred: true, truncated: true, contentLength: 1 })).status, 200);
  const after = await (await a.request(`/api/clips/${created.id}`)).json();
  assert.equal(after.content, long);
  assert.equal(after.starred, true);

  const found = await (await a.request("/api/clips?q=needle")).json();
  assert.deepEqual(found.map((c: any) => c.title), ["small"]);
  assert.equal((await (await a.request("/api/clips?limit=1")).json()).length, 1);
});
