import type { VoiceChoice } from "./voice.ts";
import { quoteCandidates, rememberedFacts } from "./memory.ts";
export type Status =
  | "draft"
  | "scheduled"
  | "calling"
  | "connected"
  | "completed"
  | "failed"
  | "cancelled";
export type Message = { speaker: "you" | "caller"; text: string; at?: number };
export type Call = {
  id: string;
  voice: string;
  voiceChoice?: VoiceChoice;
  characterId?: string;
  characterName?: string;
  backstory?: string;
  greeting?: string;
  userNickname?: string;
  anniversary?: string;
  scenarioId?: string;
  situation: string;
  relationship?: string;
  personality?: string[];
  mustSayPhrase?: string;
  scheduledAt: number;
  timezone: string;
  status: Status;
  consent: boolean;
  memoryConsent?: boolean;
  startedAt?: number;
  endedAt?: number;
  duration?: number;
  messages?: Message[];
  summary?: string;
  quote?: string;
  favorite?: boolean;
  createdAt?: number;
  failureReason?: string;
};
export type Profile = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  createdAt: number;
  phoneMasked?: string;
  phoneVerified?: boolean;
  memoryEnabled: boolean;
  notificationsEnabled: boolean;
};
export type CallDraft = Pick<
  Call,
  | "characterId"
  | "characterName"
  | "backstory"
  | "greeting"
  | "userNickname"
  | "anniversary"
  | "voice"
  | "voiceChoice"
  | "scenarioId"
  | "situation"
  | "relationship"
  | "personality"
  | "mustSayPhrase"
  | "consent"
  | "memoryConsent"
  | "scheduledAt"
  | "timezone"
>;
export const terminal = (status: Status) =>
  ["completed", "failed", "cancelled"].includes(status);
const transitions: Record<Status, Status[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["calling", "cancelled", "failed"],
  calling: ["connected", "cancelled", "failed", "completed"],
  connected: ["completed", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};
export function transition(
  call: Call,
  status: Status,
  now = Date.now(),
  messages: Message[] = [],
): Call {
  if (!transitions[call.status].includes(status)) return call;
  const updated = { ...call, status };
  if (status === "connected") updated.startedAt = now;
  if (terminal(status)) {
    updated.endedAt = now;
    updated.duration =
      call.startedAt === undefined
        ? 0
        : Math.max(0, Math.floor((now - call.startedAt) / 1000));
    if (call.consent) updated.messages = messages;
    else delete updated.messages;
  }
  return updated;
}
export function reconcile(calls: Call[], now: number): Call[] {
  if (calls.some((c) => c.status === "connected" || c.status === "calling"))
    return calls;
  const due = calls
    .filter((c) => c.status === "scheduled" && c.scheduledAt <= now)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  return due
    ? calls.map((c) => (c.id === due.id ? transition(c, "calling", now) : c))
    : calls;
}
export function nextTime(hour: number, minute: number, now = Date.now()) {
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  )
    throw new Error("올바른 시간을 입력해 주세요.");
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}
export function localSchedule(date: string, time: string, now = Date.now()) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new Error("날짜와 시간을 확인해 주세요.");
  const [y, m, d] = date.split("-").map(Number),
    [h, min] = time.split(":").map(Number);
  const value = new Date(y, m - 1, d, h, min);
  if (
    value.getFullYear() !== y ||
    value.getMonth() !== m - 1 ||
    value.getDate() !== d ||
    value.getHours() !== h ||
    value.getMinutes() !== min
  )
    throw new Error("존재하지 않는 날짜 또는 시간이에요.");
  if (value.getTime() <= now)
    throw new Error("앞으로 받을 시간을 선택해 주세요.");
  if (value.getTime() > now + 366 * 86400000)
    throw new Error("1년 이내로 예약해 주세요.");
  return value.getTime();
}
export function countdown(target: number, now: number) {
  const v = Math.max(0, Math.ceil((target - now) / 1000));
  return [Math.floor(v / 3600), Math.floor(v / 60) % 60, v % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(" : ");
}
export const elapsed = (seconds = 0) =>
  `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
export function demoSummary(call: Call, messages: Message[]) {
  const facts = rememberedFacts(messages);
  const candidates = quoteCandidates({ ...call, messages });
  return {
    summary:
      call.consent && call.memoryConsent && facts.length
        ? facts.join("\n").slice(0, 600)
        : undefined,
    quote:
      candidates.find(
        (t) => call.mustSayPhrase && t.includes(call.mustSayPhrase),
      ) ?? candidates.at(-1),
  };
}
