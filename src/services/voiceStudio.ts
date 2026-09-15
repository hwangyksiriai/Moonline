import { Platform } from "react-native";
import * as FS from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { api } from "./api";
import { BACKEND } from "./config";
import { requireAuth } from "./auth";
import { sampleBlob } from "./voiceSamples";
import type { ClonedVoice, VoiceSample } from "../../shared/voice";
export const studioVoices = () => api<{ configured: boolean; voices: ClonedVoice[] }>("/voice-studio");
export async function cloneSample(sample: VoiceSample, name: string) {
  const { data: { session } } = await requireAuth().auth.getSession();
  if (!session || !BACKEND) throw Error("음성 서비스를 연결하고 로그인해 주세요.");
  const url = BACKEND + "/voice-studio?name=" + encodeURIComponent(name);
  const headers = { Authorization: `Bearer ${session.access_token}`, "Content-Type": sample.mime || "application/octet-stream", "X-Voice-Consent": "confirmed", "X-Voice-Filename": encodeURIComponent(sample.name) };
  let status: number, result: any;
  if (Platform.OS === "web") {
    const r = await fetch(url, { method: "POST", headers, body: await sampleBlob(sample), signal: AbortSignal.timeout(120000) });
    status = r.status; result = await r.json();
  } else {
    const r = await FS.uploadAsync(url, sample.uri, { httpMethod: "POST", uploadType: FS.FileSystemUploadType.BINARY_CONTENT, headers });
    status = r.status; result = JSON.parse(r.body);
  }
  if (status >= 400) throw Error(result.error || "목소리를 만들지 못했어요. 다시 만들기 전에 목록을 새로고침해 주세요.");
  return result as ClonedVoice;
}
export const deleteClone = (id: string) => api<void>("/voice-studio/" + encodeURIComponent(id), "DELETE");
export async function synthesizeClone(id: string, text: string) {
  const { audio } = await api<{ audio: string }>("/voice-studio/" + encodeURIComponent(id) + "/speech", "POST", { text }, 100000);
  if (Platform.OS === "web") return { uri: "data:audio/mpeg;base64," + audio, release: () => {} };
  const uri = FS.cacheDirectory + "voice-" + randomUUID() + ".mp3";
  await FS.writeAsStringAsync(uri, audio, { encoding: FS.EncodingType.Base64 });
  return { uri, release: () => { void FS.deleteAsync(uri, { idempotent: true }); } };
}
