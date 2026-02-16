import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClipSchema, insertTagSchema, insertBookmarkSchema, insertPromptSchema, insertUploadSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import * as cheerio from "cheerio";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  // === AI CHAT (Streaming) ===
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, systemPrompt, attachments } = req.body;

      const systemMessage = {
        role: "system" as const,
        content: systemPrompt || "You are a helpful assistant that helps organize and manage clipboard content and notes. Be concise and helpful."
      };

      let contextMessages = [systemMessage, ...messages];

      if (attachments && attachments.length > 0) {
        const attachmentContext = attachments.map((a: any) =>
          `[Attached file: ${a.filename}]\n${a.content}`
        ).join("\n\n");
        contextMessages.push({
          role: "user" as const,
          content: `Here are the attached files for context:\n\n${attachmentContext}`
        });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: contextMessages,
        stream: true,
        max_tokens: 4096,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (e: any) {
      console.error("Chat error:", e.message);
      if (!res.headersSent) {
        res.status(500).json({ message: e.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
      }
    }
  });

  // === WEB SCRAPE ===
  app.post("/api/scrape", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ message: "URL is required" });

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return res.status(400).json({ message: `Failed to fetch: ${response.status} ${response.statusText}` });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      $("script, style, nav, footer, header, aside, iframe, noscript").remove();

      const title = $("title").text().trim() ||
        $('meta[property="og:title"]').attr("content") ||
        $("h1").first().text().trim() ||
        "Untitled";

      const description = $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") || "";

      let mainContent = "";
      const selectors = ["article", "main", '[role="main"]', ".content", ".post", ".entry"];
      for (const sel of selectors) {
        const el = $(sel);
        if (el.length) {
          mainContent = el.text().trim();
          break;
        }
      }
      if (!mainContent) {
        mainContent = $("body").text().trim();
      }

      mainContent = mainContent
        .replace(/\s+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .substring(0, 50000);

      const links = $("a[href]")
        .map((_i: number, el: any) => ({
          text: $(el).text().trim(),
          href: $(el).attr("href"),
        }))
        .get()
        .filter((l: any) => l.text && l.href && l.href.startsWith("http"))
        .slice(0, 50);

      res.json({
        title,
        description,
        content: mainContent,
        url,
        links,
        contentLength: mainContent.length,
      });
    } catch (e: any) {
      console.error("Scrape error:", e.message);
      res.status(500).json({ message: e.message });
    }
  });

  // === MCP SERVER ENDPOINTS ===
  app.get("/api/mcp/tools", async (_req, res) => {
    res.json({
      tools: [
        {
          name: "search_clips",
          description: "Search through all clips and notes",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string", description: "Search query" } },
            required: ["query"],
          },
        },
        {
          name: "create_clip",
          description: "Create a new clip/note",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
              category: { type: "string", enum: ["notes", "clipboard", "snippets", "prompts"] },
              tags: { type: "array", items: { type: "string" } },
            },
            required: ["title", "content"],
          },
        },
        {
          name: "get_clip",
          description: "Get a specific clip by ID",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
          },
        },
        {
          name: "list_clips",
          description: "List all clips, optionally filtered by category",
          inputSchema: {
            type: "object",
            properties: { category: { type: "string" } },
          },
        },
        {
          name: "list_bookmarks",
          description: "List all bookmarks",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "list_prompts",
          description: "List all prompt templates",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    });
  });

  app.post("/api/mcp/call", async (req, res) => {
    try {
      const { tool, arguments: args } = req.body;

      switch (tool) {
        case "search_clips": {
          const allClips = await storage.getClips();
          const query = (args.query || "").toLowerCase();
          const results = allClips.filter(c =>
            !c.deleted &&
            (c.title.toLowerCase().includes(query) ||
              c.content.toLowerCase().includes(query) ||
              (c.tags || []).some(t => t.toLowerCase().includes(query)))
          );
          return res.json({ results });
        }
        case "create_clip": {
          const clip = await storage.createClip({
            title: args.title,
            content: args.content || "",
            category: args.category || "notes",
            tags: args.tags || [],
          });
          return res.json({ created: clip });
        }
        case "get_clip": {
          const clip = await storage.getClip(args.id);
          return res.json({ clip: clip || null });
        }
        case "list_clips": {
          const allClips = await storage.getClips();
          const filtered = args.category
            ? allClips.filter(c => c.category === args.category && !c.deleted)
            : allClips.filter(c => !c.deleted);
          return res.json({ clips: filtered });
        }
        case "list_bookmarks": {
          const bms = await storage.getBookmarks();
          return res.json({ bookmarks: bms });
        }
        case "list_prompts": {
          const ps = await storage.getPrompts();
          return res.json({ prompts: ps });
        }
        default:
          return res.status(400).json({ message: `Unknown tool: ${tool}` });
      }
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // === EXPORT/IMPORT FOR AUTOHOTKEY ===
  app.get("/api/export/all", async (_req, res) => {
    const [clips, allTags, bookmarks, prompts, uploads] = await Promise.all([
      storage.getClips(),
      storage.getTags(),
      storage.getBookmarks(),
      storage.getPrompts(),
      storage.getUploads(),
    ]);
    res.json({ clips, tags: allTags, bookmarks, prompts, uploads, exportedAt: new Date().toISOString() });
  });

  app.get("/api/export/prompts", async (_req, res) => {
    const prompts = await storage.getPrompts();
    res.json({ prompts, exportedAt: new Date().toISOString() });
  });

  app.get("/api/export/clips", async (_req, res) => {
    const clips = await storage.getClips();
    res.json({ clips, exportedAt: new Date().toISOString() });
  });

  app.get("/api/export/bookmarks", async (_req, res) => {
    const bookmarks = await storage.getBookmarks();
    res.json({ bookmarks, exportedAt: new Date().toISOString() });
  });

  app.post("/api/import", async (req, res) => {
    try {
      const { clips, tags, bookmarks, prompts } = req.body;
      const imported = { clips: 0, tags: 0, bookmarks: 0, prompts: 0 };

      if (Array.isArray(clips)) {
        for (const item of clips) {
          await storage.createClip(item);
          imported.clips++;
        }
      }
      if (Array.isArray(tags)) {
        for (const item of tags) {
          await storage.createTag(item);
          imported.tags++;
        }
      }
      if (Array.isArray(bookmarks)) {
        for (const item of bookmarks) {
          await storage.createBookmark(item);
          imported.bookmarks++;
        }
      }
      if (Array.isArray(prompts)) {
        for (const item of prompts) {
          await storage.createPrompt(item);
          imported.prompts++;
        }
      }

      res.json({ imported });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/export/autohotkey", async (_req, res) => {
    const [allPrompts, allClips] = await Promise.all([
      storage.getPrompts(),
      storage.getClips(),
    ]);
    const snippets = allClips
      .filter((c) => c.category === "snippets")
      .map((c) => ({ title: c.title, content: c.content, tags: c.tags }));
    const promptsFormatted = allPrompts.map((p) => ({
      name: p.name,
      template: p.template,
      category: p.category,
    }));
    res.json({
      version: "1.0",
      app: "ClipSync",
      prompts: promptsFormatted,
      snippets,
    });
  });

  return httpServer;
}
