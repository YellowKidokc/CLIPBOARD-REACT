import { Hono } from "hono";
import { storage } from "./storage";
import { insertClipSchema, insertTagSchema, insertBookmarkSchema, insertPromptSchema, insertUploadSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import * as cheerio from "cheerio";
import { streamSSE } from "hono/streaming";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const api = new Hono();

function parseJsonField(val: any, fallback: any = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}

function parseClip(clip: any) {
  return { ...clip, tags: parseJsonField(clip.tags, []), fields: parseJsonField(clip.fields, []) };
}

function parseBookmark(bm: any) {
  return { ...bm, bookmarkTags: parseJsonField(bm.bookmarkTags, []) };
}

api.get("/clips", async (c) => {
  const clips = await storage.getClips();
  return c.json(clips.map(parseClip));
});

api.get("/clips/:id", async (c) => {
  const clip = await storage.getClip(c.req.param("id"));
  if (!clip) return c.json({ message: "Not found" }, 404);
  return c.json(parseClip(clip));
});

api.post("/clips", async (c) => {
  try {
    const body = await c.req.json();
    const data = insertClipSchema.parse(body);
    const clip = await storage.createClip(data);
    return c.json(parseClip(clip), 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.patch("/clips/:id", async (c) => {
  const body = await c.req.json();
  const clip = await storage.updateClip(c.req.param("id"), body);
  if (!clip) return c.json({ message: "Not found" }, 404);
  return c.json(parseClip(clip));
});

api.delete("/clips/:id", async (c) => {
  await storage.deleteClip(c.req.param("id"));
  return c.body(null, 204);
});

api.get("/tags", async (c) => {
  const allTags = await storage.getTags();
  return c.json(allTags);
});

api.post("/tags", async (c) => {
  try {
    const body = await c.req.json();
    const data = insertTagSchema.parse(body);
    const tag = await storage.createTag(data);
    return c.json(tag, 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.delete("/tags/:id", async (c) => {
  await storage.deleteTag(c.req.param("id"));
  return c.body(null, 204);
});

api.get("/bookmarks", async (c) => {
  const all = await storage.getBookmarks();
  return c.json(all.map(parseBookmark));
});

api.post("/bookmarks", async (c) => {
  try {
    const body = await c.req.json();
    const data = insertBookmarkSchema.parse(body);
    const bookmark = await storage.createBookmark(data);
    return c.json(parseBookmark(bookmark), 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.post("/bookmarks/import", async (c) => {
  try {
    const body = await c.req.json();
    const items = z.array(insertBookmarkSchema).parse(body);
    const created = [];
    for (const item of items) {
      const bm = await storage.createBookmark(item);
      created.push(parseBookmark(bm));
    }
    return c.json(created, 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.patch("/bookmarks/:id", async (c) => {
  const body = await c.req.json();
  const bookmark = await storage.updateBookmark(c.req.param("id"), body);
  if (!bookmark) return c.json({ message: "Not found" }, 404);
  return c.json(parseBookmark(bookmark));
});

api.delete("/bookmarks/:id", async (c) => {
  await storage.deleteBookmark(c.req.param("id"));
  return c.body(null, 204);
});

api.get("/prompts", async (c) => {
  const all = await storage.getPrompts();
  return c.json(all);
});

api.post("/prompts", async (c) => {
  try {
    const body = await c.req.json();
    const data = insertPromptSchema.parse(body);
    const prompt = await storage.createPrompt(data);
    return c.json(prompt, 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.patch("/prompts/:id", async (c) => {
  const body = await c.req.json();
  const prompt = await storage.updatePrompt(c.req.param("id"), body);
  if (!prompt) return c.json({ message: "Not found" }, 404);
  return c.json(prompt);
});

api.delete("/prompts/:id", async (c) => {
  await storage.deletePrompt(c.req.param("id"));
  return c.body(null, 204);
});

api.get("/uploads", async (c) => {
  const all = await storage.getUploads();
  return c.json(all);
});

api.post("/uploads", async (c) => {
  try {
    const body = await c.req.json();
    const data = insertUploadSchema.parse(body);
    const upload = await storage.createUpload(data);
    return c.json(upload, 201);
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.delete("/uploads/:id", async (c) => {
  await storage.deleteUpload(c.req.param("id"));
  return c.body(null, 204);
});

api.post("/chat", async (c) => {
  const { messages, systemPrompt, attachments } = await c.req.json();

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

  return streamSSE(c, async (stream) => {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: contextMessages,
        stream: true,
        max_tokens: 4096,
      });

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          await stream.writeSSE({ data: JSON.stringify({ content }) });
        }
      }

      await stream.writeSSE({ data: "[DONE]" });
    } catch (e: any) {
      console.error("Chat error:", e.message);
      await stream.writeSSE({ data: JSON.stringify({ error: e.message }) });
    }
  });
});

api.post("/scrape", async (c) => {
  try {
    const { url } = await c.req.json();
    if (!url) return c.json({ message: "URL is required" }, 400);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return c.json({ message: `Failed to fetch: ${response.status} ${response.statusText}` }, 400);
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

    return c.json({ title, description, content: mainContent, url, links, contentLength: mainContent.length });
  } catch (e: any) {
    console.error("Scrape error:", e.message);
    return c.json({ message: e.message }, 500);
  }
});

api.post("/research", async (c) => {
  const { query, urls, maxSources = 5, depth = "standard" } = await c.req.json();
  if (!query) return c.json({ message: "Research query is required" }, 400);

  return streamSSE(c, async (stream) => {
    const sendEvent = async (type: string, data: any) => {
      await stream.writeSSE({ data: JSON.stringify({ type, ...data }) });
    };

    try {
      await sendEvent("status", { message: "Starting research...", phase: "init" });

      let sourceUrls: string[] = urls || [];

      if (sourceUrls.length === 0) {
        await sendEvent("status", { message: "Finding relevant sources...", phase: "search" });
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
          await sendEvent("error", { message: `URL discovery failed: ${e.message}` });
        }
      }

      if (sourceUrls.length === 0) {
        await sendEvent("error", { message: "No sources found. Try providing specific URLs." });
        await stream.writeSSE({ data: "[DONE]" });
        return;
      }

      await sendEvent("sources", { urls: sourceUrls, count: sourceUrls.length });

      const scrapedContent: { url: string; title: string; content: string; success: boolean }[] = [];

      for (let i = 0; i < sourceUrls.length; i++) {
        const url = sourceUrls[i];
        await sendEvent("status", { message: `Scraping source ${i + 1}/${sourceUrls.length}: ${url}`, phase: "scrape", progress: Math.round(((i) / sourceUrls.length) * 50) });

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
            await sendEvent("scrape_result", { url, success: false, error: `HTTP ${response.status}` });
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
          await sendEvent("scrape_result", { url, success: true, title, contentLength: content.length });
        } catch (e: any) {
          scrapedContent.push({ url, title: "", content: "", success: false });
          await sendEvent("scrape_result", { url, success: false, error: e.message });
        }
      }

      const successfulSources = scrapedContent.filter(s => s.success && s.content.length > 100);

      if (successfulSources.length === 0) {
        await sendEvent("error", { message: "Could not scrape any sources. The pages may be protected or unavailable." });
        await stream.writeSSE({ data: "[DONE]" });
        return;
      }

      await sendEvent("status", { message: `Analyzing ${successfulSources.length} sources with AI...`, phase: "analyze", progress: 60 });

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

      await sendEvent("status", { message: "Generating research report...", phase: "synthesize", progress: 70 });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional research analyst. Synthesize information from multiple sources into clear, well-structured research reports. Always cite which source information comes from. Be thorough but concise." },
          { role: "user", content: researchPrompt },
        ],
        stream: true,
        max_tokens: 8192,
      });

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          await sendEvent("content", { content });
        }
      }

      await sendEvent("status", { message: "Research complete!", phase: "done", progress: 100 });
      await stream.writeSSE({ data: "[DONE]" });
    } catch (e: any) {
      console.error("Research error:", e.message);
      await stream.writeSSE({ data: JSON.stringify({ type: "error", message: e.message }) });
      await stream.writeSSE({ data: "[DONE]" });
    }
  });
});

api.post("/crawl", async (c) => {
  const { url, maxPages = 5, query } = await c.req.json();
  if (!url) return c.json({ message: "URL is required" }, 400);

  return streamSSE(c, async (stream) => {
    const sendEvent = async (type: string, data: any) => {
      await stream.writeSSE({ data: JSON.stringify({ type, ...data }) });
    };

    try {
      const visited = new Set<string>();
      const results: { url: string; title: string; content: string; links: { text: string; href: string }[] }[] = [];
      const queue: string[] = [url];
      const baseUrl = new URL(url);

      await sendEvent("status", { message: `Starting crawl from ${url}`, total: maxPages });

      while (queue.length > 0 && visited.size < maxPages) {
        const currentUrl = queue.shift()!;
        if (visited.has(currentUrl)) continue;
        visited.add(currentUrl);

        await sendEvent("crawling", { url: currentUrl, visited: visited.size, total: maxPages });

        try {
          const response = await fetch(currentUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            await sendEvent("page_error", { url: currentUrl, error: `HTTP ${response.status}` });
            continue;
          }

          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("text/html")) {
            await sendEvent("page_error", { url: currentUrl, error: "Not HTML" });
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
          await sendEvent("page_done", { url: currentUrl, title, contentLength: content.length, linksFound: pageLinks.length });
        } catch (e: any) {
          await sendEvent("page_error", { url: currentUrl, error: e.message });
        }
      }

      if (query && results.length > 0) {
        await sendEvent("status", { message: "Analyzing crawled pages with AI..." });

        const pagesContext = results.map((r, i) =>
          `=== PAGE ${i + 1}: ${r.title} ===\nURL: ${r.url}\n${r.content.substring(0, 5000)}`
        ).join("\n\n");

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a web analysis assistant. Summarize and analyze crawled web pages based on the user's query. Be thorough and organized." },
            { role: "user", content: `Query: ${query}\n\nAnalyze these crawled pages:\n\n${pagesContext}` },
          ],
          stream: true,
          max_tokens: 4096,
        });

        for await (const chunk of completion) {
          const cc = chunk.choices[0]?.delta?.content;
          if (cc) await sendEvent("analysis", { content: cc });
        }
      }

      await sendEvent("complete", {
        pagesVisited: visited.size,
        totalResults: results.length,
        pages: results.map(r => ({ url: r.url, title: r.title, contentLength: r.content.length })),
      });
      await stream.writeSSE({ data: "[DONE]" });
    } catch (e: any) {
      console.error("Crawl error:", e.message);
      await stream.writeSSE({ data: JSON.stringify({ type: "error", message: e.message }) });
      await stream.writeSSE({ data: "[DONE]" });
    }
  });
});

api.get("/mcp/tools", async (c) => {
  return c.json({
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

api.post("/mcp/call", async (c) => {
  try {
    const { tool, arguments: args } = await c.req.json();

    switch (tool) {
      case "search_clips": {
        const allClips = await storage.getClips();
        const query = (args.query || "").toLowerCase();
        const results = allClips.filter(clip => {
          if (clip.deleted) return false;
          const clipTags = typeof clip.tags === "string" ? JSON.parse(clip.tags) : clip.tags;
          return clip.title.toLowerCase().includes(query) ||
            clip.content.toLowerCase().includes(query) ||
            (clipTags || []).some((t: string) => t.toLowerCase().includes(query));
        });
        return c.json({ results: results.map(parseClip) });
      }
      case "create_clip": {
        const clip = await storage.createClip({
          title: args.title,
          content: args.content || "",
          category: args.category || "notes",
          tags: JSON.stringify(args.tags || []),
        });
        return c.json({ created: parseClip(clip) });
      }
      case "get_clip": {
        const clip = await storage.getClip(args.id);
        return c.json({ clip: clip ? parseClip(clip) : null });
      }
      case "list_clips": {
        const allClips = await storage.getClips();
        const filtered = args.category
          ? allClips.filter(clip => clip.category === args.category && !clip.deleted)
          : allClips.filter(clip => !clip.deleted);
        return c.json({ clips: filtered.map(parseClip) });
      }
      case "list_bookmarks": {
        const bms = await storage.getBookmarks();
        return c.json({ bookmarks: bms.map(parseBookmark) });
      }
      case "list_prompts": {
        const ps = await storage.getPrompts();
        return c.json({ prompts: ps });
      }
      default:
        return c.json({ message: `Unknown tool: ${tool}` }, 400);
    }
  } catch (e: any) {
    return c.json({ message: e.message }, 500);
  }
});

api.get("/export/all", async (c) => {
  const [allClips, allTags, allBookmarks, allPrompts, allUploads] = await Promise.all([
    storage.getClips(),
    storage.getTags(),
    storage.getBookmarks(),
    storage.getPrompts(),
    storage.getUploads(),
  ]);
  return c.json({ clips: allClips.map(parseClip), tags: allTags, bookmarks: allBookmarks.map(parseBookmark), prompts: allPrompts, uploads: allUploads, exportedAt: new Date().toISOString() });
});

api.get("/export/prompts", async (c) => {
  const allPrompts = await storage.getPrompts();
  return c.json({ prompts: allPrompts, exportedAt: new Date().toISOString() });
});

api.get("/export/clips", async (c) => {
  const allClips = await storage.getClips();
  return c.json({ clips: allClips.map(parseClip), exportedAt: new Date().toISOString() });
});

api.get("/export/bookmarks", async (c) => {
  const allBookmarks = await storage.getBookmarks();
  return c.json({ bookmarks: allBookmarks.map(parseBookmark), exportedAt: new Date().toISOString() });
});

api.post("/import", async (c) => {
  try {
    const { clips, tags, bookmarks, prompts } = await c.req.json();
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

    return c.json({ imported });
  } catch (e: any) {
    return c.json({ message: e.message }, 400);
  }
});

api.get("/export/autohotkey", async (c) => {
  const [allPrompts, allClips] = await Promise.all([
    storage.getPrompts(),
    storage.getClips(),
  ]);
  const snippets = allClips
    .filter((clip) => clip.category === "snippets")
    .map((clip) => {
      const clipTags = typeof clip.tags === "string" ? JSON.parse(clip.tags) : clip.tags;
      return { title: clip.title, content: clip.content, tags: clipTags };
    });
  const promptsFormatted = allPrompts.map((p) => ({
    id: p.id,
    name: p.name,
    template: p.template,
    category: p.category,
    shortcut: p.shortcut || "",
    color: p.color,
  }));
  return c.json({
    version: "1.0",
    app: "ClipSync",
    prompts: promptsFormatted,
    snippets,
  });
});

api.get("/export/autohotkey/script", async (c) => {
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

  c.header("Content-Type", "text/plain");
  c.header("Content-Disposition", "attachment; filename=clipsync_prompts.ahk");
  return c.text(script);
});

export { api };
