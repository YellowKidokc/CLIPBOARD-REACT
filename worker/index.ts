/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import * as schema from "../shared/schema";
import { insertClipSchema, insertTagSchema, insertBookmarkSchema, insertPromptSchema, insertUploadSchema } from "../shared/schema";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import OpenAI from "openai";

type Bindings = {
  DB: D1Database;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

function getDb(c: any) {
  return drizzle(c.env.DB, { schema });
}

function getOpenAI(c: any) {
  return new OpenAI({ apiKey: c.env.OPENAI_API_KEY });
}

function parseJsonField(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

function parseClip(clip: any) {
  return { ...clip, fields: parseJsonField(clip.fields), tags: parseJsonField(clip.tags) };
}

function parseBookmark(bookmark: any) {
  return { ...bookmark, bookmarkTags: parseJsonField(bookmark.bookmarkTags) };
}

const api = new Hono<{ Bindings: Bindings }>();

api.get("/clips", async (c) => {
  const db = getDb(c);
  const clips = await db.select().from(schema.clips).orderBy(desc(schema.clips.updatedAt));
  return c.json(clips.map(parseClip));
});

api.get("/clips/:id", async (c) => {
  const db = getDb(c);
  const [clip] = await db.select().from(schema.clips).where(eq(schema.clips.id, c.req.param("id")));
  if (!clip) return c.json({ message: "Not found" }, 404);
  return c.json(parseClip(clip));
});

api.post("/clips", async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const data = insertClipSchema.parse({
      ...body,
      fields: typeof body.fields === "string" ? body.fields : JSON.stringify(body.fields || []),
      tags: typeof body.tags === "string" ? body.tags : JSON.stringify(body.tags || []),
    });
    const values = data;
    const [created] = await db.insert(schema.clips).values(values).returning();
    return c.json(parseClip(created), 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.patch("/clips/:id", async (c) => {
  const db = getDb(c);
  const body = await c.req.json();
  const values: any = { ...body, updatedAt: new Date().toISOString() };
  if (body.fields !== undefined) values.fields = typeof body.fields === "string" ? body.fields : JSON.stringify(body.fields);
  if (body.tags !== undefined) values.tags = typeof body.tags === "string" ? body.tags : JSON.stringify(body.tags);
  const [updated] = await db.update(schema.clips).set(values).where(eq(schema.clips.id, c.req.param("id"))).returning();
  if (!updated) return c.json({ message: "Not found" }, 404);
  return c.json(parseClip(updated));
});

api.delete("/clips/:id", async (c) => {
  const db = getDb(c);
  await db.delete(schema.clips).where(eq(schema.clips.id, c.req.param("id")));
  return c.body(null, 204);
});

api.get("/tags", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.tags));
});

api.post("/tags", async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const data = insertTagSchema.parse(body);
    const [created] = await db.insert(schema.tags).values(data).returning();
    return c.json(created, 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.delete("/tags/:id", async (c) => {
  const db = getDb(c);
  await db.delete(schema.tags).where(eq(schema.tags.id, c.req.param("id")));
  return c.body(null, 204);
});

api.get("/bookmarks", async (c) => {
  const db = getDb(c);
  const bookmarks = await db.select().from(schema.bookmarks).orderBy(desc(schema.bookmarks.createdAt));
  return c.json(bookmarks.map(parseBookmark));
});

api.post("/bookmarks", async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const data = insertBookmarkSchema.parse({
      ...body,
      bookmarkTags: typeof body.bookmarkTags === "string" ? body.bookmarkTags : JSON.stringify(body.bookmarkTags || []),
    });
    const values = data;
    const [created] = await db.insert(schema.bookmarks).values(values).returning();
    return c.json(parseBookmark(created), 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.patch("/bookmarks/:id", async (c) => {
  const db = getDb(c);
  const body = await c.req.json();
  const values: any = { ...body };
  if (body.bookmarkTags !== undefined) values.bookmarkTags = typeof body.bookmarkTags === "string" ? body.bookmarkTags : JSON.stringify(body.bookmarkTags);
  const [updated] = await db.update(schema.bookmarks).set(values).where(eq(schema.bookmarks.id, c.req.param("id"))).returning();
  if (!updated) return c.json({ message: "Not found" }, 404);
  return c.json(parseBookmark(updated));
});

api.delete("/bookmarks/:id", async (c) => {
  const db = getDb(c);
  await db.delete(schema.bookmarks).where(eq(schema.bookmarks.id, c.req.param("id")));
  return c.body(null, 204);
});

api.post("/bookmarks/import", async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json<any[]>();
    const items = z.array(insertBookmarkSchema).parse(body.map((item) => ({
      ...item,
      bookmarkTags: typeof item.bookmarkTags === "string" ? item.bookmarkTags : JSON.stringify(item.bookmarkTags || []),
    })));
    const created = [];
    for (const item of items) {
      const values = { ...item, bookmarkTags: typeof item.bookmarkTags === "string" ? item.bookmarkTags : JSON.stringify(item.bookmarkTags || []) };
      const [bookmark] = await db.insert(schema.bookmarks).values(values).returning();
      created.push(parseBookmark(bookmark));
    }
    return c.json(created, 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.get("/prompts", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.prompts).orderBy(desc(schema.prompts.createdAt)));
});

api.post("/prompts", async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const data = insertPromptSchema.parse(body);
    const [created] = await db.insert(schema.prompts).values(data).returning();
    return c.json(created, 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.on(["PATCH", "PUT"], "/prompts/:id", async (c) => {
  const db = getDb(c);
  const body = await c.req.json();
  const [updated] = await db.update(schema.prompts).set(body).where(eq(schema.prompts.id, c.req.param("id"))).returning();
  if (!updated) return c.json({ message: "Not found" }, 404);
  return c.json(updated);
});

api.delete("/prompts/:id", async (c) => {
  const db = getDb(c);
  await db.delete(schema.prompts).where(eq(schema.prompts.id, c.req.param("id")));
  return c.body(null, 204);
});

api.get("/uploads", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.uploads).orderBy(desc(schema.uploads.createdAt)));
});

api.post("/uploads", async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const data = insertUploadSchema.parse(body);
    const [created] = await db.insert(schema.uploads).values(data).returning();
    return c.json(created, 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.delete("/uploads/:id", async (c) => {
  const db = getDb(c);
  await db.delete(schema.uploads).where(eq(schema.uploads.id, c.req.param("id")));
  return c.body(null, 204);
});

api.post("/chat", async (c) => {
  if (!c.env.OPENAI_API_KEY) return c.json({ message: "OPENAI_API_KEY is not configured" }, 503);
  const { messages = [], systemPrompt, attachments = [] } = await c.req.json();
  const context: any[] = [{
    role: "system",
    content: systemPrompt || "You are a helpful assistant that helps organize clipboard content and notes. Be concise and helpful.",
  }, ...messages];
  if (attachments.length) {
    context.push({
      role: "user",
      content: `Here are the attached files for context:\n\n${attachments.map((a: any) => `[Attached file: ${a.filename}]\n${a.content}`).join("\n\n")}`,
    });
  }
  return streamSSE(c, async (stream) => {
    try {
      const completion = await getOpenAI(c).chat.completions.create({ model: "gpt-4o-mini", messages: context, stream: true, max_tokens: 4096 });
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) await stream.writeSSE({ data: JSON.stringify({ content }) });
      }
    } catch (e: any) {
      await stream.writeSSE({ data: JSON.stringify({ error: e.message }) });
    }
    await stream.writeSSE({ data: "[DONE]" });
  });
});

const mcpTools = [
  { name: "search_clips", description: "Search through all clips and notes", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "create_clip", description: "Create a new clip or note", inputSchema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, category: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["title", "content"] } },
  { name: "get_clip", description: "Get a clip by ID", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "list_clips", description: "List clips, optionally by category", inputSchema: { type: "object", properties: { category: { type: "string" } } } },
  { name: "list_bookmarks", description: "List all bookmarks", inputSchema: { type: "object", properties: {} } },
  { name: "list_prompts", description: "List all prompt templates", inputSchema: { type: "object", properties: {} } },
];

api.get("/mcp/tools", (c) => c.json({ tools: mcpTools }));

api.post("/mcp/call", async (c) => {
  try {
    const db = getDb(c);
    const { tool, arguments: args = {} } = await c.req.json();
    if (tool === "create_clip") {
      const data = insertClipSchema.parse({ title: args.title, content: args.content || "", category: args.category || "notes", tags: JSON.stringify(args.tags || []) });
      const [clip] = await db.insert(schema.clips).values(data).returning();
      return c.json({ created: parseClip(clip) });
    }
    if (tool === "get_clip") {
      const [clip] = await db.select().from(schema.clips).where(eq(schema.clips.id, args.id));
      return c.json({ clip: clip ? parseClip(clip) : null });
    }
    if (tool === "list_bookmarks") return c.json({ bookmarks: (await db.select().from(schema.bookmarks)).map(parseBookmark) });
    if (tool === "list_prompts") return c.json({ prompts: await db.select().from(schema.prompts) });
    if (tool === "list_clips" || tool === "search_clips") {
      let clips = (await db.select().from(schema.clips)).map(parseClip).filter((clip) => !clip.deleted);
      if (tool === "list_clips" && args.category) clips = clips.filter((clip) => clip.category === args.category);
      if (tool === "search_clips") {
        const query = String(args.query || "").toLowerCase();
        clips = clips.filter((clip) => `${clip.title}\n${clip.content}\n${clip.tags.join(" ")}`.toLowerCase().includes(query));
        return c.json({ results: clips });
      }
      return c.json({ clips });
    }
    return c.json({ message: `Unknown tool: ${tool}` }, 400);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

// Stateless MCP Streamable HTTP endpoint for clients that support remote MCP.
api.post("/mcp", async (c) => {
  const request = await c.req.json<any>();
  const reply = (result: unknown) => c.json({ jsonrpc: "2.0", id: request.id ?? null, result });
  if (request.method === "initialize") {
    return reply({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "ClipSync", version: "1.0.0" } });
  }
  if (request.method === "notifications/initialized") return c.body(null, 202);
  if (request.method === "tools/list") return reply({ tools: mcpTools });
  if (request.method === "tools/call") {
    const forwarded = new Request(new URL("/api/mcp/call", c.req.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: request.params?.name, arguments: request.params?.arguments || {} }),
    });
    const response = await app.fetch(forwarded, c.env, c.executionCtx);
    const payload: any = await response.json();
    return reply({ content: [{ type: "text", text: JSON.stringify(payload) }], isError: !response.ok });
  }
  return c.json({ jsonrpc: "2.0", id: request.id ?? null, error: { code: -32601, message: "Method not found" } }, 404);
});

api.get("/health", (c) => c.json({ ok: true, runtime: "cloudflare-workers" }));

api.get("/export/all", async (c) => {
  const db = getDb(c);
  const [clips, tags, bookmarks, prompts, uploads] = await Promise.all([
    db.select().from(schema.clips),
    db.select().from(schema.tags),
    db.select().from(schema.bookmarks),
    db.select().from(schema.prompts),
    db.select().from(schema.uploads),
  ]);
  return c.json({ clips, tags, bookmarks, prompts, uploads, exportedAt: new Date().toISOString() });
});

api.get("/export/prompts", async (c) => {
  const db = getDb(c);
  return c.json({ prompts: await db.select().from(schema.prompts), exportedAt: new Date().toISOString() });
});

api.get("/export/clips", async (c) => {
  const db = getDb(c);
  return c.json({ clips: await db.select().from(schema.clips), exportedAt: new Date().toISOString() });
});

api.get("/export/bookmarks", async (c) => {
  const db = getDb(c);
  return c.json({ bookmarks: await db.select().from(schema.bookmarks), exportedAt: new Date().toISOString() });
});

api.post("/import", async (c) => {
  const db = getDb(c);
  const { clips, tags, bookmarks, prompts } = await c.req.json();
  const imported = { clips: 0, tags: 0, bookmarks: 0, prompts: 0 };

  if (Array.isArray(clips)) {
    for (const item of clips) {
      await db.insert(schema.clips).values({
        ...item,
        fields: typeof item.fields === "string" ? item.fields : JSON.stringify(item.fields || []),
        tags: typeof item.tags === "string" ? item.tags : JSON.stringify(item.tags || []),
      });
      imported.clips++;
    }
  }
  if (Array.isArray(tags)) {
    for (const item of tags) { await db.insert(schema.tags).values(item); imported.tags++; }
  }
  if (Array.isArray(bookmarks)) {
    for (const item of bookmarks) {
      await db.insert(schema.bookmarks).values({
        ...item,
        bookmarkTags: typeof item.bookmarkTags === "string" ? item.bookmarkTags : JSON.stringify(item.bookmarkTags || []),
      });
      imported.bookmarks++;
    }
  }
  if (Array.isArray(prompts)) {
    for (const item of prompts) { await db.insert(schema.prompts).values(item); imported.prompts++; }
  }

  return c.json({ imported });
});

app.route("/api", api);

app.onError((error, c) => {
  console.error(error);
  return c.json({ message: "Internal server error" }, 500);
});

export default app;
