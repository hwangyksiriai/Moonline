import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  type Call,
  type CallDraft,
  type Profile,
  type Message,
  reconcile,
  transition,
  demoSummary,
} from "../../shared/model";
import { api } from "../services/api";
import { DEMO } from "../services/config";
import { supabase, handleAuthUrl } from "../services/auth";
import * as Linking from "expo-linking";
import { cancelReminder, scheduleReminder } from "../services/notifications";
import { loadCalls } from "../services/storage";
// Keep the original storage key so rebranding preserves existing local demo data.
const KEY = "bampyeonji.demo.v2";
type State = { calls: Call[]; profile: Profile | null; onboarded: boolean };
const empty: State = { calls: [], profile: null, onboarded: false };
export function useNight() {
  useEffect(() => {
    if (!supabase || Platform.OS === "web") return;
    const onUrl = (url: string) =>
      void handleAuthUrl(url).catch(() =>
        setError("확인 링크가 만료되었어요. 다시 로그인해 주세요."),
      );
    void Linking.getInitialURL().then((url) => {
      if (url) onUrl(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => onUrl(url));
    return () => sub.remove();
  }, []);
  const [state, setState] = useState<State>(empty),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [working, setWorking] = useState(false),
    [now, setNow] = useState(Date.now());
  const ref = useRef(state),
    chain = useRef<Promise<unknown>>(Promise.resolve()),
    polling = useRef(false),
    generation = useRef(0);
  const apply = (next: State) => {
    ref.current = next;
    setState(next);
  };
  async function local(fn: (s: State) => State) {
    const job = chain.current
      .catch(() => {})
      .then(async () => {
        const next = fn(ref.current);
        if (next === ref.current) return;
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
        apply(next);
      });
    chain.current = job;
    return job;
  }
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setError("");
    setWorking(true);
    try {
      return await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "처리하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      setWorking(false);
    }
  }
  async function refresh() {
    if (DEMO) return;
    if (polling.current) return;
    polling.current = true;
    const token = generation.current;
    try {
      const [calls, profile] = await Promise.all([
        api<Call[]>("/calls"),
        api<Profile>("/me"),
      ]);
      if (token === generation.current)
        apply({ calls, profile, onboarded: true });
    } finally {
      polling.current = false;
    }
  }
  async function hydrate() {
    await run(async () => {
      if (DEMO) {
        const raw = await AsyncStorage.getItem(KEY);
        let data: State;
        if (raw) {
          data = JSON.parse(raw);
          if (
            !Array.isArray(data.calls) ||
            typeof data.onboarded !== "boolean" ||
            !data.calls.every(
              (c) =>
                typeof c.id === "string" &&
                Number.isFinite(c.scheduledAt) &&
                typeof c.status === "string",
            )
          )
            throw new Error(
              "저장된 데이터를 읽지 못했어요. 앱 데이터를 확인해 주세요.",
            );
        } else data = { ...empty, calls: await loadCalls() };
        data.calls = data.calls.map((c) =>
          c.status === "connected"
            ? {
                ...transition(c, "failed"),
                failureReason: "앱이 종료되어 통화가 끝났어요.",
              }
            : c,
        );
        await AsyncStorage.setItem(KEY, JSON.stringify(data));
        apply(data);
      } else if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await api("/auth", "POST", {});
          await refresh();
        } else
          apply({
            ...empty,
            onboarded:
              (await AsyncStorage.getItem("night.onboarded")) === "true",
          });
      } else apply({ ...empty, onboarded: true });
      setLoaded(true);
    });
  }
  useEffect(() => {
    void hydrate();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        generation.current++;
        apply({ ...empty, onboarded: true });
      } else if (event === "SIGNED_IN" && session)
        setTimeout(
          () =>
            void run(async () => {
              await api("/auth", "POST", {});
              await refresh();
            }),
          0,
        );
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const tick = () => {
      setNow(Date.now());
      if (Platform.OS !== "web" && AppState.currentState !== "active") return;
      if (DEMO) {
        const next = reconcile(ref.current.calls, Date.now());
        if (next !== ref.current.calls)
          void local((s) => ({
            ...s,
            calls: reconcile(s.calls, Date.now()),
          })).catch(() =>
            setError("예약을 열지 못했어요. 저장 공간을 확인해 주세요."),
          );
      } else if (ref.current.profile)
        void refresh().catch(() =>
          setNote("연결을 다시 확인하고 있어요. 잠시 후 자동으로 갱신해요."),
        );
    };
    tick();
    const timer = setInterval(tick, DEMO ? 1000 : 3000);
    const sub = AppState.addEventListener("change", (v) => {
      if (v === "active") {
        supabase?.auth.startAutoRefresh();
        tick();
      } else supabase?.auth.stopAutoRefresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [loaded]);
  async function finishOnboarding() {
    return run(async () => {
      if (DEMO) await local((s) => ({ ...s, onboarded: true }));
      else {
        await AsyncStorage.setItem("night.onboarded", "true");
        apply({ ...ref.current, onboarded: true });
      }
    });
  }
  async function enterDemo(name: string) {
    return run(() =>
      local((s) => ({
        ...s,
        profile: s.profile ?? {
          id: Crypto.randomUUID(),
          name: name.trim() || "밤의 여행자",
          email: "",
          createdAt: Date.now(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          memoryEnabled: true,
          notificationsEnabled: true,
        },
      })),
    );
  }
  async function saveProfile(patch: Partial<Profile>) {
    return run(async () => {
      if (DEMO)
        await local((s) => ({
          ...s,
          profile: s.profile ? { ...s.profile, ...patch } : null,
        }));
      else {
        await api("/me", "PATCH", patch);
        await refresh();
      }
    });
  }
  async function book(draft: CallDraft, id?: string) {
    return run(async () => {
      const callId = id ?? Crypto.randomUUID();
      if (DEMO) {
        await local((s) => {
          const existing = s.calls.find((c) => c.id === callId);
          if (existing && existing.status !== "scheduled")
            throw new Error("이미 도착한 전화는 수정할 수 없어요.");
          if (
            !existing &&
            s.calls.filter((c) => c.status === "scheduled").length >= 10
          )
            throw new Error("한 번에 최대 10통까지 예약할 수 있어요.");
          const call: Call = {
            ...existing,
            ...draft,
            characterId:
              draft.characterId ?? existing?.characterId ?? Crypto.randomUUID(),
            id: callId,
            createdAt: existing?.createdAt ?? Date.now(),
            status: "scheduled",
          };
          return {
            ...s,
            calls: [call, ...s.calls.filter((c) => c.id !== callId)],
          };
        });
        const c = ref.current.calls.find((c) => c.id === callId)!;
        if (ref.current.profile?.notificationsEnabled) {
          const reminderNote = await scheduleReminder(c);
          setNote(Platform.OS === "web" ? "" : (reminderNote ?? ""));
          if (
            ref.current.calls.find((c) => c.id === callId)?.status !==
            "scheduled"
          )
            await cancelReminder(callId);
        }
      } else {
        await api(id ? "/calls/" + id : "/calls", id ? "PATCH" : "POST", {
          ...draft,
          id: callId,
        });
        await refresh();
      }
      return callId;
    });
  }
  async function cancel(id: string) {
    return run(async () => {
      if (DEMO)
        await local((s) => ({
          ...s,
          calls: s.calls.map((c) =>
            c.id === id ? transition(c, "cancelled") : c,
          ),
        }));
      else await api("/calls/" + id, "DELETE");
      try {
        await cancelReminder(id);
      } catch {
        setNote("알림 취소를 확인하지 못했어요. 예약은 취소되었습니다.");
      }
      if (!DEMO) await refresh();
      return true;
    });
  }
  async function accept(id: string) {
    return run(async () => {
      await local((s) => ({
        ...s,
        calls: s.calls.map((c) =>
          c.id === id ? transition(c, "connected") : c,
        ),
      }));
      await cancelReminder(id).catch(() => {});
      return true;
    });
  }
  async function complete(id: string, messages: Message[]) {
    return run(async () => {
      if (DEMO)
        await local((s) => ({
          ...s,
          calls: s.calls.map((c) =>
            c.id === id
              ? {
                  ...transition(c, "completed", Date.now(), messages),
                  ...demoSummary(c, messages),
                }
              : c,
          ),
        }));
      else {
        await api("/calls/" + id + "/complete", "POST");
        await refresh();
      }
      return true;
    });
  }
  async function favorite(id: string) {
    return run(async () => {
      if (DEMO)
        await local((s) => ({
          ...s,
          calls: s.calls.map((c) =>
            c.id === id ? { ...c, favorite: !c.favorite } : c,
          ),
        }));
      else {
        const c = ref.current.calls.find((c) => c.id === id);
        await api("/calls/" + id, "PATCH", { favorite: !c?.favorite });
        await refresh();
      }
    });
  }
  async function editKeepsake(
    id: string,
    patch: { summary?: string; memoryConsent?: boolean; quote?: string | null },
  ) {
    return run(async () => {
      if (DEMO)
        await local((s) => ({
          ...s,
          calls: s.calls.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...patch,
                  quote:
                    patch.quote === null ? undefined : (patch.quote ?? c.quote),
                  favorite: patch.quote === null ? false : c.favorite,
                }
              : c,
          ),
        }));
      else {
        await api("/calls/" + id + "/keepsake", "PATCH", patch);
        await refresh();
      }
      return true;
    });
  }
  async function forget(id: string) {
    return run(async () => {
      if (DEMO)
        await local((s) => ({
          ...s,
          calls: s.calls.map((c) =>
            c.id === id
              ? {
                  ...c,
                  messages: undefined,
                  summary: undefined,
                  quote: undefined,
                  consent: false,
                  memoryConsent: false,
                  favorite: false,
                }
              : c,
          ),
        }));
      else {
        await api("/calls/" + id + "/memory", "DELETE");
        await refresh();
      }
    });
  }
  return {
    ...state,
    loaded,
    error,
    note,
    working,
    now,
    refresh: () => run(refresh),
    hydrate,
    finishOnboarding,
    enterDemo,
    saveProfile,
    book,
    cancel,
    accept,
    complete,
    favorite,
    forget,
    editKeepsake,
    setError,
    setNote,
  };
}
export type Night = ReturnType<typeof useNight>;
