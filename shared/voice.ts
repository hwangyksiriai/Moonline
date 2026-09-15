export type DeviceVoice = { identifier: string; name: string; language: string; quality?: string };
export type VoiceChoice = { kind: "device"; id: string; name: string };
export type VoiceSample = { id: string; ownerId: string; name: string; mime: string; size: number; createdAt: number; uri: string };
export type ClonedVoice = { id: string; name: string; ready: boolean };
export const MAX_VOICE_BYTES = 12 * 1024 * 1024;
export function koreanVoices(list: DeviceVoice[]) {
  return [...new Map(list.filter(v => /^ko(?:[-_]|$)/i.test(v.language)).map(v => [v.identifier, v])).values()]
    .sort((a, b) => Number(b.quality === "Enhanced") - Number(a.quality === "Enhanced") || a.name.localeCompare(b.name));
}
export function validateSample(name: string, mime: string, size: number) {
  if (!Number.isFinite(size) || size <= 0 || size > MAX_VOICE_BYTES) throw Error("비어 있지 않은 12MB 이하 음성 파일을 선택해 주세요.");
  if (!/\.(mp3|m4a|wav|webm|ogg|aac|flac)$/i.test(name) || (mime && !mime.startsWith("audio/") && mime !== "application/octet-stream"))
    throw Error("MP3, M4A, WAV, WebM, OGG, AAC, FLAC 음성 파일을 선택해 주세요.");
}
