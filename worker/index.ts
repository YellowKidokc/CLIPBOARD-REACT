import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import * as schema from "../shared/schema";
import { insertClipSchema, insertTagSchema, insertBookmarkSchema, insertPromptSchema, insertUploadSchema } from "../shared/schema";
import { z } from "zod";
import { streamSSE } from "hono/streaming";

type Bindings = {
  DB: D1Database;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

function getDb(c: any) {
  return drizzle(c.env.DB, { schema });
}

function getOpenAI(c: any) {
  const OpenAI = require("openai").default;
  return new OpenAI({ apiKey: c.env.OPENAI_API_KEY });
}

const api = new Hono<{ Bindings: Bindings }>();

api.get("/clips", async (c) => {
  const db = getDb(c);
  const clips = await db.select().from(schema.clips).orderBy(desc(schema.clips.updatedAt));
  return c.json(clips);
});

api.get("/clips/:id", async (c) => {
  const db = getDb(c);
  const [clip] = await db.select().from(schema.clips).where(eq(schema.clips.id, c.req.param("id")));
  if (!clip) return c.json({ message: "Not found" }, 404);
  return c.json(clip);
});

api.post("/clips", async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const data = insertClipSchema.parse(body);
    const values = {
      ...data,
      fields: typeof data.fields === "string" ? data.fields : JSON.stringify(data.fields || []),
      tags: typeof data.tags === "string" ? data.tags : JSON.stringify(data.tags || []),
    };
    const [created] = await db.insert(schema.clips).values(values).returning();
    return c.json(created, 201);
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
  return c.json(updated);
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
  return c.json(await db.select().from(schema.bookmarks).orderBy(desc(schema.bookmarks.createdAt)));
});

api.post("/bookmarks", async (c) => {
  try {
    const db = getDb(c);
    const body = await c.req.json();
    const data = insertBookmarkSchema.parse(body);
    const values = { ...data, bookmarkTags: typeof data.bookmarkTags === "string" ? data.bookmarkTags : JSON.stringify(data.bookmarkTags || []) };
    const [created] = await db.insert(schema.bookmarks).values(values).returning();
    return c.json(created, 201);
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
  return c.json(updated);
});

api.delete("/bookmarks/:id", async (c) => {
  const db = getDb(c);
  await db.delete(schema.bookmarks).where(eq(schema.bookmarks.id, c.req.param("id")));
  return c.body(null, 204);
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

api.patch("/prompts/:id", async (c) => {
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

export default app;
