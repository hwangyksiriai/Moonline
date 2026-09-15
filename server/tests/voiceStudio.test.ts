import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { voiceStudio } from "../src/voiceStudio.ts";
import { configFrom } from "../src/config.ts";
import { SqliteRepository } from "../src/repository.ts";
async function fixture(configured = true, verification = false) {
  const repo = new SqliteRepository(":memory:"), seen: { path: string; options?: RequestInit }[] = [];
  for (const id of ["alice", "bob"]) await repo.putProfile({ id, name: id, email: "", timezone: "Asia/Seoul", createdAt: 1, memoryEnabled: false, notificationsEnabled: false });
  const fake: typeof fetch = async (input, options) => {
    const path = String(input); seen.push({ path, options });
    if (options?.method === "DELETE") return new Response(null, { status: 204 });
    if (path.endsWith("/voices/add")) return Response.json({ voice_id: "owned-clone", requires_verification: verification });
    return new Response(new Uint8Array([1,2,3]), { headers: { "Content-Type": "audio/mpeg" } });
  };
  const app = express(); app.use(express.json());
  app.use((req,res,next) => { if (!req.header("Authorization")) { res.sendStatus(401); return; } res.locals.userId = req.header("Authorization"); next(); });
  app.use("/studio", voiceStudio({ ...configFrom({ DEMO_MODE: "true" }), demo: false, elevenlabsKey: configured ? "test-only" : undefined }, repo, fake));
  const server = createServer(app); await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/studio`;
  const upload = (consent = true) => fetch(base + "?name=Voice", { method: "POST", headers: { Authorization: "alice", "Content-Type": "audio/wav", "X-Voice-Filename": "sample.wav", ...(consent ? { "X-Voice-Consent": "confirmed" } : {}) }, body: new Uint8Array([1,2,3]) });
  return { repo, seen, base, upload, close: async () => { await new Promise<void>(r => server.close(() => r())); await repo.close(); } };
}
test("studio fails closed without auth, configuration or consent", async () => {
  const f = await fixture(false);
  try { assert.equal((await fetch(f.base)).status, 401); assert.equal((await f.upload()).status, 503); assert.equal(f.seen.length, 0); } finally { await f.close(); }
  const g = await fixture(); try { assert.equal((await g.upload(false)).status, 400); assert.equal(g.seen.length, 0); } finally { await g.close(); }
});
test("clone ownership, exact synthesis voice and provider deletion", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.upload()).status, 201);
    const form = f.seen[0].options!.body as FormData; assert.ok(form.get("files") instanceof Blob);
    const speech = (owner: string) => fetch(f.base + "/owned-clone/speech", { method: "POST", headers: { Authorization: owner, "Content-Type": "application/json" }, body: JSON.stringify({ text: "오늘은 잘 지냈어?" }) });
    assert.equal((await speech("bob")).status, 404);
    assert.equal((await speech("alice")).status, 200);
    assert.ok(f.seen.at(-1)!.path.endsWith("/text-to-speech/owned-clone"));
    assert.equal(JSON.parse(f.seen.at(-1)!.options!.body as string).voice_settings.speed, .95);
    const calls = f.seen.length;
    await fetch(f.base + "/owned-clone", { method: "DELETE", headers: { Authorization: "bob" } });
    assert.equal(f.seen.length, calls);
    assert.equal((await fetch(f.base + "/owned-clone", { method: "DELETE", headers: { Authorization: "alice" } })).status, 204);
    assert.deepEqual((await f.repo.profile("alice"))!.customVoices, []);
    assert.equal((await speech("alice")).status, 404);
  } finally { await f.close(); }
});
test("provider verification never appears as a ready clone", async () => {
  const f = await fixture(true, true);
  try {
    assert.equal((await (await f.upload()).json()).ready, false);
    const r = await fetch(f.base + "/owned-clone/speech", { method: "POST", headers: { Authorization: "alice", "Content-Type": "application/json" }, body: JSON.stringify({ text: "안녕" }) });
    assert.equal(r.status, 409); assert.equal(f.seen.length, 1);
  } finally { await f.close(); }
});
