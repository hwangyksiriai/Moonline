import type { Call, Message } from "./model.ts";
export const topicChange = (text: string) =>
  /다른\s*(얘기|이야기)|주제.*(바꾸|변경)|(?:얘기|이야기|말|질문).*그만|그만\s*(하자|해|말해|물어)|^\s*(그만|무서워|싫어)[.!~\s]*$/.test(text);
export const wantsToEnd = (text: string) =>
  /통화.*(끝|끊|마치)|오늘은 여기까지|이제 끊자/.test(text);
export function memoryLines(summary?: string): string[] {
  return (summary ?? "")
    .split(/\n|\s\/\s/)
    .map((x) => x.trim())
    .filter((x) => x && !topicChange(x) && !/[?？]$/.test(x))
    .slice(0, 8);
}
export function quoteCandidates(call: Pick<Call, "consent" | "messages">) {
  if (!call.consent || !call.messages?.some((m) => m.speaker === "you"))
    return [];
  return [
    ...new Set(
      call.messages
        .slice(1)
        .filter((m) => m.speaker === "caller" && m.text.length <= 180)
        .map((m) => m.text),
    ),
  ].slice(-8);
}
export function rememberedFacts(messages: Message[]) {
  // A rule-based demo must not treat control requests or ended topics as enduring memories.
  if (messages.some((m) => m.speaker === "you" && topicChange(m.text)))
    return [];
  return messages
    .filter(
      (m) =>
        m.speaker === "you" &&
        !wantsToEnd(m.text) &&
        !/[?？]$/.test(m.text) &&
        m.text.length > 12,
    )
    .map((m) => m.text)
    .slice(-3);
}
