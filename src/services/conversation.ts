import { memoryLines, topicChange, wantsToEnd } from "../../shared/memory.ts";
import type { Call, Message } from "../../shared/model.ts";
import { scenarioOf } from "../../shared/catalog.ts";
export function opening(call: Call, name: string, memory?: string) {
  const base = (
    call.greeting || scenarioOf(call.scenarioId).opening
  ).replaceAll("{이름}", call.userNickname || name);
  name = call.userNickname || name;
  const fact = memoryLines(memory)[0];
  return fact
    ? `${base} 지난번에 “${fact}”라고 했었지. 오늘 그 이야기를 다시 꺼내도 괜찮아?`
    : base;
}
export function mockReply(
  text: string,
  call: Call,
  messages: Message[],
): string {
  const turn = messages.filter((m) => m.speaker === "you").length;
  if (wantsToEnd(text))
    return "응, 오늘은 여기까지 이야기하자. 편안한 밤 보내.";
  if (topicChange(text))
    return "알겠어. 그 이야기는 여기서 멈출게. 요즘 좋아하는 노래 이야기를 해볼까?";
  if (/내가.*(했지|말했|기억)/.test(text)) {
    const earlier = messages
      .slice(0, -1)
      .filter(
        (m) =>
          m.speaker === "you" && !topicChange(m.text) && !/[?？]$/.test(m.text),
      )
      .at(-1);
    return earlier
      ? "아까 “" + earlier.text + "”라고 말해줬어. 내가 놓친 부분이 있을까?"
      : "아직 들은 이야기가 충분하지 않아. 한 번 더 이야기해줄래?";
  }
  if (
    call.mustSayPhrase &&
    !messages.some(
      (m) => m.speaker === "caller" && m.text.includes(call.mustSayPhrase!),
    ) &&
    turn >= 2
  )
    return `그리고 꼭 해주고 싶은 말이 있어. ${call.mustSayPhrase}`;

  if (/누구/.test(text))
    return call.scenarioId === "future"
      ? "나야. 10년 뒤의 너라는 상상을 해봤어. 지금의 너에게 꼭 전화하고 싶었거든."
      : `너의 ${call.relationship || "친구"}. 오늘 네 목소리가 듣고 싶었어.`;
  if (/걱정|일|회사|불안|힘들/.test(text))
    return [
      "오늘 많이 버거웠구나. 해결하려고 애쓰지 말고 지금은 그냥 이야기해줘.",
      "그중에서 가장 마음에 남은 순간은 뭐였어?",
      "네가 버틴 시간도 분명 의미가 있어. 지금은 잠깐 쉬어가자.",
    ][turn % 3];
  const replies: Record<string, string[]> = {
    love: [
      "집에 오는 길에 네 생각이 나더라. 오늘 가장 좋았던 순간은 뭐야?",
      "같이 아무것도 안 하고 있어도 좋을 것 같아.",
    ],
    sleep: [
      "오늘은 생각을 조금 내려놓아도 괜찮아. 창밖은 조용해?",
      "이불 편하게 덮고, 숨 한 번 천천히 쉬자.",
    ],
    birthday: [
      "이번 생일에 꼭 이루고 싶은 소원이 있어?",
      "태어나줘서 고마워. 오늘은 네가 제일 소중한 사람이야.",
    ],
    horror: [
      "그 오래된 편지에는 날짜 대신 작은 달이 그려져 있었대. 뒷이야기도 들을래?",
      "문을 열었더니 누군가 두고 간 따뜻한 차 한 잔이 있었어. 이상하지?",
    ],
    future: [
      "그때 나에게 필요한 건 정답보다 같이 있어주는 사람이었어.",
      "내일 아주 작은 일 하나만 해본다면, 뭘 하고 싶어?",
    ],
    comfort: [
      "응, 네 속도로 말해도 돼. 듣고 있어.",
      "괜찮지 않은 날도 있어. 오늘만큼은 너를 너무 몰아붙이지 마.",
    ],
    custom: [
      `“${call.situation.slice(0, 100)}” 그 이야기부터 시작해볼까?`,
      "그 순간 네 마음은 어땠어?",
    ],
  };
  const choices = replies[call.scenarioId ?? "future"] ?? replies.custom;
  const answer = choices[(turn - 1) % choices.length];
  return call.personality?.includes("장난스러운")
    ? `음… 잠깐. ${answer}`
    : answer;
}
