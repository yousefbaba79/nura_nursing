import type { Bindings } from "../types";

/**
 * Daily D1 → R2 backup.
 *
 * Produces a gzipped SQL dump (schema + data) that can be restored into an empty D1
 * database with:
 *   gunzip nura-backup.sql.gz
 *   npx wrangler d1 execute <db-name> --remote --file=nura-backup.sql
 *
 * Runs from the Worker's cron trigger (see `[triggers]` in wrangler.toml).
 */

const BACKUP_PREFIX = "d1/";
const PAGE_SIZE = 500;
const DEFAULT_RETENTION_DAYS = 90;

interface SchemaRow {
  type: "table" | "index" | "trigger" | "view";
  name: string;
  sql: string;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  // D1 returns BLOB columns as number[] (or ArrayBuffer in some runtimes).
  if (Array.isArray(value)) return `X'${toHex(Uint8Array.from(value as number[]))}'`;
  if (value instanceof ArrayBuffer) return `X'${toHex(new Uint8Array(value))}'`;
  if (ArrayBuffer.isView(value)) {
    return `X'${toHex(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Builds a full SQL dump of the database as an array of text chunks. */
export async function dumpDatabase(db: D1Database): Promise<{ chunks: string[]; rowCounts: Record<string, number> }> {
  const chunks: string[] = [];
  const rowCounts: Record<string, number> = {};

  chunks.push(
    `-- Nura Nursing D1 backup\n-- Created: ${new Date().toISOString()}\n` +
      `-- Restore into an EMPTY database: wrangler d1 execute <db> --remote --file=<this file>\n` +
      `PRAGMA defer_foreign_keys = TRUE;\n\n`,
  );

  const { results: schema } = await db
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE sql IS NOT NULL
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '_cf_%'
       ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END, name`,
    )
    .all<SchemaRow>();

  const tables = schema.filter((s) => s.type === "table");

  for (const table of tables) {
    chunks.push(`${table.sql};\n`);
  }
  chunks.push("\n");

  for (const table of tables) {
    const ident = quoteIdent(table.name);
    let offset = 0;
    let count = 0;
    let insertPrefix: string | null = null;

    for (;;) {
      const page = await db
        .prepare(`SELECT * FROM ${ident} ORDER BY rowid LIMIT ? OFFSET ?`)
        .bind(PAGE_SIZE, offset)
        .raw({ columnNames: true });

      const [columns, ...rows] = page as unknown[][];
      if (!columns || rows.length === 0) break;

      insertPrefix ??= `INSERT INTO ${ident} (${(columns as string[]).map(quoteIdent).join(", ")}) VALUES `;
      const lines = rows.map((row) => `${insertPrefix}(${row.map(sqlLiteral).join(", ")});`);
      chunks.push(lines.join("\n") + "\n");

      count += rows.length;
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    rowCounts[table.name] = count;
    if (count > 0) chunks.push("\n");
  }

  for (const obj of schema.filter((s) => s.type !== "table")) {
    chunks.push(`${obj.sql};\n`);
  }

  return { chunks, rowCounts };
}

async function gzip(chunks: string[]): Promise<ArrayBuffer> {
  const stream = new Blob(chunks).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

async function pruneOldBackups(bucket: R2Bucket, retentionDays: number): Promise<number> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const listing = await bucket.list({ prefix: BACKUP_PREFIX, cursor });
    const stale = listing.objects.filter((o) => o.uploaded.getTime() < cutoff).map((o) => o.key);
    if (stale.length > 0) {
      await bucket.delete(stale);
      deleted += stale.length;
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  return deleted;
}

/** Dumps D1, uploads the gzipped dump to R2, and prunes expired backups. */
export async function runBackup(env: Bindings): Promise<{ key: string; bytes: number }> {
  const { chunks, rowCounts } = await dumpDatabase(env.DB);
  const body = await gzip(chunks);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `${BACKUP_PREFIX}nura-backup-${stamp}.sql.gz`;

  await env.BACKUPS.put(key, body, {
    httpMetadata: { contentType: "application/sql", contentEncoding: "gzip" },
    customMetadata: {
      tables: String(Object.keys(rowCounts).length),
      rows: String(Object.values(rowCounts).reduce((a, b) => a + b, 0)),
    },
  });

  const retention = Number(env.BACKUP_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const pruned = await pruneOldBackups(env.BACKUPS, retention);

  // Log only sizes/counts — never row contents.
  console.log(`Backup stored: ${key} (${body.byteLength} bytes); pruned ${pruned} old backup(s).`);
  return { key, bytes: body.byteLength };
}
