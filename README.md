# ClipSync

Clipboard manager: history, pinned and starred clips, prompts, bookmarks, AI chat. It installs
as an app on any device (it's a PWA). The data lives on your Synology.

## Synology + Cloudflare (recommended)

```text
 phone / laptop / PC ──https──> clip.<your-domain> (Cloudflare Access login)
                                      │  Cloudflare Tunnel (no open router ports)
                                      ▼
                     Synology: clipsync container ── ./data/clipsync.db (SQLite)
 Windows capture script ──LAN──> http://NAS-IP:5000
```

### 1. Run it on the Synology

1. DSM: install **Container Manager**. Create the folder `/volume1/docker/clipsync` and copy this repo into it.
2. Copy `.env.example` to `.env`. Set `CLIPSYNC_API_KEY` to a long random value, and set
   `CLIPSYNC_UID` / `CLIPSYNC_GID` to the DSM user that owns the folder (`id` over SSH; the first
   admin is usually `1024` / `100`).
3. Container Manager → **Project → Create** → path `/volume1/docker/clipsync` → it finds `compose.yaml` → build.
4. Open `http://NAS-IP:5000`. The browser asks for the API key once and remembers it.

Everything durable is in `./data` (back up the whole folder, including any `-wal` / `-shm` files).

### 2. Put it on your Cloudflare domain

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** (Cloudflared).
   Copy the token into `.env` as `CLOUDFLARE_TUNNEL_TOKEN` (keep `COMPOSE_PROFILES=tunnel`) and
   rebuild the project. The `tunnel` container connects out; nothing on the router changes.
2. In the tunnel, add a **public hostname**: e.g. `clip.<your-domain>` → service `http://clipsync:5000`.
3. **Zero Trust → Access → Applications → Add → Self-hosted** for the same hostname, with a policy
   that allows only your email. Without this the app is public (the API key still guards the data).
4. On each device, open `https://clip.<your-domain>` and choose **Install app** / **Add to Home Screen**.

### 3. Bring over the old history (one time)

The previous version stored ~9,300 items in the D1 database `clipsync-db`. Create a Cloudflare API
token with **Account → D1 → Read**, put `CF_ACCOUNT_ID`, `CF_API_TOKEN` and `D1_DATABASE_ID` in
`.env`, rebuild, then in Container Manager open the `clipsync` container's terminal and run:

```bash
node dist/import-legacy.cjs --d1
```

Clips, notes, prompts and bookmarks keep their ids, dates, stars and tags (including `slot:N`).
Re-running is safe: already-imported rows are skipped. Remove the token from `.env` afterwards.

### 4. Capture copies from Windows

```bash
pip install pyperclip requests
python scripts/clipboard_sync.py --server http://NAS-IP:5000 --api-key YOUR_KEY
```

Away from home, point `--server` at `https://clip.<your-domain>` and set `CF_ACCESS_CLIENT_ID` /
`CF_ACCESS_CLIENT_SECRET` from an Access service token.

### API notes

- `GET /api/clips` returns the newest 1,000 clips; `?limit=N` (or `all`) and `?q=text` (searches
  every clip). Clips over 4,000 characters come back as a preview with `truncated: true`;
  `GET /api/clips/:id` has the full text. The app loads it before copying or editing.
- `GET /api/health` is open (Docker health check). Everything else needs `X-API-Key` or
  `Authorization: Bearer` when `CLIPSYNC_API_KEY` is set.
- AI is optional: without a provider configured the rest of the app works and AI calls return an error.

### AI: DeepSeek or Ollama

All three providers use the OpenAI chat API, so switching is configuration only (`.env`):

| Setting | DeepSeek | Ollama (local, free) | OpenAI |
|---|---|---|---|
| `AI_PROVIDER` | `deepseek` | `ollama` | `openai` |
| key / host | `DEEPSEEK_API_KEY` | `OLLAMA_HOST=192.168.1.50:11434` | `OPENAI_API_KEY` |
| default `AI_MODEL` | `deepseek-chat` | `gemma4:e4b` | `gpt-4o-mini` |

Leave `AI_PROVIDER` empty to use whichever is configured (DeepSeek first, then Ollama, then OpenAI).
For Ollama, start it on the PC (or NAS) with `OLLAMA_HOST=0.0.0.0` so the container can reach it,
and `ollama pull` the model first. The Cloudflare Worker can't reach an Ollama inside your house;
use DeepSeek there.

### MCP

The server is an MCP server (Streamable HTTP, JSON-RPC) at `/api/mcp` with tools `search_clips`,
`list_clips`, `get_clip`, `create_clip`, `list_bookmarks`, `list_prompts`. Point any MCP client at
`http://NAS-IP:5000/api/mcp` (or `https://clip.<your-domain>/api/mcp`) and send the API key as the
`X-API-Key` header. Search and list return at most 500 clips, with long clips as previews; `get_clip`
returns the full text.

## Development

```bash
npm ci
npm run dev        # http://localhost:5000
npm test
npm run check      # TypeScript
```

---

## Alternative: Cloudflare Worker + D1

> The Worker is public, so its API stays off (503) until you set a key: `npx wrangler secret put CLIPSYNC_API_KEY`. Requests then need `X-API-Key` or `Authorization: Bearer`, the same as the Synology server; the app asks for the key once. Cloudflare Access in front is still recommended.

The existing React interface is deployed unchanged as Cloudflare static assets. A Hono Worker serves the API, Cloudflare D1 stores clips, tags, bookmarks, prompts, and uploads, and the same Worker exposes both the app's REST API and a remote MCP endpoint.

## One-time Cloudflare setup

Requires Node.js 20+ and a Cloudflare account with Workers enabled.

```bash
npm ci
npx wrangler login
npx wrangler d1 create clipsync-db
```

Copy the returned database ID into `wrangler.toml` in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`, then initialize and deploy:

```bash
npx wrangler d1 migrations apply clipsync-db --remote
npx wrangler secret put CLIPSYNC_API_KEY # required: the API is off without it
npx wrangler secret put DEEPSEEK_API_KEY # optional, for AI chat (or OPENAI_API_KEY; set AI_PROVIDER to choose)
npm run cf:deploy
```

Cloudflare prints the final `workers.dev` URL. Connect an MCP client to `https://YOUR-WORKER.workers.dev/api/mcp`. The legacy discovery and call endpoints remain available at `/api/mcp/tools` and `/api/mcp/call`.

## Local Cloudflare preview

```bash
npx wrangler d1 migrations apply clipsync-db --local
npm run cf:dev
```

## Custom domains and attaching other Cloudflare pages

In **Workers & Pages → clipsync → Settings → Domains & Routes**, add a custom domain or route. Existing Pages projects can remain separate and link to ClipSync's URL. To place them below one hostname, add routes such as `example.com/clipsync/*` for this Worker and `example.com/other/*` for the other Worker/Pages project. Cloudflare routing then composes the sites without combining their codebases.

Do not expose the MCP write endpoint publicly for sensitive data. Before broad use, protect `/api/mcp*` with Cloudflare Access or an API-token check.
