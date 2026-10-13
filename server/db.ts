import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import { SCHEMA_SQL } from "./schema-sql";

// CLIPSYNC_DATA_DIR lets Docker mount the database on a Synology volume (default: ./data).
const dbPath = path.resolve(process.env.CLIPSYNC_DATA_DIR || path.resolve(process.cwd(), "data"), "clipsync.db");

import fs from "fs";
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };

export function initializeDatabase() {
  sqlite.exec(SCHEMA_SQL);
}
