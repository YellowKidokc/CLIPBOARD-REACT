import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClipSchema, insertTagSchema, insertBookmarkSchema, insertPromptSchema, insertUploadSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === CLIPS ===
  app.get("/api/clips", async (_req, res) => {
    const clips = await storage.getClips();
    res.json(clips);
  });

  app.get("/api/clips/:id", async (req, res) => {
    const clip = await storage.getClip(req.params.id);
    if (!clip) return res.status(404).json({ message: "Not found" });
    res.json(clip);
  });

  app.post("/api/clips", async (req, res) => {
    try {
      const data = insertClipSchema.parse(req.body);
      const clip = await storage.createClip(data);
      res.status(201).json(clip);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/clips/:id", async (req, res) => {
    const clip = await storage.updateClip(req.params.id, req.body);
    if (!clip) return res.status(404).json({ message: "Not found" });
    res.json(clip);
  });

  app.delete("/api/clips/:id", async (req, res) => {
    await storage.deleteClip(req.params.id);
    res.status(204).end();
  });

  // === TAGS ===
  app.get("/api/tags", async (_req, res) => {
    const allTags = await storage.getTags();
    res.json(allTags);
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const data = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(data);
      res.status(201).json(tag);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    await storage.deleteTag(req.params.id);
    res.status(204).end();
  });

  // === BOOKMARKS ===
  app.get("/api/bookmarks", async (_req, res) => {
    const all = await storage.getBookmarks();
    res.json(all);
  });

  app.post("/api/bookmarks", async (req, res) => {
    try {
      const data = insertBookmarkSchema.parse(req.body);
      const bookmark = await storage.createBookmark(data);
      res.status(201).json(bookmark);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/bookmarks/import", async (req, res) => {
    try {
      const items = z.array(insertBookmarkSchema).parse(req.body);
      const created = [];
      for (const item of items) {
        const bm = await storage.createBookmark(item);
        created.push(bm);
      }
      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/bookmarks/:id", async (req, res) => {
    const bookmark = await storage.updateBookmark(req.params.id, req.body);
    if (!bookmark) return res.status(404).json({ message: "Not found" });
    res.json(bookmark);
  });

  app.delete("/api/bookmarks/:id", async (req, res) => {
    await storage.deleteBookmark(req.params.id);
    res.status(204).end();
  });

  // === PROMPTS ===
  app.get("/api/prompts", async (_req, res) => {
    const all = await storage.getPrompts();
    res.json(all);
  });

  app.post("/api/prompts", async (req, res) => {
    try {
      const data = insertPromptSchema.parse(req.body);
      const prompt = await storage.createPrompt(data);
      res.status(201).json(prompt);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/prompts/:id", async (req, res) => {
    const prompt = await storage.updatePrompt(req.params.id, req.body);
    if (!prompt) return res.status(404).json({ message: "Not found" });
    res.json(prompt);
  });

  app.delete("/api/prompts/:id", async (req, res) => {
    await storage.deletePrompt(req.params.id);
    res.status(204).end();
  });

  // === UPLOADS ===
  app.get("/api/uploads", async (_req, res) => {
    const all = await storage.getUploads();
    res.json(all);
  });

  app.post("/api/uploads", async (req, res) => {
    try {
      const data = insertUploadSchema.parse(req.body);
      const upload = await storage.createUpload(data);
      res.status(201).json(upload);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/uploads/:id", async (req, res) => {
    await storage.deleteUpload(req.params.id);
    res.status(204).end();
  });

  return httpServer;
}
