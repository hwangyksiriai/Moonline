import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";
import type { ServerCall, ServerProfile } from "./types.ts";
import type { Config } from "./config.ts";
export interface Repository {
  get(id: string): Promise<ServerCall | undefined>;
  list(userId?: string): Promise<ServerCall[]>;
  create(call: ServerCall): Promise<ServerCall>;
  mutate(
    id: string,
    fn: (current: ServerCall) => ServerCall | undefined,
  ): Promise<ServerCall | undefined>;
  claim(id: string, now: number): Promise<ServerCall | undefined>;
  profile(id: string): Promise<ServerProfile | undefined>;
  putProfile(p: ServerProfile): Promise<void>;
  saveMemory(call: ServerCall): Promise<void>;
  close(): Promise<void>;
}
export class SqliteRepository implements Repository {
  db: DatabaseSync;
  constructor(file: string) {
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS call_memories(call_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,summary TEXT NOT NULL);",
    );
  }
  async get(id: string) {
    const row = this.db.prepare("SELECT data FROM calls WHERE id=?").get(id);
    return row ? (JSON.parse(row.data as string) as ServerCall) : undefined;
  }
  async list(userId?: string) {
    const rows = userId
      ? this.db.prepare("SELECT data FROM calls WHERE user_id=?").all(userId)
      : this.db.prepare("SELECT data FROM calls").all();
    return rows.map((r) => JSON.parse(r.data as string) as ServerCall);
  }
  async create(c: ServerCall) {
    this.db
      .prepare("INSERT OR IGNORE INTO calls(id,user_id,data) VALUES(?,?,?)")
      .run(c.id, c.userId, JSON.stringify(c));
    const found = (await this.get(c.id))!;
    if (found.userId !== c.userId) throw new Error("ID conflict");
    return found;
  }
  async mutate(
    id: string,
    fn: (current: ServerCall) => ServerCall | undefined,
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.prepare("SELECT data FROM calls WHERE id=?").get(id);
      if (!row) {
        this.db.exec("COMMIT");
        return;
      }
      const current = JSON.parse(row.data as string) as ServerCall,
        next = fn(current);
      if (!next) {
        this.db.exec("COMMIT");
        return;
      }
      next.version = current.version + 1;
      this.db
        .prepare("UPDATE calls SET data=? WHERE id=?")
        .run(JSON.stringify(next), id);
      this.db.exec("COMMIT");
      return next;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async claim(id: string, now: number) {
    return this.mutate(id, (c) => {
      const busy = this.db
        .prepare("SELECT data FROM calls WHERE user_id=?")
        .all(c.userId)
        .some((r) =>
          ["calling", "connected"].includes(
            (JSON.parse(r.data as string) as ServerCall).status,
          ),
        );
      return !busy && c.status === "scheduled" && c.scheduledAt <= now
        ? { ...c, status: "calling", claimedAt: now }
        : undefined;
    });
  }
  async profile(id: string) {
    const row = this.db.prepare("SELECT data FROM users WHERE id=?").get(id);
    return row ? (JSON.parse(row.data as string) as ServerProfile) : undefined;
  }
  async putProfile(p: ServerProfile) {
    this.db
      .prepare(
        "INSERT INTO users(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(p.id, JSON.stringify(p));
  }
  async saveMemory(c: ServerCall) {
    if (c.consent && c.memoryConsent && c.summary)
      this.db
        .prepare(
          "INSERT INTO call_memories(call_id,user_id,summary) VALUES(?,?,?) ON CONFLICT(call_id) DO UPDATE SET summary=excluded.summary",
        )
        .run(c.id, c.userId, c.summary);
    else this.db.prepare("DELETE FROM call_memories WHERE call_id=?").run(c.id);
  }
  async close() {
    this.db.close();
  }
}
export class PostgresRepository implements Repository {
  pool: pg.Pool;
  constructor(url: string) {
    this.pool = new pg.Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
  }
  async get(id: string) {
    return (await this.pool.query("SELECT data FROM calls WHERE id=$1", [id]))
      .rows[0]?.data as ServerCall | undefined;
  }
  async list(userId?: string) {
    return (
      await this.pool.query(
        userId
          ? "SELECT data FROM calls WHERE user_id=$1 ORDER BY scheduled_at DESC LIMIT 500"
          : "SELECT data FROM calls WHERE status IN ('scheduled','calling','connected') OR (data->>'summaryState') IN ('pending','processing') ORDER BY scheduled_at LIMIT 500",
        userId ? [userId] : [],
      )
    ).rows.map((r) => r.data as ServerCall);
  }
  async create(c: ServerCall) {
    await this.pool.query(
      "INSERT INTO calls(id,user_id,scheduled_at,data,version) VALUES($1,$2,$3,$4,0) ON CONFLICT(id) DO NOTHING",
      [c.id, c.userId, new Date(c.scheduledAt), c],
    );
    const found = (await this.get(c.id))!;
    if (found.userId !== c.userId) throw new Error("ID conflict");
    return found;
  }
  async mutate(
    id: string,
    fn: (current: ServerCall) => ServerCall | undefined,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = (
        await client.query("SELECT data FROM calls WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0]?.data as ServerCall | undefined;
      if (!current) {
        await client.query("COMMIT");
        return;
      }
      const next = fn(current);
      if (next) {
        next.version = current.version + 1;
        await client.query(
          "UPDATE calls SET data=$2,version=$3,scheduled_at=$4 WHERE id=$1",
          [id, next, next.version, new Date(next.scheduledAt)],
        );
      }
      await client.query("COMMIT");
      return next;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async claim(id: string, now: number) {
    const c = await this.get(id);
    if (!c) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        c.userId,
      ]);
      const busy = await client.query(
        "SELECT id FROM calls WHERE user_id=$1 AND status IN ('calling','connected') LIMIT 1",
        [c.userId],
      );
      if (busy.rowCount) {
        await client.query("COMMIT");
        return;
      }
      const row = (
        await client.query("SELECT data FROM calls WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0]?.data as ServerCall | undefined;
      if (!row || row.status !== "scheduled" || row.scheduledAt > now) {
        await client.query("COMMIT");
        return;
      }
      const next = {
        ...row,
        status: "calling" as const,
        claimedAt: now,
        version: row.version + 1,
      };
      await client.query("UPDATE calls SET data=$2,version=$3 WHERE id=$1", [
        id,
        next,
        next.version,
      ]);
      await client.query("COMMIT");
      return next;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async profile(id: string) {
    return (await this.pool.query("SELECT data FROM users WHERE id=$1", [id]))
      .rows[0]?.data as ServerProfile | undefined;
  }
  async putProfile(p: ServerProfile) {
    await this.pool.query(
      "INSERT INTO users(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      [p.id, p],
    );
  }
  async saveMemory(c: ServerCall) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = (
        await client.query("SELECT data FROM calls WHERE id=$1 FOR UPDATE", [
          c.id,
        ])
      ).rows[0]?.data as ServerCall | undefined;
      await client.query("DELETE FROM call_transcripts WHERE call_id=$1", [
        c.id,
      ]);
      await client.query("DELETE FROM call_memories WHERE call_id=$1", [c.id]);
      if (current?.consent) {
        for (const [i, m] of (current.messages ?? []).entries())
          await client.query(
            "INSERT INTO call_transcripts(call_id,sequence,speaker,content,timestamp) VALUES($1,$2,$3,$4,$5)",
            [
              c.id,
              i,
              m.speaker,
              m.text,
              new Date(m.at ?? current.endedAt ?? Date.now()),
            ],
          );
        if (current.memoryConsent && current.summary)
          await client.query(
            "INSERT INTO call_memories(call_id,user_id,summary) VALUES($1,$2,$3)",
            [c.id, c.userId, current.summary],
          );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool.end();
  }
}
export function createRepository(config: Config): Repository {
  return config.demo
    ? new SqliteRepository(config.demoFile)
    : new PostgresRepository(config.databaseUrl!);
}
