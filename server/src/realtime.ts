import type { Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import twilio from "twilio";
import type { Config } from "./config.ts";
import type { Repository } from "./repository.ts";
import type { PhoneProvider } from "./providers.ts";
import type { ServerCall } from "./types.ts";
import type { Message } from "../../shared/model.ts";
import { terminal } from "../../shared/model.ts";
import { voiceOf } from "../../shared/catalog.ts";
import { validToken } from "./security.ts";
import { systemPrompt } from "./prompt.ts";
import { finishCall } from "./worker.ts";
export function attachRealtime(
  server: Server,
  repo: Repository,
  phone: PhoneProvider,
  config: Config,
  connectAI: (url: string, options: WebSocket.ClientOptions) => WebSocket = (
    url,
    options,
  ) => new WebSocket(url, options),
) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  server.on("upgrade", (req, socket, head) => {
    const url = config.backendUrl + "/voice/stream";
    const signature = String(req.headers["x-twilio-signature"] ?? "");
    if (
      config.demo ||
      req.url !== "/voice/stream" ||
      !(
        twilio.validateRequest(config.twilioToken!, signature, url, {}) ||
        twilio.validateRequest(
          config.twilioToken!,
          signature,
          url.replace(/^https:/, "wss:"),
          {},
        )
      )
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });
  wss.on("connection", (twilioWs) => {
    let ai: WebSocket | undefined,
      call: ServerCall | undefined,
      streamId = "",
      ready = false,
      initializing = false,
      closing = false,
      failed = false,
      latestTimestamp = 0,
      outputStartedAt: number | undefined,
      lastItem = "",
      lastAudioMs = 0,
      queuedBytes = 0;
    const queue: string[] = [],
      messages: Message[] = [],
      seenTranscripts = new Set<string>();
    const sendAI = (event: unknown) => {
      if (ai?.readyState === WebSocket.OPEN) ai.send(JSON.stringify(event));
    };
    const sendPhone = (event: unknown) => {
      if (twilioWs.readyState === WebSocket.OPEN)
        twilioWs.send(JSON.stringify(event));
    };
    const watchdog = setTimeout(
      () => void close(true, "연결 시간이 초과되었어요."),
      (config.maxCallSeconds + 45) * 1000,
    );
    const handshake = setTimeout(() => {
      if (!ready) void close(true, "음성 연결을 준비하지 못했어요.");
    }, 20000);
    let persist: Promise<unknown> = Promise.resolve();
    function saveTranscript(
      speaker: "caller" | "you",
      text: unknown,
      id: unknown,
    ) {
      if (
        !call?.consent ||
        typeof text !== "string" ||
        typeof id !== "string" ||
        seenTranscripts.has(id) ||
        messages.length >= 500
      )
        return;
      seenTranscripts.add(id);
      messages.push({ speaker, text: text.slice(0, 4000), at: Date.now() });
      const copy = [...messages],
        callId = call.id;
      persist = persist
        .catch(() => {})
        .then(() =>
          repo.mutate(callId, (c) =>
            c.consent
              ? {
                  ...c,
                  messages: copy,
                  ...(c.status === "completed"
                    ? { summaryState: "pending" as const }
                    : {}),
                }
              : undefined,
          ),
        );
    }
    async function close(asFailure = false, reason?: string) {
      if (closing) return;
      closing = true;
      failed = asFailure;
      clearTimeout(watchdog);
      clearTimeout(handshake);
      if (ai) {
        ai.removeAllListeners("message");
        ai.close();
      }
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
      queue.length = 0;
      if (call) {
        try {
          await persist;
          if (asFailure && call.providerCallId)
            await phone.hangup(call.providerCallId);
          await finishCall(
            repo,
            call.id,
            asFailure ? "failed" : "completed",
            undefined,
            reason,
          );
        } catch {
          console.error("Stream finalization failed", call.id);
        }
      }
      messages.length = 0;
    }
    async function start(data: any) {
      if (initializing || call) return;
      initializing = true;
      const id = data.start?.customParameters?.callId,
        token = data.start?.customParameters?.token,
        sid = data.start?.callSid;
      if (
        typeof id !== "string" ||
        !validToken(id, token, config.signingSecret) ||
        data.start?.accountSid !== config.twilioSid ||
        data.start?.mediaFormat?.encoding !== "audio/x-mulaw" ||
        data.start?.mediaFormat?.sampleRate !== 8000
      )
        throw new Error("Invalid stream start");
      const found = await repo.get(id);
      if (
        !found ||
        terminal(found.status) ||
        found.status === "scheduled" ||
        found.providerCallId !== sid
      )
        throw new Error("Unknown call");
      streamId = String(data.start.streamSid ?? "");
      if (!/^MZ[a-fA-F0-9]{32}$/.test(streamId))
        throw new Error("Invalid stream ID");
      const claimed = await repo.mutate(id, (c) =>
        !c.streamSid && !terminal(c.status)
          ? {
              ...c,
              streamSid: streamId,
              status: "connected",
              startedAt: c.startedAt ?? Date.now(),
            }
          : undefined,
      );
      if (!claimed) throw new Error("Stream already claimed");
      call = claimed;
      const profile = await repo.profile(call.userId);
      if (!profile) throw new Error("Missing profile");
      const history = profile.memoryEnabled
        ? (await repo.list(call.userId))
            .filter(
              (c) =>
                c.id !== id &&
                c.memoryConsent &&
                c.summary &&
                (call!.characterId
                  ? c.characterId === call!.characterId
                  : c.voice === call!.voice &&
                    c.scenarioId === call!.scenarioId),
            )
            .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
        : [];
      if (closing) return;
      ai = connectAI(
        "wss://api.openai.com/v1/realtime?model=" +
          encodeURIComponent(config.realtimeModel),
        {
          headers: { Authorization: `Bearer ${config.openaiKey}` },
          handshakeTimeout: 15000,
          maxPayload: 2 * 1024 * 1024,
        },
      );
      ai.on("open", () =>
        sendAI({
          type: "session.update",
          session: {
            type: "realtime",
            model: config.realtimeModel,
            output_modalities: ["audio"],
            instructions: systemPrompt(call!, profile, history[0]?.summary),
            audio: {
              input: {
                format: { type: "audio/pcmu" },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 600,
                  interrupt_response: true,
                  create_response: true,
                },
                ...(call!.consent
                  ? {
                      transcription: {
                        model: "gpt-4o-mini-transcribe",
                        language: "ko",
                      },
                    }
                  : {}),
              },
              output: {
                format: { type: "audio/pcmu" },
                voice: voiceOf(call!.voice).realtimeVoice,
              },
            },
          },
        }),
      );
      ai.on("message", (raw) => {
        try {
          const e = JSON.parse(raw.toString());
          if (e.type === "session.updated" && !ready) {
            ready = true;
            clearTimeout(handshake);
            for (const audio of queue)
              sendAI({ type: "input_audio_buffer.append", audio });
            queue.length = 0;
            queuedBytes = 0;
            sendAI({
              type: "response.create",
              response: {
                instructions:
                  "먼저 아주 짧게 여보세요? 라고 말하고 사용자의 반응을 기다리세요.",
              },
            });
          } else if (
            e.type === "response.output_audio.delta" &&
            typeof e.delta === "string"
          ) {
            if (twilioWs.bufferedAmount > 1024 * 1024) {
              void close(true, "음성 연결이 지연되어 통화를 마쳤어요.");
              return;
            }
            if (e.item_id !== lastItem) {
              lastItem = e.item_id;
              outputStartedAt = latestTimestamp;
              lastAudioMs = 0;
            }
            lastAudioMs += Buffer.from(e.delta, "base64").length / 8;
            sendPhone({
              event: "media",
              streamSid: streamId,
              media: { payload: e.delta },
            });
          } else if (e.type === "input_audio_buffer.speech_started") {
            sendPhone({ event: "clear", streamSid: streamId });
            if (lastItem && outputStartedAt !== undefined) {
              const played = Math.min(
                lastAudioMs,
                Math.max(0, latestTimestamp - outputStartedAt),
              );
              sendAI({
                type: "conversation.item.truncate",
                item_id: lastItem,
                content_index: 0,
                audio_end_ms: Math.floor(played),
              });
              lastItem = "";
              outputStartedAt = undefined;
            }
          } else if (
            e.type === "conversation.item.input_audio_transcription.completed"
          )
            saveTranscript("you", e.transcript, e.item_id);
          else if (e.type === "response.output_audio_transcript.done")
            saveTranscript("caller", e.transcript, e.item_id);
          else if (e.type === "error") {
            void close(
              true,
              "대화를 연결하지 못했어요. 잠시 후 다시 예약해 주세요.",
            );
          }
        } catch {
          void close(true, "음성 응답을 처리하지 못했어요.");
        }
      });
      ai.on(
        "error",
        () => void close(true, "음성 서비스에 연결하지 못했어요."),
      );
      ai.on("close", () => {
        if (!closing) void close(true, "음성 연결이 종료되었어요.");
      });
    }
    twilioWs.on("message", (raw) => {
      try {
        const e = JSON.parse(raw.toString());
        if (e.event === "start")
          void start(e).catch(
            () => void close(true, "전화 정보를 확인하지 못했어요."),
          );
        else if (e.event === "media" && typeof e.media?.payload === "string") {
          latestTimestamp = Number(e.media.timestamp) || latestTimestamp;
          if (ready) {
            if ((ai?.bufferedAmount ?? 0) > 1024 * 1024) {
              void close(true, "통신이 지연되고 있어요.");
              return;
            }
            sendAI({
              type: "input_audio_buffer.append",
              audio: e.media.payload,
            });
          } else {
            queuedBytes += e.media.payload.length;
            if (queuedBytes > 256000) {
              void close(true, "연결 대기 시간이 초과되었어요.");
              return;
            }
            queue.push(e.media.payload);
          }
        } else if (e.event === "stop") void close();
      } catch {
        void close(true, "잘못된 전화 데이터");
      }
    });
    twilioWs.on("error", () => void close(true, "전화 연결이 끊겼어요."));
    twilioWs.on("close", () => void close(failed));
  });
  return wss;
}
