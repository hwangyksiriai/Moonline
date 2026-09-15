import { readFile } from "node:fs/promises";
import pg from "pg";
import { scenarios, voices } from "../../shared/catalog.ts";
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for migrations");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(
    await readFile(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const v of voices)
    await pool.query(
      "INSERT INTO voices(id,name,description,voice_id) VALUES($1,$1,$2,$3) ON CONFLICT(id) DO UPDATE SET description=excluded.description,voice_id=excluded.voice_id",
      [v.name, v.description, v.realtimeVoice],
    );
  for (const s of scenarios)
    await pool.query(
      "INSERT INTO scenarios(id,title,description,category,default_prompt) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET title=excluded.title,default_prompt=excluded.default_prompt",
      [s.id, s.title, s.description, s.category, s.goal],
    );
  console.log("Schema and catalog ready.");
} finally {
  await pool.end();
}
