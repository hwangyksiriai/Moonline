import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Switch, Text, View } from "react-native";
import * as Picker from "expo-document-picker";
import * as Speech from "expo-speech";
import { useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import type { VoiceSample, ClonedVoice } from "../../shared/voice";
import { deleteSample, listSamples, sampleSource, saveSample } from "../services/voiceSamples";
import { cloneSample, deleteClone, studioVoices, synthesizeClone } from "../services/voiceStudio";
import { DEMO, BACKEND } from "../services/config";
import { Button, Card, s } from "./ui";
import { Field } from "./fields";

export function VoiceLibrary({ ownerId }: { ownerId: string }) {
  const [samples, setSamples] = useState<VoiceSample[]>([]), [clones, setClones] = useState<ClonedVoice[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [playing, setPlaying] = useState("");
  const [name, setName] = useState("내 목소리"), [consent, setConsent] = useState(false), [configured, setConfigured] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(""), [text, setText] = useState("여보세요? 아직 안 자? 그냥, 목소리 듣고 싶어서 전화했어.");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY), recording = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null), status = useAudioPlayerStatus(player);
  const alive = useRef(true), working = useRef(false), activeRecording = useRef(false), playback = useRef(0), release = useRef<() => void>(() => {});
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  async function refresh() { const rows = await listSamples(ownerId); if (alive.current) setSamples(rows); }
  function stopPlayback() { playback.current++; player.pause(); release.current(); release.current = () => {}; setPlaying(""); }
  async function action(fn: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage("");
    try { await fn(); } catch (e) { if (alive.current) setMessage(e instanceof Error ? e.message : "음성을 처리하지 못했어요."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function finishRecording(save: boolean) {
    if (!activeRecording.current) return;
    activeRecording.current = false; clearTimeout(recordingTimer.current);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    try {
      if (save && uri) {
        const mime = Platform.OS === "web" ? (await (await fetch(uri)).blob()).type : "audio/mp4";
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        await saveSample(ownerId, uri, (name.trim() || "내 목소리") + "." + ext, mime);
        await refresh();
        if (alive.current) setMessage("녹음을 이 기기에 보관했어요. 원본을 먼저 들어보세요.");
      }
    } finally { if (Platform.OS === "web" && uri) URL.revokeObjectURL(uri); }
  }
  useEffect(() => {
    alive.current = true;
    void refresh().catch(() => setMessage("저장된 음성을 불러오지 못했어요."));
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") void action(async () => { await finishRecording(true); stopPlayback(); });
    });
    return () => {
      alive.current = false; playback.current++; clearTimeout(recordingTimer.current);
      subscription.remove(); release.current();
      if (activeRecording.current) void finishRecording(false).catch(() => {});
    };
  }, [ownerId]);
  useEffect(() => { if (status.didJustFinish) { release.current(); release.current = () => {}; setPlaying(""); } }, [status.didJustFinish]);
  async function play(id: string, source: () => Promise<{ uri: string; release: () => void }>) {
    stopPlayback(); await Speech.stop(); const token = ++playback.current;
    const audio = await source();
    if (!alive.current || playback.current !== token) { audio.release(); return; }
    release.current = audio.release; player.replace({ uri: audio.uri }); player.play(); setPlaying(id);
  }
  return <Card>
    <Text style={s.eyebrow}>YOUR VOICE</Text>
    <Text style={s.label}>내가 듣고 싶은 목소리</Text>
    <Text style={s.body}>직접 녹음하거나 음성 파일을 넣어보세요. 원본은 이 기기에 보관돼요. 브라우저 데이터를 지우면 함께 삭제됩니다.</Text>
    <Field label="목소리 이름" value={name} onChangeText={setName} maxLength={40} />
    <Text style={s.body}>조용한 곳에서 혼자, 평소 통화하듯 편안하게 말해 주세요. 녹음은 최대 2분, 파일은 12MB까지예요.</Text>
    <Button disabled={busy} onPress={() => void action(async () => {
      if (activeRecording.current) { await finishRecording(true); return; }
      stopPlayback(); await Speech.stop();
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw Error("녹음하려면 마이크 권한이 필요해요. 브라우저·기기 설정에서 허용하거나 파일을 추가해 주세요.");
      if (!alive.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!alive.current) { await recorder.stop(); await setAudioModeAsync({ allowsRecording: false }); return; }
      activeRecording.current = true; recorder.record();
      recordingTimer.current = setTimeout(() => { void action(() => finishRecording(true)); }, 120000);
    })}>{recording.isRecording ? `녹음 마치고 보관 · ${Math.floor(recording.durationMillis / 1000)}초` : "마이크로 녹음하기"}</Button>
    {recording.isRecording && <Button secondary disabled={busy} onPress={() => void action(async () => { await finishRecording(false); setMessage("녹음을 취소했어요."); })}>녹음 취소</Button>}
    <Button secondary disabled={busy || recording.isRecording} onPress={() => void action(async () => {
      const result = await Picker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const a = result.assets[0];
      try { await saveSample(ownerId, a.uri, a.name, a.mimeType); await refresh(); if (alive.current) setMessage("음성 파일을 이 기기에 보관했어요."); }
      finally { if (Platform.OS === "web" && a.uri.startsWith("blob:")) URL.revokeObjectURL(a.uri); }
    })}>녹음한 파일 추가하기</Button>
    {samples.map(sample => <View key={sample.id} style={{ gap: 10, borderTopWidth: 1, borderColor: "#53687A", paddingTop: 14 }}>
      <Text style={s.label}>{sample.name}</Text><Text style={s.body}>원본 음성 · {(sample.size / 1024 / 1024).toFixed(1)}MB</Text>
      <Button secondary disabled={busy || recording.isRecording} onPress={() => void action(async () => { if (playing === sample.id) stopPlayback(); else await play(sample.id, () => sampleSource(sample)); })}>{playing === sample.id ? "재생 멈추기" : "원본 들어보기"}</Button>
      {configured && <Button disabled={busy || !consent || recording.isRecording} onPress={() => void action(async () => { stopPlayback(); const voice = await cloneSample(sample, name.trim() || sample.name); setClones(v => [...v, voice]); setMessage(voice.ready ? "목소리를 등록했어요. 아래에서 새로운 문장을 들어보세요." : "제공 업체의 추가 검증이 필요해요. 아직 새 대사를 합성할 수 없어요."); })}>이 음성으로 새 대사 만들기</Button>}
      <Button secondary disabled={busy || recording.isRecording} onPress={() => {
        if (confirmDelete !== sample.id) { setConfirmDelete(sample.id); return; }
        void action(async () => { stopPlayback(); await deleteSample(sample); setConfirmDelete(""); await refresh(); });
      }}>{confirmDelete === sample.id ? "이 기기의 원본 삭제 확인" : "원본 삭제"}</Button>
    </View>)}
    <Text style={s.label}>같은 목소리로 새로운 말 듣기</Text>
    <Text style={s.body}>{DEMO || !BACKEND ? "현재는 음성 서비스가 연결되지 않았어요. 녹음·원본 재생은 지금 사용할 수 있고, 새 대사 합성은 ElevenLabs와 로그인 서버 연결 후 사용할 수 있어요." : "ElevenLabs에 샘플을 전송해 AI 목소리를 만듭니다. 생성된 말은 원본 화자가 실제로 한 말이 아니에요."}</Text>
    {!DEMO && BACKEND ? <>
      <Button secondary disabled={busy || recording.isRecording} onPress={() => void action(async () => { const result = await studioVoices(); setConfigured(result.configured); setClones(result.voices); setMessage(result.configured ? "음성 서비스에 연결했어요." : "서버에 ElevenLabs API 키를 설정해 주세요."); })}>음성 서비스 연결 확인 · 목록 새로고침</Button>
      {configured && <><View style={s.row}><Switch accessibilityLabel="음성 합성 및 ElevenLabs 전송 동의" value={consent} onValueChange={setConsent} /><Text style={[s.body, { flex: 1 }]}>내 음성이거나 화자의 사용 허락을 받았으며, 음성 합성을 위한 ElevenLabs 전송에 동의해요.</Text></View><Text style={s.body}>전송한 샘플과 복제 목소리는 제공 업체에 보관됩니다. 아래 ‘업체 목소리 삭제’로 삭제를 요청할 수 있어요. 기기의 원본 삭제와는 별개예요.</Text></>}
    </> : null}
    {clones.length > 0 && <Field label="새로 말해 줄 문장 · AI 생성 음성" value={text} onChangeText={setText} maxLength={500} multiline />}
    {clones.map(voice => <View key={voice.id} style={{ gap: 10 }}><Text style={s.label}>{voice.name} · {voice.ready ? "새 대사 합성 가능" : "업체 검증 필요"}</Text>
      <Button disabled={busy || !voice.ready || !text.trim() || recording.isRecording} onPress={() => void action(() => play(voice.id, () => synthesizeClone(voice.id, text)))}>이 목소리로 새 문장 듣기</Button>
      <Text style={s.body}>맞춤 목소리는 여기서 문장을 만들어 들을 수 있어요. 실제 전화 연결에는 아직 적용되지 않아요.</Text>
      <Button secondary disabled={busy} onPress={() => { if (confirmDelete !== voice.id) { setConfirmDelete(voice.id); return; } void action(async () => { stopPlayback(); await deleteClone(voice.id); setClones(v => v.filter(c => c.id !== voice.id)); setConfirmDelete(""); }); }}>{confirmDelete === voice.id ? "업체 목소리 삭제 확인" : "업체 목소리 삭제"}</Button>
    </View>)}
    {!!message && <Text accessibilityRole="alert" style={s.body}>{message}</Text>}
  </Card>;
}
