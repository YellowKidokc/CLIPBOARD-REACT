import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../server/schema-sql";
import { d1Source, importLegacy, mapItem, sqliteSource } from "../server/import-legacy";

// The legacy layout as it exists in the clipsync-db D1 database (schema read from production).
const LEGACY_SQL = `
CREATE TABLE items (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT, content TEXT,
  content_storage TEXT DEFAULT 'inline', r2_key TEXT, starred INTEGER DEFAULT 0, folder TEXT DEFAULT 'inbox',
  tags_json TEXT DEFAULT '[]', metadata_json TEXT DEFAULT '{}', created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, user_id TEXT DEFAULT 'default');
CREATE TABLE prompts (item_id TEXT PRIMARY KEY, template TEXT NOT NULL DEFAULT '', variables_json TEXT DEFAULT '[]', shortcut TEXT, ahk_script TEXT);
CREATE TABLE bookmarks (item_id TEXT PRIMARY KEY, url TEXT NOT NULL, favicon_url TEXT, extracted_text TEXT, summary TEXT, scrape_status TEXT);
CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT DEFAULT '#3b82f6', usage_count INTEGER DEFAULT 0);
`;

function legacyDb() {
  const db = new Database(":memory:");
  db.exec(LEGACY_SQL);
  const item = db.prepare("INSERT INTO items (id, type, title, content, starred, folder, tags_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)");
  item.run("c1", "clip", "Grace term", "W_grace as source", 1, "clips", '["slot:9"]', 1774314669613, 1777370614646);
  item.run("c2", "clip", null, "\n  first line here\nsecond", 0, "inbox", "[]", 1777082233847, 1777082233847);
  item.run("n1", "note", "A note", "body", 0, "inbox", "[]", 1772182417380, 1772182417380);
  item.run("p1", "prompt", "Steelman", "fallback", 0, "prompts", '["prompt"]', 1772935763270, 1772935763270);
  item.run("b1", "bookmark", "Docs", "", 0, "bookmarks", '["API"]', 1774313484007, 1774313484007);
  item.run("b2", "bookmark", "No url", "", 0, "bookmarks", "[]", 1774313484007, 1774313484007);
  db.prepare("INSERT INTO prompts (item_id, template, shortcut) VALUES (?,?,?)").run("p1", "Steelman: {{x}}", "ctrl+1");
  db.prepare("INSERT INTO bookmarks (item_id, url, favicon_url, summary) VALUES (?,?,?,?)").run("b1", "https://developers.cloudflare.com/d1/", "fav.ico", "D1 docs");
  db.prepare("INSERT INTO bookmarks (item_id, url) VALUES (?,?)").run("b2", "");
  db.prepare("INSERT INTO tags (id, name, color) VALUES (?,?,?)").run("t1", "API", "#111111");
  return db;
}

function targetDb() {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

test("maps every legacy type and is idempotent", async () => {
  const target = targetDb();
  const counts = await importLegacy(sqliteSource(legacyDb()), target);
  assert.deepEqual(counts, { clips: 3, prompts: 1, bookmarks: 1, tags: 1, skipped: 1, alreadyPresent: 0 });

  const c1 = target.prepare("SELECT * FROM clips WHERE id='c1'").get() as any;
  assert.equal(c1.category, "clipboard");
  assert.equal(c1.starred, 1);
  assert.equal(c1.tags, '["slot:9"]');
  assert.equal(c1.created_at, new Date(1774314669613).toISOString());
  assert.equal(c1.updated_at, new Date(1777370614646).toISOString());
  assert.equal((target.prepare("SELECT title FROM clips WHERE id='c2'").get() as any).title, "first line here");
  assert.equal((target.prepare("SELECT category FROM clips WHERE id='n1'").get() as any).category, "notes");

  const p1 = target.prepare("SELECT * FROM prompts WHERE id='p1'").get() as any;
  assert.equal(p1.template, "Steelman: {{x}}");
  assert.equal(p1.shortcut, "ctrl+1");
  const b1 = target.prepare("SELECT * FROM bookmarks WHERE id='b1'").get() as any;
  assert.equal(b1.domain, "developers.cloudflare.com");
  assert.equal(b1.description, "D1 docs");
  assert.equal(b1.bookmark_tags, '["API"]');

  const again = await importLegacy(sqliteSource(legacyDb()), target);
  assert.equal(again.alreadyPresent, 5);
  assert.equal(again.clips + again.prompts + again.bookmarks, 0);
});

test("pages through more rows than one page", async () => {
  const legacy = legacyDb();
  const insert = legacy.prepare("INSERT INTO items (id, type, title, content, created_at, updated_at) VALUES (?, 'clip', ?, ?, 1, 1)");
  for (let i = 0; i < 237; i++) insert.run(`bulk-${i}`, `t${i}`, `c${i}`);
  const counts = await importLegacy(sqliteSource(legacy), targetDb());
  assert.equal(counts.clips, 3 + 237);
});

test("d1Source posts SQL with string params and unwraps results", async () => {
  const calls: any[] = [];
  const fake = (async (url: string, init: any) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ success: true, result: [{ results: [{ x: 1 }] }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const rows = await d1Source("acct", "dbid", "tok", fake).query("SELECT ?", [5]);
  assert.deepEqual(rows, [{ x: 1 }]);
  assert.equal(calls[0].url, "https://api.cloudflare.com/client/v4/accounts/acct/d1/database/dbid/query");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(calls[0].init.body), { sql: "SELECT ?", params: ["5"] });

  const failing = (async () =>
    new Response(JSON.stringify({ success: false, errors: [{ message: "no access" }] }), { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(d1Source("a", "b", "c", failing).query("SELECT 1"), /no access/);
});

test("unknown types are skipped, not guessed", () => {
  assert.equal(mapItem({ id: "x", type: "mystery" }).table, null);
});
