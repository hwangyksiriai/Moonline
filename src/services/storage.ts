import AsyncStorage from "@react-native-async-storage/async-storage";
import { Call } from "../domain/calls";
// Keep the original storage key so rebranding preserves existing local demo data.
const KEY = "bampyeonji.calls.v1";
export async function loadCalls(): Promise<Call[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (
    !Array.isArray(data) ||
    !data.every(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.voice === "string" &&
        typeof c.situation === "string" &&
        Number.isFinite(c.scheduledAt) &&
        typeof c.consent === "boolean" &&
        [
          "scheduled",
          "calling",
          "connected",
          "completed",
          "cancelled",
          "failed",
        ].includes(c.status),
    )
  )
    throw new Error("저장된 기록을 읽지 못했습니다. 다시 시도해 주세요.");
  return data as Call[];
}
export const saveCalls = (calls: Call[]) =>
  AsyncStorage.setItem(KEY, JSON.stringify(calls));
