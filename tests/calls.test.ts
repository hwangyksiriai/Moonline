import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type Call,
  countdown,
  nextTime,
  reconcile,
  transition,
} from "../src/domain/calls.ts";
const sample: Call = {
  id: "one",
  voice: "Noah",
  situation: "요즘 일이 잘 안 풀려",
  scheduledAt: 1000,
  timezone: "Asia/Seoul",
  status: "scheduled",
  consent: false,
};
test("22:00 is today before the time and tomorrow after it", () => {
  const morning = new Date(2026, 8, 15, 9).getTime();
  assert.equal(nextTime(22, 0, morning), new Date(2026, 8, 15, 22).getTime());
  assert.equal(
    nextTime(22, 0, new Date(2026, 8, 15, 23).getTime()),
    new Date(2026, 8, 16, 22).getTime(),
  );
});
test("countdown cannot be negative", () => {
  assert.equal(countdown(1000, 2000), "00 : 00 : 00");
  assert.equal(countdown(3661000, 0), "01 : 01 : 01");
});
test("schedule is claimed once, including after background resume", () => {
  assert.equal(reconcile([sample], 999)[0].status, "scheduled");
  const ringing = reconcile([sample], 40000);
  assert.equal(ringing[0].status, "calling");
  assert.strictEqual(reconcile(ringing, 50000)[0], ringing[0]);
});
test("only one call can ring at a time", () => {
  const list = reconcile([sample, { ...sample, id: "two" }], 1001);
  assert.deepEqual(
    list.map((c) => c.status),
    ["calling", "scheduled"],
  );
});
test("cancelled calls never ring", () => {
  const cancelled = transition(sample, "cancelled");
  assert.equal(reconcile([cancelled], 99999)[0].status, "cancelled");
});
test("full lifecycle preserves duration, omits transcript without consent", () => {
  const ringing = transition(sample, "calling", 1000);
  const connected = transition(ringing, "connected", 1200);
  const completed = transition(connected, "completed", 5500, [
    { speaker: "you", text: "hello" },
  ]);
  assert.equal(completed.duration, 4);
  assert.equal(completed.messages, undefined);
  assert.strictEqual(transition(completed, "calling"), completed);
});
test("explicit consent stores transcript", () => {
  const connected = transition(
    transition({ ...sample, consent: true }, "calling"),
    "connected",
    1200,
  );
  assert.equal(
    transition(connected, "completed", 2500, [{ speaker: "you", text: "안녕" }])
      .messages?.length,
    1,
  );
});
test("double accept does not reset start time", () => {
  const connected = transition(
    transition(sample, "calling"),
    "connected",
    1200,
  );
  assert.strictEqual(transition(connected, "connected", 5000), connected);
});
