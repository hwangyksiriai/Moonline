import { test } from "node:test";
import assert from "node:assert/strict";
import { mockReply, replySuggestions } from "../src/services/conversation.ts";
import { topicChange } from "../shared/memory.ts";
import type { Call, Message } from "../shared/model.ts";

const call: Call = {
  id: "conversation-regression", voice: "Ian", characterName: "이안",
  scenarioId: "comfort", relationship: "친구", situation: "편하게 이야기 나누기",
  status: "connected", scheduledAt: 0, timezone: "Asia/Seoul", consent: false,
};
function conversation(settings = call) {
  const messages: Message[] = [];
  return {
    messages,
    send(text: string) {
      messages.push({ speaker: "you", text });
      const answer = mockReply(text, settings, messages);
      messages.push({ speaker: "caller", text: answer });
      return answer;
    },
  };
}

test("reported sequence: thanks, change topic, and longing each receive a relevant reply", () => {
  const chat = conversation();
  assert.match(chat.send("고마워"), /고마워/);
  assert.match(chat.send("다른 얘기 하자"), /멈출게/);
  const longing = chat.send("아 보고싶어");
  assert.match(longing, /보고 싶어/);
  assert.doesNotMatch(longing, /네 속도로|음악|노래/);
  assert.deepEqual(replySuggestions(chat.messages), ["네가 보고 싶어", "가족이 보고 싶어"]);
  assert.match(chat.send("너"), /내가 생각났구나/);
});

test("thank-you responses do not cycle back after two turns", () => {
  const chat = conversation();
  const answers = Array.from({ length: 4 }, () => chat.send("고마워"));
  assert.equal(new Set(answers).size, 4);
  assert.match(answers[3], /체험 문장/);
});

test("a configured phrase never replaces a direct question or thanks", () => {
  const chat = conversation({ ...call, mustSayPhrase: "너는 소중해" });
  chat.send("안녕");
  assert.match(chat.send("이름이 뭐야?"), /이안/);
  assert.doesNotMatch(chat.send("고마워"), /너는 소중해/);
  assert.match(chat.send("오늘 힘들었어"), /너는 소중해/);
  assert.doesNotMatch(chat.send("아직 좀 힘들어"), /너는 소중해/);
});

test("emotion and explicit requests override the previous question", () => {
  const chat = conversation();
  chat.send("보고 싶어");
  assert.match(chat.send("오늘 좀 힘들었어"), /조언이 필요해/);
  assert.deepEqual(replySuggestions(chat.messages), ["그냥 들어줘", "조언을 듣고 싶어"]);
  assert.match(chat.send("그냥 들어줘"), /해결책부터 말하지 않을게/);
  assert.match(chat.send("다른 얘기 하자"), /멈출게/);
  assert.match(chat.send("음악 이야기 하자"), /자주 듣는 노래/);
  assert.match(chat.send("잔잔한 음악을 좋아해"), /멜로디와 가사/);
  assert.match(chat.send("가사"), /노래.*제목/);
});

test("reported feelings are not confused with controls or the single character 일", () => {
  assert.equal(topicChange("회사 가기 싫어"), false);
  assert.equal(topicChange("이 얘기는 그만하자"), true);
  assert.equal(topicChange("싫어"), true);
  const chat = conversation();
  assert.match(chat.send("회사 가기 싫어"), /회사/);
  assert.doesNotMatch(chat.send("내일 생일이야"), /버거|회사|걱정/);
  assert.match(chat.send("힘들지 않아"), /짐작할 필요는 없었네/);
  assert.match(chat.send("오늘 행복해"), /기뻤어/);
});

test("recall does not revive a topic the user closed", () => {
  const chat = conversation();
  chat.send("회사에서 발표했어");
  assert.match(chat.send("내가 뭘 했지?"), /회사에서 발표했어/);
  chat.send("그 얘기는 그만하자");
  assert.doesNotMatch(chat.send("내가 뭘 했지?"), /회사에서 발표했어/);
});

test("character relationship changes the response without impersonating a real person", () => {
  const chat = conversation({ ...call, relationship: "연인" });
  assert.match(chat.send("네가 보고 싶어"), /함께라면/);
  assert.match(chat.send("진짜 사람이야?"), /체험 캐릭터/);
  assert.match(chat.send("가족이 보고 싶어"), /소중한 사람/);
});

test("unknown questions and repeated-reply feedback disclose the demo limits", () => {
  const chat = conversation();
  assert.match(chat.send("달까지 몇 킬로미터야?"), /준비된 체험 답변이 없어/);
  assert.match(chat.send("왜 같은 말만 해?"), /AI가 연결되지 않은/);
  assert.match(chat.send("이제 통화 끊자"), /여기까지/);
});
