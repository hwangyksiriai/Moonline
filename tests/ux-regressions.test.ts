import { test } from "node:test";
import assert from "node:assert/strict";
import { demoSummary, type Call, type Message } from "../shared/model.ts";
import { mockReply, opening } from "../src/services/conversation.ts";
import { quoteCandidates, memoryLines } from "../shared/memory.ts";
const call: Call = {
  id: "x",
  voice: "Noah",
  characterName: "수현",
  situation: "친구와 이야기",
  scheduledAt: 0,
  timezone: "Asia/Seoul",
  status: "completed",
  consent: true,
  memoryConsent: true,
  mustSayPhrase: "오늘 충분히 잘했어",
};
test("topic change and call ending take priority over configured phrase", () => {
  const messages: Message[] = [
    { speaker: "you", text: "오늘 발표를 잘 마쳤어" },
    { speaker: "you", text: "그 이야기는 그만하고 다른 얘기 하자" },
  ];
  assert.match(mockReply(messages[1].text, call, messages), /멈출게/);
  assert.doesNotMatch(
    mockReply(messages[1].text, call, messages),
    /충분히 잘했어/,
  );
  assert.match(mockReply("오늘은 여기까지", call, messages), /여기까지/);
});
test("empty calls do not fabricate a quote or memory from the scenario", () => {
  assert.deepEqual(
    demoSummary(call, [{ speaker: "caller", text: "첫 인사" }]),
    { summary: undefined, quote: undefined },
  );
});
test("control requests and questions do not become enduring memories", () => {
  const messages: Message[] = [
    {
      speaker: "you",
      text: "오늘 회사에서 발표를 잘 마쳤는데 아무도 수고했다고 하지 않았어.",
    },
    { speaker: "you", text: "그 이야기는 그만하자" },
    { speaker: "you", text: "내가 뭘 했지?" },
  ];
  assert.equal(demoSummary(call, messages).summary, undefined);
  assert.deepEqual(
    memoryLines("좋아하는 노래는 봄날\n그 얘기는 그만하자\n뭘 했지?"),
    ["좋아하는 노래는 봄날"],
  );
});
test("quote selection uses actual replies after an exchange, preferring requested phrase", () => {
  const messages: Message[] = [
    { speaker: "caller", text: "첫 인사" },
    { speaker: "you", text: "오늘 있었던 얘기를 해줄게" },
    { speaker: "caller", text: "오늘 충분히 잘했어" },
    { speaker: "caller", text: "또 만나" },
  ];
  assert.equal(demoSummary(call, messages).quote, "오늘 충분히 잘했어");
  assert.deepEqual(quoteCandidates({ ...call, messages }), [
    "오늘 충분히 잘했어",
    "또 만나",
  ]);
});
test("recall uses an actual earlier user statement and memory asks before revisiting", () => {
  const messages: Message[] = [
    { speaker: "you", text: "회사 발표를 잘 마쳤어" },
    { speaker: "you", text: "내가 무슨 일을 했지?" },
  ];
  assert.match(
    mockReply(messages[1].text, call, messages),
    /회사 발표를 잘 마쳤어/,
  );
  assert.match(opening(call, "지우", "내일 면접이 있어"), /꺼내도 괜찮아/);
});
