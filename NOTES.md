# Notes: next server-side pieces (2026-10-13)

The Windows desktop app plan lives in the Rust_AI_API repo (`docs/DESKTOP_APP_NOTES.md`). These are
the parts that belong in this server (ClipSync on the Synology).

- **Link detection:** when a clip arrives, mark URLs (`kind: link`, domain, YouTube/PDF/GitHub type)
  so the apps can show a Links tab.
- **Cloudflare saved set:** keep 10-100 chosen clips (setting) in Cloudflare (D1 or KV) so they are
  reachable when the NAS is off. The Synology stays the full history.
- **Schedules:** a scheduler in this server that runs jobs every 1/4/6/8/12 hours:
  - DeepSeek overview of the clipboard history since the last run, saved as a note.
  - Ollama organizer: tags, categories, duplicates, keep-suggestions; proposes, never deletes.
- **Workflows:** named step lists (AI action, script call, search, save) run on a schedule or on
  demand; each run logged.
- **Phone view:** one-handed layout modeled on nerve `clipboard3.html` (bottom tabs, slot grid, swipe actions).
- **Hotstrings:** prompts already have a `shortcut` field; expose them to the desktop app.
