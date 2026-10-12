import type BetterSqlite3 from "better-sqlite3";

/**
 * Import the older ClipSync D1 layout (`items` + `prompts` + `bookmarks` side tables, epoch-ms
 * timestamps) into this server's tables. Idempotent: rows keep their ids and existing ids are
 * skipped, so it can be re-run after a partial import.
 */

export interface LegacySource {
  query(sql: string, params?: (string | number)[]): Promise<Record<string, any>[]>;
}

export interface ImportCounts {
  clips: number;
  prompts: number;
  bookmarks: number;
  tags: number;
  skipped: number;
  alreadyPresent: number;
}

const PAGE_SIZE = 50;

const PAGE_SQL = `SELECT i.rowid AS _rowid, i.id, i.type, i.title, i.content, i.starred, i.folder, i.tags_json,
    i.created_at, i.updated_at,
    p.template AS p_template, p.shortcut AS p_shortcut,
    b.url AS b_url, b.favicon_url AS b_favicon, b.summary AS b_summary
  FROM items i
  LEFT JOIN prompts p ON p.item_id = i.id
  LEFT JOIN bookmarks b ON b.item_id = i.id
  WHERE i.rowid > ? ORDER BY i.rowid LIMIT ?`;

/** Cloudflare D1 over its REST API (needs an API token with D1 read access). */
export function d1Source(accountId: string, databaseId: string, apiToken: string, fetchImpl: typeof fetch = fetch): LegacySource {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  return {
    async query(sql, params = []) {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql, params: params.map(String) }),
      });
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        const why = body.errors?.map((e: any) => e.message).join("; ") || res.statusText;
        throw new Error(`D1 query failed (${res.status}): ${why}`);
      }
      return body.result?.[0]?.results ?? [];
    },
  };
}

/** A local SQLite copy of the legacy database (e.g. from `wrangler d1 export`). */
export function sqliteSource(db: BetterSqlite3.Database): LegacySource {
  return {
    async query(sql, params = []) {
      return db.prepare(sql).all(...params) as Record<string, any>[];
    },
  };
}

function iso(value: unknown): string {
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string" && /^\d+$/.test(value)) return new Date(Number(value)).toISOString();
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}

function tagsJson(value: unknown): string {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return "[]";
  }
}

function titleFor(row: Record<string, any>, fallback: string): string {
  if (row.title && String(row.title).trim()) return String(row.title).trim();
  const firstLine = String(row.content ?? "").split("\n").map((l) => l.trim()).find(Boolean);
  return firstLine ? firstLine.slice(0, 60) : fallback;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export type Mapped =
  | { table: "clips"; values: Record<string, string | number> }
  | { table: "prompts"; values: Record<string, string | number> }
  | { table: "bookmarks"; values: Record<string, string | number | null> }
  | { table: null; reason: string };

export function mapItem(row: Record<string, any>): Mapped {
  const created = iso(row.created_at);
  const updated = iso(row.updated_at ?? row.created_at);
  const tags = tagsJson(row.tags_json);
  switch (row.type) {
    case "clip":
    case "note":
    case "research":
      return {
        table: "clips",
        values: {
          id: row.id,
          title: titleFor(row, "Untitled"),
          content: String(row.content ?? ""),
          category: row.type === "clip" ? "clipboard" : row.type === "note" ? "notes" : "research",
          pinned: 0,
          starred: row.starred ? 1 : 0,
          deleted: 0,
          is_structured: 0,
          fields: "[]",
          tags,
          created_at: created,
          updated_at: updated,
        },
      };
    case "prompt":
      return {
        table: "prompts",
        values: {
          id: row.id,
          name: titleFor(row, "Untitled prompt"),
          short_desc: "",
          template: String(row.p_template || row.content || ""),
          category: "custom",
          color: "#f59e0b",
          shortcut: String(row.p_shortcut || ""),
          created_at: created,
        },
      };
    case "bookmark": {
      const url = String(row.b_url || (/^https?:\/\//.test(String(row.content ?? "")) ? row.content : "")).trim();
      if (!url) return { table: null, reason: `bookmark ${row.id} has no URL` };
      return {
        table: "bookmarks",
        values: {
          id: row.id,
          title: titleFor(row, url),
          url,
          description: String(row.b_summary || ""),
          domain: domainOf(url),
          category: "general",
          bookmark_tags: tags,
          favicon: row.b_favicon || null,
          created_at: created,
        },
      };
    }
    default:
      return { table: null, reason: `unknown type ${row.type} (${row.id})` };
  }
}

function insertSql(table: string, values: Record<string, unknown>): string {
  const cols = Object.keys(values);
  return `INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
}

export async function importLegacy(
  source: LegacySource,
  target: BetterSqlite3.Database,
  log: (line: string) => void = () => {},
): Promise<ImportCounts> {
  const counts: ImportCounts = { clips: 0, prompts: 0, bookmarks: 0, tags: 0, skipped: 0, alreadyPresent: 0 };

  const legacyTags = await source.query("SELECT name, color FROM tags").catch(() => []);
  const insertTag = target.prepare("INSERT OR IGNORE INTO tags (id, name, color) VALUES (?, ?, ?)");
  for (const t of legacyTags) {
    if (!t.name) continue;
    counts.tags += insertTag.run(crypto.randomUUID(), String(t.name), String(t.color || "#888888")).changes;
  }

  let after = 0;
  for (;;) {
    const rows = await source.query(PAGE_SQL, [after, PAGE_SIZE]);
    if (rows.length === 0) break;
    const writePage = target.transaction((page: Record<string, any>[]) => {
      for (const row of page) {
        const mapped = mapItem(row);
        if (!mapped.table) {
          counts.skipped += 1;
          log(`skip: ${mapped.reason}`);
          continue;
        }
        const changes = target.prepare(insertSql(mapped.table, mapped.values)).run(...Object.values(mapped.values)).changes;
        if (changes === 0) counts.alreadyPresent += 1;
        else counts[mapped.table] += 1;
      }
    });
    writePage(rows);
    after = Number(rows[rows.length - 1]._rowid);
    log(`… ${counts.clips} clips, ${counts.prompts} prompts, ${counts.bookmarks} bookmarks (up to row ${after})`);
  }
  return counts;
}
