import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as Speech from "expo-speech";
import type { DeviceVoice, VoiceChoice } from "../../shared/voice";
import { availableDeviceVoices, deviceSpeechOptions } from "../services/deviceVoice";
import { Button, s } from "./ui";
import { Choice } from "./fields";
export function DeviceVoicePicker({ value, onChange }: { value?: VoiceChoice; onChange: (v: VoiceChoice) => void }) {
  const [voices, setVoices] = useState<DeviceVoice[]>([]), [error, setError] = useState(""), [playing, setPlaying] = useState("");
  const [loading, setLoading] = useState(true), version = useRef(0), mounted = useRef(true);
  async function refresh() {
    setLoading(true); setError("");
    try { const found = await availableDeviceVoices(); if (mounted.current) setVoices(found); }
    catch { if (mounted.current) setError("기기 음성을 불러오지 못했어요."); }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; version.current++; void Speech.stop(); }; }, []);
  return <View style={{ gap: 12 }}>
    <Text style={s.body}>기기에 설치된 한국어 목소리를 직접 선택해요. 미리 듣기와 데모 대화에 같은 목소리를 사용해요.</Text>
    <Text style={s.label}>{loading ? "목소리를 찾고 있어요…" : `사용 가능한 목소리 ${voices.length}개`}</Text>
    {voices.length === 1 && <Text style={s.body}>현재 기기에는 한국어 목소리가 하나만 있어요. 다른 음색은 기기에서 음성을 추가하거나 음성 서비스 연결 후 사용할 수 있어요.</Text>}
    {!loading && !voices.length && <Text style={s.body}>기기 설정에서 한국어 읽기 음성을 설치한 뒤 다시 불러와 주세요.</Text>}
    {value && !loading && !voices.some(v => v.identifier === value.id) && <Text accessibilityRole="alert" style={s.body}>이전에 선택한 ‘{value.name}’ 음성이 이 기기에 없어요. 다시 선택해 주세요.</Text>}
    {voices.map((v, i) => <View key={v.identifier} style={[s.card, (value ? value.id === v.identifier : i === 0) && s.selected]}>
      <Choice label={v.name} selected={value ? value.id === v.identifier : i === 0} onPress={() => { version.current++; void Speech.stop(); setPlaying(""); onChange({ kind: "device", id: v.identifier, name: v.name }); }} />
      <Button secondary onPress={() => { void (async () => {
        const token = ++version.current; await Speech.stop();
        if (playing === v.identifier) { setPlaying(""); return; }
        const choice = { kind: "device" as const, id: v.identifier, name: v.name }; onChange(choice); setError("");
        try { const options = await deviceSpeechOptions(choice); if (!mounted.current || version.current !== token) return;
          setPlaying(v.identifier); Speech.speak("여보세요? 아직 안 자? 그냥, 목소리 듣고 싶어서 전화했어.", { ...options,
            onDone: () => { if (version.current === token) setPlaying(""); },
            onStopped: () => { if (version.current === token) setPlaying(""); },
            onError: () => { if (version.current === token) { setPlaying(""); setError("음성을 재생하지 못했어요. 기기 소리 설정을 확인해 주세요."); } },
          });
        } catch(e) { if (mounted.current && version.current === token) { setPlaying(""); setError((e as Error).message); } }
      })(); }}>{playing === v.identifier ? "미리 듣기 멈추기" : "선택하고 들어보기"}</Button>
    </View>)}
    <Button secondary disabled={loading} onPress={() => void refresh()}>기기 목소리 다시 불러오기</Button>
    <Text style={s.body}>목소리 높낮이를 인위적으로 바꾸지 않고 조금 느긋하게 읽어요. 사람 같은 호흡과 표현력은 기기 음성만으로는 한계가 있어요.</Text>
    {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
  </View>;
}
