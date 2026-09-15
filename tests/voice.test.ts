import { test } from "node:test";
import assert from "node:assert/strict";
import { koreanVoices, validateSample, MAX_VOICE_BYTES } from "../shared/voice.ts";
test("device voices retain distinct identifiers, omit other languages and deduplicate", () => {
  const a = { identifier: "a", name: "Korean A", language: "ko-KR" };
  const b = { identifier: "b", name: "Korean B", language: "ko_KR", quality: "Enhanced" };
  assert.deepEqual(koreanVoices([a, b, a, { ...a, identifier: "en", language: "en-US" }]), [b, a]);
  assert.equal(koreanVoices([a]).length, 1);
  assert.deepEqual(koreanVoices([]), []);
});
test("samples reject empty, oversize and non-audio files", () => {
  for (const size of [0, -1, NaN, MAX_VOICE_BYTES + 1]) assert.throws(() => validateSample("voice.wav", "audio/wav", size));
  assert.throws(() => validateSample("voice.mp4", "video/mp4", 100));
  assert.throws(() => validateSample("script.mp3", "text/html", 100));
  assert.doesNotThrow(() => validateSample("voice.M4A", "audio/mp4", 100));
});
