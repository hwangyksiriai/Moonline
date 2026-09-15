import type { Repository } from "./repository.ts";
import type { Config } from "./config.ts";
import type { PhoneProvider } from "./providers.ts";
import { pushReminder, summarize } from "./providers.ts";
import type { ServerCall } from "./types.ts";
import { terminal } from "../../shared/model.ts";
export async function finishCall(
  repo: Repository,
  id: string,
  status: "completed" | "failed" | "cancelled",
  duration?: number,
  reason?: string,
) {
  return repo.mutate(id, (c) => {
    if (terminal(c.status)) return;
    return {
      ...c,
      status,
      endedAt: Date.now(),
      duration:
        duration ??
        (c.startedAt
          ? Math.max(0, Math.floor((Date.now() - c.startedAt) / 1000))
          : 0),
      failureReason: reason,
      summaryState: c.consent && status === "completed" ? "pending" : undefined,
    };
  });
}
export async function dispatch(
  id: string,
  repo: Repository,
  phone: PhoneProvider,
  config: Config,
  now = Date.now(),
) {
  const c = await repo.claim(id, now);
  if (!c) return;
  try {
    const p = await repo.profile(c.userId);
    if (!p) throw new Error("Profile unavailable");
    const sid = await phone.dial(c, p);
    await repo.mutate(id, (current) => ({ ...current, providerCallId: sid }));
    return sid;
  } catch {
    await finishCall(
      repo,
      id,
      "failed",
      0,
      "전화 연결을 시작하지 못했어요. 번호 또는 통화 서비스 설정을 확인해 주세요.",
    );
  }
}
export function createWorker(
  repo: Repository,
  phone: PhoneProvider,
  config: Config,
) {
  let running = false;
  async function tick(now = Date.now()) {
    if (running) return;
    running = true;
    try {
      const calls = (await repo.list()).sort(
        (a, b) => a.scheduledAt - b.scheduledAt,
      );
      for (const c of calls) {
        try {
          if (c.status === "scheduled") {
            if (c.scheduledAt <= now) {
              if (now - c.scheduledAt > 15 * 60000)
                await finishCall(
                  repo,
                  c.id,
                  "failed",
                  0,
                  "예약 시각에 서버가 연결되지 않아 전화를 건너뛰었어요.",
                );
              else await dispatch(c.id, repo, phone, config, now);
            } else
              for (const minutes of [30, 5]) {
                const difference = c.scheduledAt - now;
                if (
                  difference <= minutes * 60000 &&
                  difference > (minutes - 1) * 60000
                ) {
                  const claimed = await repo.mutate(c.id, (current) =>
                    current.status === "scheduled" &&
                    !(current.reminders ?? []).includes(minutes)
                      ? {
                          ...current,
                          reminders: [...(current.reminders ?? []), minutes],
                        }
                      : undefined,
                  );
                  if (claimed) {
                    const p = await repo.profile(c.userId);
                    if (p) await pushReminder(p, c, minutes, config);
                  }
                }
              }
          }
          if (
            config.demo &&
            c.status === "calling" &&
            now - (c.claimedAt ?? now) > 60000
          )
            await finishCall(
              repo,
              c.id,
              "failed",
              0,
              "응답하지 않은 데모 전화",
            );
          if (
            !config.demo &&
            ["calling", "connected"].includes(c.status) &&
            now - (c.claimedAt ?? now) > (config.maxCallSeconds + 120) * 1000
          ) {
            if (c.providerCallId) {
              const status = await phone.status(c.providerCallId);
              if (["queued", "ringing", "in-progress"].includes(status))
                await phone.hangup(c.providerCallId);
            }
            await finishCall(
              repo,
              c.id,
              "failed",
              undefined,
              "연결 시간이 만료되어 통화를 마쳤어요.",
            );
          }
          if (
            c.summaryState === "pending" ||
            (c.summaryState === "processing" &&
              now - (c.summaryClaimedAt ?? 0) > 120000)
          ) {
            const claimed = await repo.mutate(c.id, (current) =>
              current.consent &&
              (current.summaryState === "pending" ||
                (current.summaryState === "processing" &&
                  now - (current.summaryClaimedAt ?? 0) > 120000))
                ? {
                    ...current,
                    summaryState: "processing",
                    summaryClaimedAt: now,
                  }
                : undefined,
            );
            if (claimed) {
              try {
                const result = await summarize(claimed, config);
                const saved = await repo.mutate(c.id, (current) =>
                  current.consent && current.summaryState === "processing"
                    ? {
                        ...current,
                        summaryState: "ready",
                        quote: result.quote || undefined,
                        summary: current.memoryConsent
                          ? result.summary
                          : undefined,
                      }
                    : undefined,
                );
                if (saved) await repo.saveMemory(saved);
              } catch {
                await repo.mutate(c.id, (current) =>
                  current.summaryState === "processing"
                    ? { ...current, summaryState: "failed" }
                    : undefined,
                );
              }
            }
          }
        } catch {
          console.error("Call job failed", c.id);
        }
      }
    } finally {
      running = false;
    }
  }
  return {
    tick,
    start() {
      const timer = setInterval(
        () => void tick().catch(() => console.error("Scheduler unavailable")),
        1000,
      );
      return () => clearInterval(timer);
    },
  };
}
