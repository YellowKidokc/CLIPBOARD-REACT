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

  // === DEEP RESEARCH ===
  app.post("/api/research", async (req, res) => {
    try {
      const { query, urls, maxSources = 5, depth = "standard" } = req.body;
      if (!query) return res.status(400).json({ message: "Research query is required" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendEvent = (type: string, data: any) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      sendEvent("status", { message: "Starting research...", phase: "init" });

      let sourceUrls: string[] = urls || [];

      if (sourceUrls.length === 0) {
        sendEvent("status", { message: "Finding relevant sources...", phase: "search" });
        try {
          const searchResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a research assistant. Given a research topic, suggest 5-8 specific URLs that would be excellent sources for researching this topic. Return ONLY a JSON array of URL strings, no other text. Focus on authoritative, well-known sources like Wikipedia, official documentation, reputable news sites, and educational resources."
              },
              { role: "user", content: `Research topic: ${query}\n\nSuggest the best URLs to research this topic. Return only a JSON array of URLs.` }
            ],
            max_tokens: 1000,
          });

          const urlText = searchResponse.choices[0]?.message?.content || "[]";
          try {
            const parsed = JSON.parse(urlText.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
            sourceUrls = Array.isArray(parsed) ? parsed.slice(0, maxSources) : [];
          } catch {
            const urlMatches = urlText.match(/https?:\/\/[^\s"',\]]+/g);
            sourceUrls = urlMatches ? urlMatches.slice(0, maxSources) : [];
          }
        } catch (e: any) {
          sendEvent("error", { message: `URL discovery failed: ${e.message}` });
        }
      }

      if (sourceUrls.length === 0) {
        sendEvent("error", { message: "No sources found. Try providing specific URLs." });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      sendEvent("sources", { urls: sourceUrls, count: sourceUrls.length });

      const scrapedContent: { url: string; title: string; content: string; success: boolean }[] = [];

      for (let i = 0; i < sourceUrls.length; i++) {
        const url = sourceUrls[i];
        sendEvent("status", { message: `Scraping source ${i + 1}/${sourceUrls.length}: ${url}`, phase: "scrape", progress: Math.round(((i) / sourceUrls.length) * 50) });

        try {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(12000),
          });

          if (!response.ok) {
            scrapedContent.push({ url, title: "", content: "", success: false });
            sendEvent("scrape_result", { url, success: false, error: `HTTP ${response.status}` });
            continue;
          }

          const html = await response.text();
          const $ = cheerio.load(html);
          $("script, style, nav, footer, header, aside, iframe, noscript, .advertisement, .ads, .cookie-banner").remove();

          const title = $("title").text().trim() ||
            $('meta[property="og:title"]').attr("content") ||
            $("h1").first().text().trim() ||
            url;

          let content = "";
          const selectors = ["article", "main", '[role="main"]', ".content", ".post-content", ".entry-content", ".article-body", "#content"];
          for (const sel of selectors) {
            const el = $(sel);
            if (el.length && el.text().trim().length > 200) {
              content = el.text().trim();
              break;
            }
          }
          if (!content || content.length < 200) {
            content = $("body").text().trim();
          }

          content = content
            .replace(/\s+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .substring(0, 15000);

          scrapedContent.push({ url, title, content, success: true });
          sendEvent("scrape_result", { url, success: true, title, contentLength: content.length });
        } catch (e: any) {
          scrapedContent.push({ url, title: "", content: "", success: false });
          sendEvent("scrape_result", { url, success: false, error: e.message });
        }
      }

      const successfulSources = scrapedContent.filter(s => s.success && s.content.length > 100);

      if (successfulSources.length === 0) {
        sendEvent("error", { message: "Could not scrape any sources. The pages may be protected or unavailable." });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      sendEvent("status", { message: `Analyzing ${successfulSources.length} sources with AI...`, phase: "analyze", progress: 60 });

      const sourceContext = successfulSources.map((s, i) =>
        `=== SOURCE ${i + 1}: ${s.title} ===\nURL: ${s.url}\n\n${s.content.substring(0, 8000)}\n`
      ).join("\n\n");

      const depthInstructions = depth === "deep"
        ? "Provide an extremely thorough and detailed analysis. Include all relevant details, nuances, and edge cases. Structure with multiple sections and sub-sections."
        : depth === "quick"
        ? "Provide a concise but informative summary. Focus on the key takeaways and most important findings."
        : "Provide a comprehensive research summary. Balance thoroughness with readability. Use clear sections and highlight key findings.";

      const researchPrompt = `You are a Deep Research assistant. Analyze the following sources and create a comprehensive research report on the topic: "${query}"

${depthInstructions}

Structure your response with:
1. **Executive Summary** - Key findings in 2-3 sentences
2. **Detailed Analysis** - Main findings organized by theme
3. **Key Insights** - Notable patterns, connections, or conclusions
4. **Sources** - List the sources used with brief notes on each

${sourceContext}`;

      sendEvent("status", { message: "Generating research report...", phase: "synthesize", progress: 70 });

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional research analyst. Synthesize information from multiple sources into clear, well-structured research reports. Always cite which source information comes from. Be thorough but concise." },
          { role: "user", content: researchPrompt },
        ],
        stream: true,
        max_tokens: 8192,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          sendEvent("content", { content });
        }
      }

      sendEvent("status", { message: "Research complete!", phase: "done", progress: 100 });
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (e: any) {
      console.error("Research error:", e.message);
      if (!res.headersSent) {
        res.status(500).json({ message: e.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", message: e.message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }
  });

  // === WEB CRAWL (follows links from a starting URL) ===
  app.post("/api/crawl", async (req, res) => {
    try {
      const { url, maxPages = 5, query } = req.body;
      if (!url) return res.status(400).json({ message: "URL is required" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendEvent = (type: string, data: any) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      const visited = new Set<string>();
      const results: { url: string; title: string; content: string; links: { text: string; href: string }[] }[] = [];
      const queue: string[] = [url];

      const baseUrl = new URL(url);

      sendEvent("status", { message: `Starting crawl from ${url}`, total: maxPages });

      while (queue.length > 0 && visited.size < maxPages) {
        const currentUrl = queue.shift()!;
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        sendEvent("crawling", { url: currentUrl, visited: visited.size, total: maxPages });

        try {
          const response = await fetch(currentUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            sendEvent("page_error", { url: currentUrl, error: `HTTP ${response.status}` });
            continue;
          }

          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("text/html")) {
            sendEvent("page_error", { url: currentUrl, error: "Not HTML" });
            continue;
          }

          const html = await response.text();
          const $ = cheerio.load(html);
          $("script, style, nav, footer, header, aside, iframe, noscript").remove();

          const title = $("title").text().trim() || $("h1").first().text().trim() || currentUrl;

          let content = "";
          const selectors = ["article", "main", '[role="main"]', ".content", ".post-content", ".entry-content"];
          for (const sel of selectors) {
            const el = $(sel);
            if (el.length && el.text().trim().length > 200) {
              content = el.text().trim();
              break;
            }
          }
          if (!content || content.length < 100) {
            content = $("body").text().trim();
          }
          content = content.replace(/\s+/g, " ").trim().substring(0, 10000);

          const pageLinks: { text: string; href: string }[] = [];
          $("a[href]").each((_i: number, el: any) => {
            const href = $(el).attr("href");
            const text = $(el).text().trim();
            if (!href || !text) return;

            let absoluteUrl = "";
            try {
              absoluteUrl = new URL(href, currentUrl).toString();
            } catch { return; }

            if (absoluteUrl.startsWith("javascript:") || absoluteUrl.startsWith("mailto:") || absoluteUrl.includes("#")) return;

            const linkUrl = new URL(absoluteUrl);
            if (linkUrl.hostname === baseUrl.hostname && !visited.has(absoluteUrl)) {
              pageLinks.push({ text, href: absoluteUrl });
              if (!queue.includes(absoluteUrl)) {
                queue.push(absoluteUrl);
              }
            }
          });

          results.push({ url: currentUrl, title, content, links: pageLinks.slice(0, 20) });
          sendEvent("page_done", { url: currentUrl, title, contentLength: content.length, linksFound: pageLinks.length });
        } catch (e: any) {
          sendEvent("page_error", { url: currentUrl, error: e.message });
        }
      }

      if (query && results.length > 0) {
        sendEvent("status", { message: "Analyzing crawled pages with AI..." });

        const pagesContext = results.map((r, i) =>
          `=== PAGE ${i + 1}: ${r.title} ===\nURL: ${r.url}\n${r.content.substring(0, 5000)}`
        ).join("\n\n");

        const stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a web analysis assistant. Summarize and analyze crawled web pages based on the user's query. Be thorough and organized." },
            { role: "user", content: `Query: ${query}\n\nAnalyze these crawled pages:\n\n${pagesContext}` },
          ],
          stream: true,
          max_tokens: 4096,
        });

        for await (const chunk of stream) {
          const c = chunk.choices[0]?.delta?.content;
          if (c) sendEvent("analysis", { content: c });
        }
      }

      sendEvent("complete", {
        pagesVisited: visited.size,
        totalResults: results.length,
        pages: results.map(r => ({ url: r.url, title: r.title, contentLength: r.content.length })),
      });
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (e: any) {
      console.error("Crawl error:", e.message);
      if (!res.headersSent) {
        res.status(500).json({ message: e.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", message: e.message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
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
      id: p.id,
      name: p.name,
      template: p.template,
      category: p.category,
      shortcut: p.shortcut || "",
      color: p.color,
    }));
    res.json({
      version: "1.0",
      app: "ClipSync",
      prompts: promptsFormatted,
      snippets,
    });
  });

  app.get("/api/export/autohotkey/script", async (_req, res) => {
    const allPrompts = await storage.getPrompts();
    const promptsWithShortcuts = allPrompts.filter((p) => p.shortcut && p.shortcut.trim());

    let script = `; ClipSync AutoHotkey Integration\n`;
    script += `; AUTO-GENERATED - DO NOT EDIT MANUALLY\n`;
    script += `; Generated: ${new Date().toISOString()}\n`;
    script += `; Prompts with shortcuts: ${promptsWithShortcuts.length}\n\n`;
    script += `#SingleInstance Force\n`;
    script += `#NoEnv\n`;
    script += `SetWorkingDir %A_ScriptDir%\n\n`;
    script += `; === ClipSync API Config ===\n`;
    script += `ClipSyncURL := "REPLACE_WITH_YOUR_URL"\n\n`;
    script += `RunPrompt(id) {\n`;
    script += `    global ClipSyncURL\n`;
    script += `    Clipboard := ""\n`;
    script += `    Send ^c\n`;
    script += `    ClipWait, 2\n`;
    script += `    text := Clipboard\n`;
    script += `    url := ClipSyncURL . "/api/mcp/call"\n`;
    script += `    body := "{""tool"": ""create_clip"", ""arguments"": {""title"": ""AHK: " . id . """, ""content"": """ . text . """, ""category"": ""notes""}}"\n`;
    script += `    whr := ComObjCreate("WinHttp.WinHttpRequest.5.1")\n`;
    script += `    whr.Open("POST", url, false)\n`;
    script += `    whr.SetRequestHeader("Content-Type", "application/json")\n`;
    script += `    whr.Send(body)\n`;
    script += `}\n\n`;
    script += `; === Prompt Hotkeys ===\n`;

    for (const p of promptsWithShortcuts) {
      const ahkKey = p.shortcut!.replace("Ctrl+", "^").replace("Alt+", "!").replace("Shift+", "+").replace("Win+", "#");
      script += `\n; ${p.name} (${p.category})\n`;
      script += `${ahkKey}::\n`;
      script += `RunPrompt("${p.id}")\n`;
      script += `return\n`;
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", "attachment; filename=clipsync_prompts.ahk");
    res.send(script);
  });

  return httpServer;
}
