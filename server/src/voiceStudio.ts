import express from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { Config } from "./config.ts";
import type { Repository } from "./repository.ts";
import { validateSample, type ClonedVoice } from "../../shared/voice.ts";

// Mounted after authentication. Samples are forwarded in memory, never written to disk.
export function voiceStudio(config: Config, repo: Repository, request: typeof fetch = fetch) {
  const router = express.Router(), locks = new Map<string, Promise<unknown>>();
  async function serial<T>(owner: string, fn: () => Promise<T>): Promise<T> {
    const previous = locks.get(owner) || Promise.resolve();
    const job = previous.catch(() => {}).then(fn); locks.set(owner, job);
    try { return await job; } finally { if (locks.get(owner) === job) locks.delete(owner); }
  }
  async function remote(path: string, options: RequestInit = {}) {
    const response = await request("https://api.elevenlabs.io/v1" + path, {
      ...options, headers: { ...options.headers, "xi-api-key": config.elevenlabsKey! }, signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? "음성 서비스의 키·권한·요금제를 확인해 주세요." : "음성 서비스 요청이 실패했어요. 다시 만들기 전에 목소리 목록을 확인해 주세요.");
    return response;
  }
  router.get("/", async (_, res) => {
    const profile = await repo.profile(res.locals.userId);
    res.set("Cache-Control", "no-store").json({ configured: !!config.elevenlabsKey && !config.demo, voices: profile?.customVoices || [] });
  });
  router.use((_, res, next) => {
    if (!config.elevenlabsKey || config.demo) { res.status(503).json({ error: "로그인 서버와 ElevenLabs 계정을 연결해야 새 대사를 합성할 수 있어요." }); return; }
    next();
  });
  router.use(rateLimit({ windowMs: 60000, limit: 10, keyGenerator: (_, res) => res.locals.userId as string, standardHeaders: "draft-8", legacyHeaders: false }));
  router.post("/", express.raw({ type: ["audio/*", "application/octet-stream"], limit: "12mb" }), async (req, res) => {
    const name = z.string().trim().min(1).max(40).parse(req.query.name);
    if (req.header("X-Voice-Consent") !== "confirmed") { res.status(400).json({ error: "음성 사용 허락과 파일 전송 동의가 필요해요." }); return; }
    let filename: string;
    try { filename = decodeURIComponent(req.header("X-Voice-Filename") || ""); }
    catch { res.status(400).json({ error: "파일 이름을 확인해 주세요." }); return; }
    const mime = (req.header("Content-Type") || "").split(";")[0];
    try { validateSample(filename, mime, Buffer.isBuffer(req.body) ? req.body.length : 0); }
    catch (e) { res.status(400).json({ error: (e as Error).message }); return; }
    const owner = res.locals.userId as string;
    try {
      const voice = await serial(owner, async () => {
        const profile = (await repo.profile(owner))!;
        if ((profile.customVoices || []).length >= 10) throw Error("복제 목소리는 최대 10개까지 만들 수 있어요.");
        const form = new FormData(); form.append("name", name);
        form.append("files", new Blob([new Uint8Array(req.body)], { type: mime }), "sample." + filename.split(".").pop());
        const result = await (await remote("/voices/add", { method: "POST", body: form })).json() as { voice_id?: string; requires_verification?: boolean };
        if (!result.voice_id) throw Error("목소리 등록 결과를 확인하지 못했어요. 업체 계정에서 확인해 주세요.");
        const created: ClonedVoice = { id: result.voice_id, name, ready: result.requires_verification === false };
        try {
          const latest = (await repo.profile(owner))!;
          await repo.putProfile({ ...latest, customVoices: [...latest.customVoices || [], created] });
        } catch {
          await remote("/voices/" + encodeURIComponent(created.id), { method: "DELETE" });
          throw Error("목소리를 저장하지 못해 업체 등록을 취소했어요.");
        }
        return created;
      });
      res.status(201).json(voice);
    } catch (e) { res.status(502).json({ error: (e as Error).message }); }
  });
  router.post("/:id/speech", async (req, res) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(500) }).parse(req.body);
    const profile = await repo.profile(res.locals.userId), voice = profile?.customVoices?.find(v => v.id === req.params.id);
    if (!voice) { res.status(404).json({ error: "목소리를 찾지 못했어요." }); return; }
    if (!voice.ready) { res.status(409).json({ error: "업체 검증이 필요한 목소리예요. 합성은 아직 사용할 수 없어요." }); return; }
    try {
      const r = await remote("/text-to-speech/" + encodeURIComponent(voice.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        text, model_id: "eleven_multilingual_v2", language_code: "ko",
        voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed: 0.95 },
      }) });
      const bytes = Buffer.from(await r.arrayBuffer());
      res.set("Cache-Control", "no-store").json({ audio: bytes.toString("base64") });
    } catch (e) { res.status(502).json({ error: (e as Error).message }); }
  });
  router.delete("/:id", async (req, res) => {
    const owner = res.locals.userId as string;
    try {
      await serial(owner, async () => {
        const profile = (await repo.profile(owner))!, voice = profile.customVoices?.find(v => v.id === req.params.id);
        if (!voice) return;
        const r = await request("https://api.elevenlabs.io/v1/voices/" + encodeURIComponent(voice.id), { method: "DELETE", headers: { "xi-api-key": config.elevenlabsKey! }, signal: AbortSignal.timeout(30000) });
        if (!r.ok && r.status !== 404) throw Error("업체 목소리를 삭제하지 못했어요. 다시 시도해 주세요.");
        const latest = (await repo.profile(owner))!;
        await repo.putProfile({ ...latest, customVoices: latest.customVoices?.filter(v => v.id !== voice.id) });
      });
      res.sendStatus(204);
    } catch (e) { res.status(502).json({ error: (e as Error).message }); }
  });
  router.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === "entity.too.large") res.status(413).json({ error: "12MB 이하 음성 파일을 선택해 주세요." }); else next(err);
  });
  return router;
}
