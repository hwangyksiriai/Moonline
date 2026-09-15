import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FS from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { validateSample, type VoiceSample } from "../../shared/voice";
const key = (owner: string) => "moonline.voice-samples.v1." + owner;
export async function listSamples(owner: string): Promise<VoiceSample[]> {
  return JSON.parse(await AsyncStorage.getItem(key(owner)) || "[]");
}
export async function saveSample(ownerId: string, uri: string, name: string, mime = "audio/mp4") {
  const info = await FS.getInfoAsync(uri);
  validateSample(name, mime, info.exists ? info.size : 0);
  const rows = await listSamples(ownerId);
  if (rows.length >= 10) throw Error("최대 10개까지 보관할 수 있어요.");
  const folder = FS.documentDirectory + "moonline-voices/";
  await FS.makeDirectoryAsync(folder, { intermediates: true });
  const id = randomUUID(), target = folder + id + "." + name.split(".").pop();
  await FS.copyAsync({ from: uri, to: target });
  try {
    await AsyncStorage.setItem(key(ownerId), JSON.stringify([{ id, ownerId, name, mime, size: info.exists ? info.size : 0, createdAt: Date.now(), uri: target }, ...rows]));
  } catch (e) { await FS.deleteAsync(target, { idempotent: true }); throw e; }
}
export async function sampleSource(sample: VoiceSample) { return { uri: sample.uri, release: () => {} }; }
export async function sampleBlob(sample: VoiceSample): Promise<Blob> { return (await fetch(sample.uri)).blob(); }
export async function deleteSample(sample: VoiceSample) {
  const rows = await listSamples(sample.ownerId), stored = rows.find(v => v.id === sample.id);
  if (!stored) return;
  await FS.deleteAsync(stored.uri, { idempotent: true });
  await AsyncStorage.setItem(key(sample.ownerId), JSON.stringify(rows.filter(v => v.id !== sample.id)));
}
