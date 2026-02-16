# ClipSync - Universal Clipboard Manager

## Overview
Cross-platform clipboard manager web application (PWA) with universal sync capabilities. Features clipboard history, notes, code snippets, AI assistance with streaming chat, structured data fields, bookmarks, prompt templates, file uploads, web scraping, and MCP server support.

## Architecture
- **Frontend**: React + Vite, TanStack Query, wouter router, shadcn/ui, Tailwind CSS, framer-motion
- **Backend**: Express.js, Drizzle ORM, PostgreSQL (Neon-backed), OpenAI API (streaming)
- **PWA**: Service worker, manifest.json, installable as desktop app
- **AI**: OpenAI GPT-4o-mini with streaming responses, system prompt presets, file attachments
- **Design**: Dark theme with cyan/purple accent, glassmorphism effects, prompt picker aesthetic

## Project Structure
```
client/src/pages/clipboard.tsx    - Main 3-panel UI (sidebar, list, editor)
client/src/components/settings-page.tsx - Full settings page overlay
shared/schema.ts                  - Drizzle schema (clips, tags, bookmarks, prompts, uploads)
server/storage.ts                 - Database storage interface
server/routes.ts                  - REST API routes + AI chat + scrape + MCP
server/db.ts                      - Database connection
client/public/manifest.json       - PWA manifest
client/public/sw.js               - Service worker
scripts/clipboard_sync.py         - Desktop clipboard sync script (Python)
```

## Data Models
- **Clips**: Notes, clipboard items, snippets, prompts with tags, structured fields
- **Tags**: Custom tags with colors
- **Bookmarks**: URLs with categories, domain, description
- **Prompts**: Templates with name, category, color
- **Uploads**: Text file uploads with content

## API Routes
- `/api/clips` - CRUD for clips
- `/api/tags` - CRUD for tags
- `/api/bookmarks` - CRUD + import for bookmarks
- `/api/prompts` - CRUD for prompts
- `/api/uploads` - CRUD for uploads
- `/api/export/all` - Export all data as JSON
- `/api/export/prompts` - Export prompts only
- `/api/export/autohotkey` - Export in AutoHotkey-compatible format
- `/api/export/bookmarks` - Export bookmarks
- `/api/import` - Import data from JSON
- `/api/chat` - AI chat with streaming responses (POST, SSE)
- `/api/scrape` - Web page content extraction (POST)
- `/api/research` - Deep Research: multi-source scrape + AI synthesis (POST, SSE)
- `/api/crawl` - Web crawling: follows internal links, extracts content, optional AI analysis (POST, SSE)
- `/api/mcp/tools` - MCP server: list available tools (GET)
- `/api/mcp/call` - MCP server: execute tool (POST)

## AI Features
- Streaming chat with OpenAI GPT-4o-mini
- System prompt presets: General, Researcher, Coder, Writer, Axiom Extractor, Strategist, Teacher, Data Analyst, Creative Director, Devil's Advocate, Custom
- 8 quick-action workflows: /summarize, /axioms, /improve, /tags, /code, /rate, /ideas, /email
- File attachment support (text files, current note, clipboard paste)
- Web scraping: fetch and attach web page content to chat context
- **Deep Research**: multi-URL scraping + AI synthesis with streaming progress (Chat/Research tab toggle)
  - Auto-discovers relevant URLs or accepts custom URL list
  - Three depth levels: Quick, Standard, Deep
  - Real-time progress tracking with source status indicators
  - Save research reports directly to notes
- Save AI responses back as clips
- Copy AI responses to clipboard

## MCP Server
- External AI tools (Claude, ChatGPT, etc.) can read/write clips via MCP endpoints
- Tools: list_clips, get_clip, create_clip, search_clips, list_tags

## Desktop Integration
- Python script (`scripts/clipboard_sync.py`) for desktop clipboard sync
- AutoHotkey JSON export/import for hotkey integration
- PWA installable as desktop/mobile app

## Recent Changes (Feb 2026)
- Converted from frontend mockup to full-stack app with PostgreSQL
- Added PWA support (manifest, service worker, installable)
- Added JSON export/import for AutoHotkey interop
- UI polish: glassmorphism, gradient borders, prompt card hover effects, refined color palette
- Added bookmarks manager with categories and import
- Added file upload with drag-and-drop
- Added custom tag management with color picker
- Integrated OpenAI API for real AI chat with streaming responses
- Added /api/chat endpoint with streaming, system prompts, and file attachment support
- Added /api/scrape endpoint for web page content extraction using cheerio
- Added MCP server endpoints for external AI tool integration
- Created Python desktop clipboard sync script
- Enhanced AI UI: file upload button, web scraping popover, system prompt presets dropdown
- Added 8 quick-action workflow buttons in AI chat
- Added "Save to Clip" and copy buttons on AI responses
- Added Quick Paste button in sidebar for mobile clipboard capture
- Added Tools section in sidebar: Deep Research, Web Crawling, Web Scraping, MCP Server
- Added /api/crawl endpoint for web crawling with link following and AI analysis
- Added prompt template editor with shortcut (AHK hotkey) field, category, color
- Added /api/export/autohotkey/script endpoint for auto-generated AHK script with hotkey mappings
- Enhanced save-to-notes with tag selection dialog (research, crawl, scrape, AI results)
- Expanded system prompts to 11 presets (added Strategist, Teacher, Data Analyst, Creative Director, Devil's Advocate)

## User Preferences
- Dark theme, "Nintendo/Clipto-style" aesthetic
- Deploy target: Cloudflare with R2 storage (future)
- AutoHotkey integration via JSON export + AHK script generation
- PWA as source of truth for prompts, AHK as runtime executor
- PWA for desktop app experience
