import * as Speech from "expo-speech";
import { koreanVoices, type VoiceChoice } from "../../shared/voice";
export async function availableDeviceVoices() {
  let list = koreanVoices(await Speech.getAvailableVoicesAsync());
  for (let i = 0; !list.length && i < 3; i++) {
    await new Promise(r => setTimeout(r, 250));
    list = koreanVoices(await Speech.getAvailableVoicesAsync());
  }
  return list;
}
export async function deviceSpeechOptions(choice?: VoiceChoice) {
  const list = await availableDeviceVoices();
  const voice = choice ? list.find(v => v.identifier === choice.id) : list[0];
  if (!voice) throw Error(choice ? "선택한 목소리가 이 기기에 없어요. 목소리 설정에서 다시 선택해 주세요." : "기기에 한국어 읽기 음성이 없어요. 기기 설정에서 한국어 음성을 설치해 주세요.");
  return { language: voice.language, voice: voice.identifier, pitch: 1, rate: 0.94 };
}
