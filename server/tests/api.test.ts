import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { SqliteRepository } from "../src/repository.ts";
import { configFrom } from "../src/config.ts";
import { DemoPhone } from "../src/providers.ts";
import { createApp } from "../src/app.ts";
import { createWorker, dispatch } from "../src/worker.ts";
import { validToken, signToken } from "../src/security.ts";
async function fixture() {
  const config = configFrom({ DEMO_MODE: "true", DEMO_DATA_FILE: ":memory:" }),
    repo = new SqliteRepository(":memory:"),
    phone = new DemoPhone();
  const server = createServer(createApp(config, repo, phone));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    token?: string,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  }
  const auth = await request("/auth", "POST", { name: "테스트" });
  const token = auth.body.token as string;
  return {
    repo,
    phone,
    config,
    request,
    token,
    user: auth.body.profile.id as string,
    async close() {
      await new Promise<void>((r, e) =>
        server.close((err) => (err ? e(err) : r())),
      );
      await repo.close();
    },
  };
}
const draft = () => ({
  id: randomUUID(),
  scenarioId: "future",
  voice: "Noah",
  situation: "내일 발표가 있어",
  relationship: "미래의 나",
  personality: ["다정한"],
  consent: false,
  memoryConsent: false,
  timezone: "Asia/Seoul",
  scheduledAt: Date.now() + 60000,
});
test("auth boundary, owner isolation, no raw phone or provider fields", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("/calls")).status, 401);
    const c = await f.request("/calls", "POST", draft(), f.token);
    assert.equal(c.status, 201);
    assert.equal(c.body.userId, undefined);
    assert.equal(c.body.version, undefined);
    const other = await f.request("/auth", "POST", { name: "다른 사용자" });
    assert.equal(
      (
        await f.request(
          "/calls/" + c.body.id,
          "GET",
          undefined,
          other.body.token,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request(
          "/calls/" + c.body.id,
          "DELETE",
          undefined,
          other.body.token,
        )
      ).status,
      404,
    );
    assert.equal(
      (await f.request("/me", "GET", undefined, f.token)).body.phone,
      undefined,
    );
  } finally {
    await f.close();
  }
});
test("validation, edit, cancel, duplicate-create idempotency", async () => {
  const f = await fixture();
  try {
    const input = draft();
    assert.equal(
      (await f.request("/calls", "POST", { ...input, scheduledAt: 0 }, f.token))
        .status,
      400,
    );
    assert.equal(
      (
        await f.request(
          "/calls",
          "POST",
          { ...input, voice: "Unknown" },
          f.token,
        )
      ).status,
      400,
    );
    await f.request("/calls", "POST", input, f.token);
    await f.request("/calls", "POST", input, f.token);
    assert.equal((await f.repo.list(f.user)).length, 1);
    const edited = await f.request(
      "/calls/" + input.id,
      "PATCH",
      { ...input, scheduledAt: Date.now() + 120000 },
      f.token,
    );
    assert.equal(edited.status, 200);
    assert.equal(
      (await f.request("/calls/" + input.id, "DELETE", undefined, f.token))
        .status,
      200,
    );
    assert.equal(
      (await f.request("/calls/" + input.id, "PATCH", input, f.token)).status,
      409,
    );
  } finally {
    await f.close();
  }
});
test("parallel scheduler claims dial at most once and serializes per user", async () => {
  const f = await fixture();
  try {
    const a = {
        ...draft(),
        userId: f.user,
        version: 0,
        status: "scheduled" as const,
        scheduledAt: Date.now() - 1000,
      },
      b = { ...a, id: randomUUID() };
    await f.repo.create(a);
    await f.repo.create(b);
    await Promise.all([
      dispatch(a.id, f.repo, f.phone, f.config),
      dispatch(a.id, f.repo, f.phone, f.config),
      dispatch(b.id, f.repo, f.phone, f.config),
    ]);
    assert.equal(f.phone.dialCount, 1);
    assert.equal(
      (await f.repo.list(f.user)).filter((c) => c.status === "calling").length,
      1,
    );
  } finally {
    await f.close();
  }
});
test("demo accept, transcript consent, summary, favorite, forget", async () => {
  const f = await fixture();
  try {
    const c = {
      ...draft(),
      consent: true,
      memoryConsent: true,
      userId: f.user,
      status: "scheduled" as const,
      version: 0,
      scheduledAt: Date.now() - 100,
    };
    await f.repo.create(c);
    await dispatch(c.id, f.repo, f.phone, f.config);
    await f.request("/calls/" + c.id + "/accept", "POST", {}, f.token);
    const messages = [
      { speaker: "you", text: "내일 오전 10시에 발표가 있어" },
      { speaker: "caller", text: "오늘은 푹 쉬어." },
    ];
    assert.equal(
      (
        await f.request(
          "/calls/" + c.id + "/complete",
          "POST",
          { messages },
          f.token,
        )
      ).status,
      200,
    );
    await createWorker(f.repo, f.phone, f.config).tick();
    const saved = (await f.repo.get(c.id))!;
    assert.match(saved.summary!, /발표/);
    assert.equal(saved.quote, "오늘은 푹 쉬어.");
    assert.equal(saved.messages?.length, 2);
    assert.equal(
      (await f.request("/calls/" + c.id, "PATCH", { favorite: true }, f.token))
        .body.favorite,
      true,
    );
    await f.request("/calls/" + c.id + "/memory", "DELETE", {}, f.token);
    const erased = (await f.repo.get(c.id))!;
    assert.equal(erased.messages, undefined);
    assert.equal(erased.summary, undefined);
    assert.equal(erased.quote, undefined);
    assert.equal(erased.consent, false);
  } finally {
    await f.close();
  }
});
test("without consent the server drops submitted transcripts", async () => {
  const f = await fixture();
  try {
    const c = {
      ...draft(),
      userId: f.user,
      status: "connected" as const,
      version: 0,
      startedAt: Date.now(),
    };
    await f.repo.create(c);
    await f.request(
      "/calls/" + c.id + "/complete",
      "POST",
      { messages: [{ speaker: "you", text: "private" }] },
      f.token,
    );
    const saved = (await f.repo.get(c.id))!;
    assert.equal(saved.messages, undefined);
    assert.equal(saved.summaryState, undefined);
  } finally {
    await f.close();
  }
});
test("webhooks fail closed; real configuration cannot silently fall back", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.request("/voice/status?callId=" + randomUUID(), "POST", {
          CallSid: "CA" + "1".repeat(32),
        })
      ).status,
      403,
    );
    assert.throws(() => configFrom({ DEMO_MODE: "false" }), /Missing/);
    const signed = signToken("call", "a-secret");
    assert.equal(validToken("call", signed, "a-secret"), true);
    assert.equal(validToken("different", signed, "a-secret"), false);
  } finally {
    await f.close();
  }
});
test("missed jobs fail without dialing; notification slots exclude last minute", async () => {
  const f = await fixture();
  try {
    const now = Date.now();
    const c = {
      ...draft(),
      userId: f.user,
      status: "scheduled" as const,
      version: 0,
      scheduledAt: now - 16 * 60000,
    };
    await f.repo.create(c);
    await createWorker(f.repo, f.phone, f.config).tick(now);
    assert.equal(f.phone.dialCount, 0);
    assert.equal((await f.repo.get(c.id))!.status, "failed");
    const upcoming = { ...c, id: randomUUID(), scheduledAt: now + 30 * 60000 };
    await f.repo.create(upcoming);
    const worker = createWorker(f.repo, f.phone, f.config);
    await worker.tick(now);
    await worker.tick(now + 25 * 60000);
    await worker.tick(now + 29 * 60000);
    assert.deepEqual((await f.repo.get(upcoming.id))!.reminders, [30, 5]);
  } finally {
    await f.close();
  }
});

test("keepsake editing preserves transcript and isolates owners", async () => {
  const f = await fixture();
  try {
    const d = { ...draft(), consent: true, memoryConsent: true };
    await f.request("/calls", "POST", d, f.token);
    const messages = [
      { speaker: "caller" as const, text: "안녕" },
      { speaker: "you" as const, text: "다음 주에 중요한 발표가 있어" },
      { speaker: "caller" as const, text: "네 속도로 준비해도 괜찮아" },
    ];
    await f.repo.mutate(d.id, (c) => ({
      ...c,
      status: "completed",
      messages,
      summary: "다음 주 발표",
      quote: messages[2].text,
      summaryState: "ready",
    }));
    const stranger = await f.request("/auth", "POST", { name: "다른 사람" });
    assert.equal(
      (
        await f.request(
          "/calls/" + d.id + "/keepsake",
          "PATCH",
          { summary: "" },
          stranger.body.token,
        )
      ).status,
      404,
    );
    const r = await f.request(
      "/calls/" + d.id + "/keepsake",
      "PATCH",
      { summary: "", memoryConsent: false },
      f.token,
    );
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.messages, messages);
    assert.equal(r.body.quote, messages[2].text);
    assert.equal(r.body.memoryConsent, false);
    assert.equal(
      (
        await f.request(
          "/calls/" + d.id + "/keepsake",
          "PATCH",
          { quote: "하지 않은 말" },
          f.token,
        )
      ).status,
      400,
    );
    const cleared = await f.request(
      "/calls/" + d.id + "/keepsake",
      "PATCH",
      { quote: null },
      f.token,
    );
    assert.equal(cleared.body.quote, undefined);
    assert.equal(cleared.body.messages.length, 3);
  } finally {
    await f.close();
  }
});
