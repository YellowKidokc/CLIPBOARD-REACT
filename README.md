# ClipSync on Cloudflare

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
npx wrangler secret put OPENAI_API_KEY   # optional; required only for AI chat
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
