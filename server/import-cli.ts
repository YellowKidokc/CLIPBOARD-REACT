import Database from "better-sqlite3";
import { initializeDatabase, sqlite } from "./db";
import { d1Source, importLegacy, sqliteSource } from "./import-legacy";

const USAGE = `Import the old ClipSync history into this server's database.

  node dist/import-legacy.cjs --d1
      reads Cloudflare D1 directly; needs CF_ACCOUNT_ID, CF_API_TOKEN (D1 read) and D1_DATABASE_ID
  node dist/import-legacy.cjs --sqlite <legacy.db>
      reads a local SQLite copy of the old database

Safe to run more than once: rows already imported are skipped.`;

async function main() {
  const [mode, file] = process.argv.slice(2);
  let source;
  if (mode === "--d1") {
    const { CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID } = process.env;
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !D1_DATABASE_ID) {
      console.error("Missing CF_ACCOUNT_ID, CF_API_TOKEN or D1_DATABASE_ID.\n\n" + USAGE);
      process.exit(2);
    }
    source = d1Source(CF_ACCOUNT_ID, D1_DATABASE_ID, CF_API_TOKEN);
  } else if (mode === "--sqlite" && file) {
    source = sqliteSource(new Database(file, { readonly: true, fileMustExist: true }));
  } else {
    console.error(USAGE);
    process.exit(2);
  }
  initializeDatabase();
  const counts = await importLegacy(source, sqlite, (line) => console.log(line));
  console.log("done:", JSON.stringify(counts));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
