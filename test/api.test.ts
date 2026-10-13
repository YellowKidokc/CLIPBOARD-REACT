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

test("MCP JSON-RPC endpoint", async () => {
  const a = app();
  const rpc = async (method: string, params?: unknown) =>
    (await a.request("/api/mcp", json({ jsonrpc: "2.0", id: 7, method, params }))).json();

  const init = await rpc("initialize", { protocolVersion: "2025-03-26" });
  assert.equal(init.result.serverInfo.name, "ClipSync");
  assert.equal(init.id, 7);
  const names = (await rpc("tools/list")).result.tools.map((t: any) => t.name);
  assert.ok(names.includes("search_clips") && names.includes("create_clip"));

  const created = await rpc("tools/call", { name: "create_clip", arguments: { title: "mcp note", content: "from an MCP client", tags: ["mcp-tag"] } });
  assert.equal(created.result.isError, false);
  const found = await rpc("tools/call", { name: "search_clips", arguments: { query: "mcp-tag" } });
  const results = JSON.parse(found.result.content[0].text).results;
  assert.deepEqual(results.map((r: any) => r.title), ["mcp note"]);

  const notes = JSON.parse((await rpc("tools/call", { name: "list_clips", arguments: { category: "notes", limit: 5 } })).result.content[0].text).clips;
  assert.ok(notes.every((n: any) => n.category === "notes") && notes.length >= 1);

  const unknown = await rpc("tools/call", { name: "nope" });
  assert.equal(unknown.result.isError, true);
  const missing = await a.request("/api/mcp", json({ jsonrpc: "2.0", id: 1, method: "resources/list" }));
  assert.equal((await missing.json()).error.code, -32601);
});

test("AI routes report a clear error when no provider is configured", async () => {
  for (const k of ["AI_PROVIDER", "DEEPSEEK_API_KEY", "OLLAMA_HOST", "OPENAI_API_KEY"]) delete process.env[k];
  const res = await app().request("/api/chat", json({ messages: [{ role: "user", content: "hi" }] }));
  const text = await res.text();
  assert.match(text, /No AI provider configured/);
});

test("chat goes to the configured OpenAI-compatible host with its model (fake Ollama)", async () => {
  const { createServer } = await import("node:http");
  const seen: any[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const piece of ["Hello", " from", " Ollama"]) {
        res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 0, model: "m", choices: [{ index: 0, delta: { content: piece }, finish_reason: null }] })}\n\n`);
      }
      res.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port;
  process.env.AI_PROVIDER = "ollama";
  process.env.OLLAMA_HOST = `127.0.0.1:${port}`;
  process.env.AI_MODEL = "gemma4:e4b";
  try {
    const res = await app().request("/api/chat", json({ messages: [{ role: "user", content: "hi" }] }));
    const text = await res.text();
    const streamed = [...text.matchAll(/"content":"([^"]*)"/g)].map((m) => m[1]).join("");
    assert.equal(streamed, "Hello from Ollama");
    assert.equal(seen[0].url, "/v1/chat/completions");
    assert.equal(seen[0].body.model, "gemma4:e4b");
    assert.equal(seen[0].auth, "Bearer ollama");
  } finally {
    server.close();
    for (const k of ["AI_PROVIDER", "OLLAMA_HOST", "AI_MODEL"]) delete process.env[k];
  }
});

test("creating a clip accepts tags as an array (what the UI sends)", async () => {
  const res = await app().request("/api/clips", json({ title: "ai answer", content: "x", tags: ["ai-generated", "slot:4"] }));
  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).tags, ["ai-generated", "slot:4"]);
});
