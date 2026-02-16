# ClipSync - Universal Clipboard Manager

## Overview
Cross-platform clipboard manager web application (PWA) with universal sync capabilities. Features clipboard history, notes, code snippets, AI assistance, structured data fields, bookmarks, prompt templates, and file uploads.

## Architecture
- **Frontend**: React + Vite, TanStack Query, wouter router, shadcn/ui, Tailwind CSS, framer-motion
- **Backend**: Express.js, Drizzle ORM, PostgreSQL (Neon-backed)
- **PWA**: Service worker, manifest.json, installable as desktop app
- **Design**: Dark theme with cyan/purple accent, glassmorphism effects, prompt picker aesthetic

## Project Structure
```
client/src/pages/clipboard.tsx    - Main 3-panel UI (sidebar, list, editor)
client/src/components/settings-page.tsx - Full settings page overlay
shared/schema.ts                  - Drizzle schema (clips, tags, bookmarks, prompts, uploads)
server/storage.ts                 - Database storage interface
server/routes.ts                  - REST API routes
server/db.ts                      - Database connection
client/public/manifest.json       - PWA manifest
client/public/sw.js               - Service worker
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

## Recent Changes (Feb 2026)
- Converted from frontend mockup to full-stack app with PostgreSQL
- Added PWA support (manifest, service worker, installable)
- Added JSON export/import for AutoHotkey interop
- UI polish: glassmorphism, gradient borders, prompt card hover effects, refined color palette
- Added bookmarks manager with categories and import
- Added file upload with drag-and-drop
- Added custom tag management with color picker

## User Preferences
- Dark theme, "Nintendo/Clipto-style" aesthetic
- Deploy target: Cloudflare with R2 storage (future)
- AutoHotkey integration via JSON export
- PWA for desktop app experience
