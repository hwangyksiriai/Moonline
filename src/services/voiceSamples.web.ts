import { randomUUID } from "expo-crypto";
import { validateSample, type VoiceSample } from "../../shared/voice";
type Stored = Omit<VoiceSample, "uri"> & { blob: Blob };
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("moonline.voice-samples.v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("samples", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(Error("음성 저장 공간을 열지 못했어요."));
  });
}
async function transaction<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  try { return await new Promise<T>((resolve, reject) => {
    const t = d.transaction("samples", mode), r = fn(t.objectStore("samples"));
    t.oncomplete = () => resolve(r.result);
    t.onabort = t.onerror = () => reject(Error("음성을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."));
  }); } finally { d.close(); }
}
export async function listSamples(ownerId: string): Promise<VoiceSample[]> {
  const rows = await transaction("readonly", s => s.getAll()) as Stored[];
  return rows.filter(v => v.ownerId === ownerId).map(({ blob, ...v }) => ({ ...v, uri: v.id })).sort((a,b) => b.createdAt-a.createdAt);
}
export async function saveSample(ownerId: string, uri: string, name: string, mime?: string): Promise<void> {
  const blob = await (await fetch(uri)).blob();
  validateSample(name, mime || blob.type, blob.size);
  await new Promise<void>((resolve, reject) => {
    const audio = new Audio(), url = URL.createObjectURL(blob);
    const finish = (error?: Error) => {
      clearTimeout(timer); audio.onloadedmetadata = null; audio.onerror = null;
      audio.removeAttribute("src"); audio.load(); URL.revokeObjectURL(url);
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => finish(Error("음성을 확인하지 못했어요. 다른 형식의 파일을 선택해 주세요.")), 10000);
    audio.onloadedmetadata = () => finish();
    audio.onerror = () => finish(Error("이 브라우저에서 재생할 수 없는 음성 파일이에요."));
    audio.preload = "metadata"; audio.src = url;
  });
  if ((await listSamples(ownerId)).length >= 10) throw Error("최대 10개까지 보관할 수 있어요. 기존 음성을 삭제한 뒤 추가해 주세요.");
  await transaction("readwrite", s => s.add({ id: randomUUID(), ownerId, name, mime: mime || blob.type, size: blob.size, createdAt: Date.now(), blob }));
}
export async function sampleBlob(sample: VoiceSample): Promise<Blob> {
  const row = await transaction("readonly", s => s.get(sample.id)) as Stored | undefined;
  if (!row || row.ownerId !== sample.ownerId) throw Error("원본 음성을 찾지 못했어요.");
  return row.blob;
}
export async function sampleSource(sample: VoiceSample) {
  const uri = URL.createObjectURL(await sampleBlob(sample));
  return { uri, release: () => URL.revokeObjectURL(uri) };
}
export async function deleteSample(sample: VoiceSample) {
  await sampleBlob(sample);
  await transaction("readwrite", s => s.delete(sample.id));
}
