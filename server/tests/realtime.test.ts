import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import WebSocket, { WebSocketServer } from "ws";
import twilio from "twilio";
import { SqliteRepository } from "../src/repository.ts";
import { configFrom } from "../src/config.ts";
import { DemoPhone } from "../src/providers.ts";
import { attachRealtime } from "../src/realtime.ts";
import { signToken } from "../src/security.ts";
async function until(fn: () => boolean) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > 5000) throw Error("Timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}
async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return (server.address() as { port: number }).port;
}
test("signed Twilio stream bridges audio, interrupts playback and stores consented transcript without external services", async () => {
  const repo = new SqliteRepository(":memory:"),
    phone = new DemoPhone();
  const config = {
    ...configFrom({ DEMO_MODE: "true" }),
    demo: false,
    twilioSid: "AC" + "1".repeat(32),
    twilioToken: "test-token",
    openaiKey: "not-a-real-key",
    backendUrl: "https://test.example",
    signingSecret: "a".repeat(32),
  };
  const userId = randomUUID(),
    id = randomUUID(),
    sid = "CA" + "2".repeat(32),
    streamSid = "MZ" + "3".repeat(32);
  await repo.putProfile({
    id: userId,
    name: "테스트",
    email: "",
    timezone: "Asia/Seoul",
    createdAt: Date.now(),
    memoryEnabled: true,
    notificationsEnabled: false,
  });
  await repo.create({
    id,
    userId,
    version: 0,
    voice: "Noah",
    scenarioId: "future",
    situation: "테스트",
    scheduledAt: Date.now(),
    status: "calling",
    consent: true,
    memoryConsent: true,
    providerCallId: sid,
    timezone: "Asia/Seoul",
  });
  const fakeServer = createServer(),
    fakeAi = new WebSocketServer({ server: fakeServer }),
    aiPort = await listen(fakeServer),
    events: any[] = [],
    phoneEvents: any[] = [];
  let aiPeer: WebSocket | undefined;
  fakeAi.on("connection", (ws) => {
    aiPeer = ws;
    ws.on("message", (raw) => {
      const event = JSON.parse(raw.toString());
      events.push(event);
      if (event.type === "session.update")
        ws.send(JSON.stringify({ type: "session.updated" }));
      if (event.type === "response.create") {
        ws.send(
          JSON.stringify({
            type: "response.output_audio.delta",
            item_id: "assistant-1",
            delta: Buffer.from([
              255, 255, 255, 255, 255, 255, 255, 255,
            ]).toString("base64"),
          }),
        );
        ws.send(
          JSON.stringify({
            type: "response.output_audio_transcript.done",
            item_id: "assistant-1",
            transcript: "여보세요?",
          }),
        );
      }
    });
  });
  const server = createServer(),
    wss = attachRealtime(
      server,
      repo,
      phone,
      config,
      () => new WebSocket(`ws://127.0.0.1:${aiPort}`),
    ),
    port = await listen(server);
  const signature = twilio.getExpectedTwilioSignature(
    config.twilioToken,
    config.backendUrl + "/voice/stream",
    {},
  );
  const client = new WebSocket(`ws://127.0.0.1:${port}/voice/stream`, {
    headers: { "x-twilio-signature": signature },
  });
  client.on("message", (raw) => phoneEvents.push(JSON.parse(raw.toString())));
  try {
    await once(client, "open");
    client.send(
      JSON.stringify({
        event: "start",
        start: {
          streamSid,
          callSid: sid,
          accountSid: config.twilioSid,
          customParameters: {
            callId: id,
            token: signToken(id, config.signingSecret),
          },
          mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000 },
        },
      }),
    );
    await until(() => phoneEvents.some((e) => e.event === "media"));
    assert.equal(
      events.find((e) => e.type === "session.update").session.audio.output
        .format.type,
      "audio/pcmu",
    );
    client.send(
      JSON.stringify({
        event: "media",
        media: { timestamp: "120", payload: "//////////8=" },
      }),
    );
    await until(() =>
      events.some((e) => e.type === "input_audio_buffer.append"),
    );
    aiPeer!.send(JSON.stringify({ type: "input_audio_buffer.speech_started" }));
    await until(() => phoneEvents.some((e) => e.event === "clear"));
    await until(() =>
      events.some((e) => e.type === "conversation.item.truncate"),
    );
    client.send(JSON.stringify({ event: "stop" }));
    await once(client, "close");
    for (
      let i = 0;
      i < 100 && (await repo.get(id))?.status !== "completed";
      i++
    )
      await new Promise((r) => setTimeout(r, 10));
    const c = (await repo.get(id))!;
    assert.equal(c.status, "completed");
    assert.equal(c.messages?.[0].text, "여보세요?");
  } finally {
    client.terminate();
    for (const ws of wss.clients) ws.terminate();
    for (const ws of fakeAi.clients) ws.terminate();
    await new Promise<void>((r) => server.close(() => r()));
    await new Promise<void>((r) => fakeServer.close(() => r()));
    await repo.close();
  }
});
