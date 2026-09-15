import { voiceStudio } from "./voiceStudio.ts";
import { quoteCandidates } from "../../shared/memory.ts";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import twilio from "twilio";
import { z, ZodError } from "zod";
import { scenarios, voices } from "../../shared/catalog.ts";
import { terminal, transition, type Message } from "../../shared/model.ts";
import type { Config } from "./config.ts";
import type { Repository } from "./repository.ts";
import type { PhoneProvider } from "./providers.ts";
import { previewAudio, streamTwiml } from "./providers.ts";
import {
  publicCall,
  publicProfile,
  type ServerProfile,
  type ServerCall,
} from "./types.ts";
import { dispatch, finishCall } from "./worker.ts";
import { signToken, validToken } from "./security.ts";
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const tz = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "시간대가 올바르지 않아요.");
const fields = {
  voice: z.enum(voices.map((v) => v.name) as [string, ...string[]]),
  scenarioId: z.enum(scenarios.map((s) => s.id) as [string, ...string[]]),
  situation: z.string().trim().min(1).max(1000),
  relationship: z.string().trim().min(1).max(80),
  personality: z.array(z.string().max(40)).max(8),
  mustSayPhrase: z.string().max(200).optional(),
  characterId: z.uuid().optional(),
  characterName: z.string().max(40).optional(),
  backstory: z.string().max(1000).optional(),
  greeting: z.string().max(300).optional(),
  userNickname: z.string().max(40).optional(),
  anniversary: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  scheduledAt: z.number().finite(),
  timezone: tz,
  consent: z.boolean(),
  memoryConsent: z.boolean().default(false),
};
const createBody = z.object({ id: z.uuid(), ...fields });
const transcript = z
  .array(
    z.object({
      speaker: z.enum(["you", "caller"]),
      text: z.string().max(4000),
      at: z.number().optional(),
    }),
  )
  .max(500);
export function createApp(
  config: Config,
  repo: Repository,
  phone: PhoneProvider,
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.cors.includes(origin)),
    }),
  );
  app.use(express.json({ limit: "128kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  const sessions = new Map<string, { id: string; expires: number }>(),
    pendingPhones = new Map<string, { phone: string; expires: number }>(),
    audioCache = new Map<string, Buffer>(),
    audioJobs = new Map<string, Promise<Buffer>>();
  const sb = !config.demo
    ? createClient(config.supabaseUrl!, config.supabaseKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
  app.get("/health", (_, res) =>
    res.json({
      ok: true,
      mode: config.demo ? "demo" : "real",
      phone: !config.demo,
      version: "0.2.0",
    }),
  );
  app.get("/scenarios", (_, res) => res.json(scenarios));
  app.get("/voices", (_, res) =>
    res.json(
      voices.map((v) => ({
        id: v.name,
        name: v.name,
        description: v.description,
        preview_url: `/voices/${v.name}/preview`,
      })),
    ),
  );
  app.post("/voice/stream", (_, res) =>
    res.status(426).json({ error: "WebSocket upgrade required" }),
  );
  function checkTwilio(req: express.Request) {
    if (
      config.demo ||
      !twilio.validateRequest(
        config.twilioToken!,
        req.header("x-twilio-signature") ?? "",
        config.backendUrl + req.originalUrl,
        req.body,
      )
    )
      throw new HttpError(403, "Invalid voice signature");
  }
  async function callbackCall(req: express.Request) {
    checkTwilio(req);
    const id = z.uuid().parse(req.query.callId),
      sid = z
        .string()
        .regex(/^CA[a-fA-F0-9]{32}$/)
        .parse(req.body.CallSid);
    const c = await repo.get(id);
    if (
      !c ||
      c.status === "scheduled" ||
      c.status === "draft" ||
      (c.providerCallId && c.providerCallId !== sid)
    )
      throw new HttpError(404, "Call unavailable");
    if (!c.providerCallId)
      await repo.mutate(c.id, (current) => ({
        ...current,
        providerCallId: sid,
      }));
    return c;
  }
  app.post("/voice/webhook", async (req, res) => {
    const c = await callbackCall(req);
    if (terminal(c.status))
      return res.type("text/xml").send("<Response><Hangup/></Response>");
    res.type("text/xml").send(streamTwiml(c, config));
  });
  app.post("/voice/status", async (req, res) => {
    const c = await callbackCall(req);
    const state = req.body.CallStatus;
    if (state === "in-progress")
      await repo.mutate(c.id, (current) =>
        current.status === "calling"
          ? { ...current, status: "connected", startedAt: Date.now() }
          : undefined,
      );
    else if (
      ["completed", "busy", "failed", "no-answer", "canceled"].includes(state)
    ) {
      const duration = Number(req.body.CallDuration);
      await finishCall(
        repo,
        c.id,
        state === "completed"
          ? "completed"
          : state === "canceled"
            ? "cancelled"
            : "failed",
        Number.isFinite(duration) && duration >= 0 ? duration : undefined,
        state === "completed"
          ? undefined
          : "전화를 연결하지 못했어요. 다시 예약해 주세요.",
      );
    }
    res.sendStatus(204);
  });
  const authRate = rateLimit({
    windowMs: 60000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.post("/auth", authRate, async (req, res, next) => {
    if (!config.demo) return next();
    const { name } = z
      .object({ name: z.string().max(40).default("밤의 여행자") })
      .parse(req.body);
    const id = randomUUID(),
      token = randomBytes(32).toString("base64url");
    for (const [key, value] of sessions)
      if (value.expires < Date.now()) sessions.delete(key);
    if (sessions.size > 1000)
      throw new HttpError(429, "잠시 후 다시 시도해 주세요.");
    sessions.set(token, { id, expires: Date.now() + 86400000 });
    const p: ServerProfile = {
      id,
      name,
      email: "",
      timezone: "Asia/Seoul",
      createdAt: Date.now(),
      memoryEnabled: true,
      notificationsEnabled: true,
    };
    await repo.putProfile(p);
    res.status(201).json({ token, profile: publicProfile(p) });
  });
  app.get("/voice-preview/:name", async (req, res) => {
    const name = z
        .enum(voices.map((v) => v.name) as [string, ...string[]])
        .parse(req.params.name),
      expires = Number(req.query.expires);
    if (
      !Number.isFinite(expires) ||
      expires < Date.now() ||
      expires > Date.now() + 301000 ||
      !validToken(`${name}:${expires}`, req.query.token, config.signingSecret)
    )
      throw new HttpError(403, "Preview expired");
    const bytes = audioCache.get(name);
    if (!bytes) throw new HttpError(404, "Preview unavailable");
    res
      .set("Cache-Control", "private, max-age=60")
      .type("audio/mpeg")
      .send(bytes);
  });
  app.use(async (req, res, next) => {
    const token = req.header("authorization")?.replace(/^Bearer /, "");
    if (!token) throw new HttpError(401, "로그인이 필요해요.");
    let id: string;
    if (config.demo) {
      const session = sessions.get(token);
      if (!session || session.expires < Date.now())
        throw new HttpError(401, "세션이 만료되었어요.");
      id = session.id;
    } else {
      const { data, error } = await sb!.auth.getUser(token);
      if (error || !data.user)
        throw new HttpError(401, "로그인을 다시 해주세요.");
      id = data.user.id;
      if (!(await repo.profile(id)))
        await repo.putProfile({
          id,
          name: String(data.user.user_metadata.name ?? "밤의 여행자").slice(
            0,
            40,
          ),
          email: data.user.email ?? "",
          timezone: "Asia/Seoul",
          createdAt: Date.now(),
          memoryEnabled: true,
          notificationsEnabled: true,
        });
    }
    res.locals.userId = id;
    next();
  });
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 180,
      keyGenerator: (_, res) => res.locals.userId as string,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/voice-studio", voiceStudio(config, repo));
  app.post("/auth", async (_, res) =>
    res.json(publicProfile((await repo.profile(res.locals.userId))!)),
  );
  async function owned(id: string, user: string) {
    const c = await repo.get(z.uuid().parse(id));
    if (!c || c.userId !== user)
      throw new HttpError(404, "전화를 찾지 못했어요.");
    return c;
  }
  app.get("/me", async (_, res) =>
    res.json(publicProfile((await repo.profile(res.locals.userId))!)),
  );
  app.patch("/me", async (req, res) => {
    const patch = z
      .object({
        name: z.string().trim().min(1).max(40).optional(),
        timezone: tz.optional(),
        memoryEnabled: z.boolean().optional(),
        notificationsEnabled: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    const p = (await repo.profile(res.locals.userId))!;
    const next = { ...p, ...patch };
    await repo.putProfile(next);
    res.json(publicProfile(next));
  });
  app.post("/me/push-token", async (req, res) => {
    const { token } = z
      .object({
        token: z
          .string()
          .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/),
      })
      .parse(req.body);
    await repo.putProfile({
      ...(await repo.profile(res.locals.userId))!,
      pushToken: token,
    });
    res.sendStatus(204);
  });
  const verifyRate = rateLimit({
    windowMs: 15 * 60000,
    limit: 8,
    keyGenerator: (_, res) => res.locals.userId as string,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  const phoneSchema = z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .refine(
      (v) => config.phonePrefixes.some((p) => v.startsWith(p)),
      "지원하는 국가번호를 확인해 주세요.",
    );
  app.post("/me/phone/start", verifyRate, async (req, res) => {
    if (config.demo)
      throw new HttpError(409, "데모는 전화번호를 수집하지 않아요.");
    const { phone: to } = z.object({ phone: phoneSchema }).parse(req.body);
    await phone.sendCode(to);
    pendingPhones.set(res.locals.userId, {
      phone: to,
      expires: Date.now() + 600000,
    });
    res.json({ sent: true });
  });
  app.post("/me/phone/verify", verifyRate, async (req, res) => {
    const body = z
      .object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) })
      .parse(req.body);
    const pending = pendingPhones.get(res.locals.userId);
    if (
      !pending ||
      pending.phone !== body.phone ||
      pending.expires < Date.now()
    )
      throw new HttpError(400, "인증번호를 다시 요청해 주세요.");
    if (!(await phone.checkCode(body.phone, body.code)))
      throw new HttpError(400, "인증번호가 맞지 않아요.");
    await repo.putProfile({
      ...(await repo.profile(res.locals.userId))!,
      phone: body.phone,
      phoneVerified: true,
    });
    pendingPhones.delete(res.locals.userId);
    res.json({ verified: true });
  });
  app.get("/calls", async (_, res) =>
    res.json((await repo.list(res.locals.userId)).map(publicCall)),
  );
  app.post("/calls", async (req, res) => {
    const body = createBody.parse(req.body);
    const existing = await repo.get(body.id);
    if (existing) {
      if (existing.userId !== res.locals.userId)
        throw new HttpError(409, "예약 ID가 이미 사용 중이에요.");
      return res.json(publicCall(existing));
    }
    if (
      body.scheduledAt < Date.now() + 5000 ||
      body.scheduledAt > Date.now() + 366 * 86400000
    )
      throw new HttpError(400, "5초 뒤부터 1년 이내의 시간을 골라주세요.");
    const p = (await repo.profile(res.locals.userId))!;
    if (!config.demo && !p.phoneVerified)
      throw new HttpError(400, "전화번호를 인증해 주세요.");
    const calls = await repo.list(p.id);
    if (calls.filter((c) => c.status === "scheduled").length >= 10)
      throw new HttpError(429, "한 번에 최대 10통까지 예약할 수 있어요.");
    const day = new Date(body.scheduledAt).toLocaleDateString("en-CA", {
      timeZone: body.timezone,
    });
    if (
      calls.filter(
        (c) =>
          c.status !== "cancelled" &&
          new Date(c.scheduledAt).toLocaleDateString("en-CA", {
            timeZone: body.timezone,
          }) === day,
      ).length >= config.maxDailyCalls
    )
      throw new HttpError(429, "하루 예약 한도에 도달했어요.");
    const c = await repo.create({
      ...body,
      characterId: body.characterId ?? randomUUID(),
      userId: p.id,
      version: 0,
      status: "scheduled",
      createdAt: Date.now(),
      memoryConsent: body.consent && body.memoryConsent,
    });
    res.status(201).json(publicCall(c));
  });
  app.get("/calls/:id", async (req, res) =>
    res.json(publicCall(await owned(req.params.id, res.locals.userId))),
  );
  app.patch("/calls/:id", async (req, res) => {
    const c = await owned(req.params.id, res.locals.userId);
    if (
      Object.keys(req.body).length === 1 &&
      typeof req.body.favorite === "boolean"
    ) {
      const result = await repo.mutate(c.id, (current) => {
        if (!current.quote) throw new HttpError(400, "저장할 한마디가 없어요.");
        return { ...current, favorite: req.body.favorite };
      });
      return res.json(publicCall(result!));
    }
    const body = z.object({ ...fields }).parse(req.body);
    if (
      body.scheduledAt < Date.now() + 5000 ||
      body.scheduledAt > Date.now() + 366 * 86400000
    )
      throw new HttpError(400, "예약 시간을 확인해 주세요.");
    const updated = await repo.mutate(c.id, (current) => {
      if (current.status !== "scheduled")
        throw new HttpError(409, "이미 시작된 전화는 수정할 수 없어요.");
      return {
        ...current,
        ...body,
        reminders: [],
        memoryConsent: body.consent && body.memoryConsent,
      };
    });
    res.json(publicCall(updated!));
  });
  app.delete("/calls/:id", async (req, res) => {
    const c = await owned(req.params.id, res.locals.userId);
    const next = await repo.mutate(c.id, (current) => {
      if (current.status === "cancelled") return current;
      if (
        current.status !== "scheduled" &&
        !(config.demo && current.status === "calling")
      )
        throw new HttpError(
          409,
          "이미 시작된 전화는 통화 종료를 이용해 주세요.",
        );
      return {
        ...current,
        status: "cancelled",
        endedAt: Date.now(),
        duration: 0,
      };
    });
    res.json(publicCall(next!));
  });
  app.post("/calls/:id/start", async (req, res) => {
    const c = await owned(req.params.id, res.locals.userId);
    if (c.scheduledAt > Date.now())
      throw new HttpError(409, "아직 예약 시각이 아니에요.");
    await dispatch(c.id, repo, phone, config);
    res.json(publicCall((await repo.get(c.id))!));
  });
  app.post("/calls/:id/accept", async (req, res) => {
    if (!config.demo)
      throw new HttpError(409, "실제 전화 화면에서 받아주세요.");
    const c = await owned(req.params.id, res.locals.userId);
    const next = await repo.mutate(c.id, (current) => ({
      ...current,
      ...transition(current, "connected"),
    }));
    res.json(publicCall(next!));
  });
  app.post("/calls/:id/complete", async (req, res) => {
    const c = await owned(req.params.id, res.locals.userId);
    if (terminal(c.status)) return res.json(publicCall(c));
    if (!["calling", "connected"].includes(c.status))
      throw new HttpError(409, "아직 시작되지 않은 전화예요.");
    if (config.demo) {
      const { messages } = z
        .object({ messages: transcript.default([]) })
        .parse(req.body);
      await repo.mutate(c.id, (current) => ({
        ...current,
        ...transition(current, "completed", Date.now(), messages),
        summaryState: current.consent ? "pending" : undefined,
      }));
    } else {
      if (!c.providerCallId)
        throw new HttpError(409, "전화 연결 정보를 기다리고 있어요.");
      await phone.hangup(c.providerCallId);
    }
    res.json(publicCall((await repo.get(c.id))!));
  });
  app.patch("/calls/:id/keepsake", async (req, res) => {
    const c = await owned(req.params.id, res.locals.userId);
    const patch = z
      .object({
        summary: z.string().trim().max(600).optional(),
        memoryConsent: z.boolean().optional(),
        quote: z.string().max(180).nullable().optional(),
      })
      .strict()
      .parse(req.body);
    const updated = await repo.mutate(c.id, (current) => {
      if (!terminal(current.status) || !current.consent)
        throw new HttpError(
          409,
          "저장에 동의한 통화가 끝난 뒤 편집할 수 있어요.",
        );
      if (
        current.summaryState === "processing" ||
        current.summaryState === "pending"
      )
        throw new HttpError(
          409,
          "기록을 정리하고 있어요. 잠시 후 다시 편집해 주세요.",
        );
      if (
        patch.quote != null &&
        !quoteCandidates(current).includes(patch.quote)
      )
        throw new HttpError(400, "이 통화에서 나눈 한마디를 골라주세요.");
      return {
        ...current,
        ...patch,
        quote:
          patch.quote === null ? undefined : (patch.quote ?? current.quote),
        favorite: patch.quote === null ? false : current.favorite,
        summaryState: "ready",
      };
    });
    await repo.saveMemory(updated!);
    res.json(publicCall(updated!));
  });
  app.delete("/calls/:id/memory", async (req, res) => {
    const c = await owned(req.params.id, res.locals.userId);
    if (!terminal(c.status))
      throw new HttpError(409, "통화가 끝난 뒤 삭제해 주세요.");
    const updated = await repo.mutate(c.id, (current) => ({
      ...current,
      consent: false,
      memoryConsent: false,
      messages: undefined,
      summary: undefined,
      quote: undefined,
      favorite: false,
      summaryState: undefined,
    }));
    await repo.saveMemory(updated!);
    res.json(publicCall(updated!));
  });
  app.post("/calls/:id/summary/retry", async (req, res) => {
    const c = await owned(req.params.id, res.locals.userId);
    if (c.status !== "completed" || !c.consent)
      throw new HttpError(409, "요약할 대화가 없어요.");
    await repo.mutate(c.id, (current) => ({
      ...current,
      summaryState: "pending",
    }));
    res.json({ queued: true });
  });
  app.get("/memories", async (_, res) =>
    res.json(
      (await repo.list(res.locals.userId))
        .filter((c) => c.memoryConsent && c.summary)
        .map((c) => ({
          callId: c.id,
          summary: c.summary,
          createdAt: c.endedAt,
        })),
    ),
  );
  app.get(
    "/voices/:name/preview",
    rateLimit({
      windowMs: 60000,
      limit: 10,
      keyGenerator: (_, res) => res.locals.userId as string,
    }),
    async (req, res) => {
      if (config.demo)
        throw new HttpError(409, "기기 읽기 음성을 이용해 주세요.");
      const name = z
        .enum(voices.map((v) => v.name) as [string, ...string[]])
        .parse(req.params.name);
      if (!audioCache.has(name)) {
        let job = audioJobs.get(name);
        if (!job) {
          job = previewAudio(name, config);
          audioJobs.set(name, job);
        }
        try {
          audioCache.set(name, await job);
        } finally {
          audioJobs.delete(name);
        }
      }
      const expires = Date.now() + 300000;
      res.json({
        url: `${config.backendUrl}/voice-preview/${name}?expires=${expires}&token=${signToken(`${name}:${expires}`, config.signingSecret)}`,
      });
    },
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof HttpError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof ZodError)
        return res.status(400).json({
          error: "입력값을 확인해 주세요.",
          fields: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
      console.error(
        "Request failed",
        error instanceof Error ? error.name : "UnknownError",
      );
      res.status(500).json({
        error: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
    },
  );
  return app;
}
