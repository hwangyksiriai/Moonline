import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as Speech from "expo-speech";
import {
  personalities,
  relationships,
  scenarios,
  scenarioOf,
  voices,
  voiceOf,
} from "../../shared/catalog";
import {
  type Call,
  type CallDraft,
  localSchedule,
  nextTime,
} from "../../shared/model";
import { Button, Card, s, colors } from "../components/ui";
import { Choice, Field, SectionTitle } from "../components/fields";
import DateFields from "../components/DateFields";
import type { Night } from "../hooks/useNight";
import { DEMO, BACKEND } from "../services/config";
import { requireAuth } from "../services/auth";
const dateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
type Props = {
  night: Night;
  initial?: Call;
  scenarioId: string;
  onDone: (id: string) => void;
  onBack: () => void;
  onStep: () => void;
};
type Snapshot = {
  characterName: string;
  backstory: string;
  greeting: string;
  nickname: string;
  anniversary: string;
  step: number;
  scenario: string;
  voice: string;
  situation: string;
  relationship: string;
  other: string;
  personality: string[];
  phrase: string;
  consent: boolean;
  memory: boolean;
  when: string;
  date: string;
  time: string;
  advanced: boolean;
};
export function CreateCall(props: Props) {
  const storageKey =
    "night.composer.v1." +
    props.night.profile?.id +
    "." +
    (props.initial?.id || props.initial?.characterId || props.scenarioId);
  const [loaded, setLoaded] = useState(false),
    [saved, setSaved] = useState<Snapshot>(),
    [revision, setRevision] = useState(0),
    [saveError, setSaveError] = useState("");
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (active) {
          if (raw) {
            const v = JSON.parse(raw);
            if (typeof v.voice === "string" && Array.isArray(v.personality))
              setSaved(v);
          }
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setSaveError(
            "작성 내용을 불러오지 못했어요. 저장 공간을 확인해 주세요.",
          );
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [storageKey]);
  function persist(value: Snapshot) {
    chain.current = chain.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(storageKey, JSON.stringify(value)))
      .catch(() =>
        setSaveError(
          "작성 내용을 저장하지 못했어요. 앱을 닫기 전에 다시 확인해 주세요.",
        ),
      );
  }
  if (!loaded) return <Text style={s.body}>작성 내용을 불러오고 있어요…</Text>;
  return (
    <View style={{ flex: 1, gap: 8 }}>
      {saveError ? (
        <Text accessibilityRole="alert" style={s.body}>
          {saveError}
        </Text>
      ) : (
        <Text style={s.body}>
          {saved
            ? "이전에 쓰던 내용을 이어서 작성해요."
            : "작성 내용은 이 기기에 자동 저장돼요."}
        </Text>
      )}
      <CreateForm
        key={revision}
        {...props}
        saved={saved}
        persist={persist}
        onDone={(id) => {
          chain.current = chain.current
            .catch(() => {})
            .then(() => AsyncStorage.removeItem(storageKey));
          props.onDone(id);
        }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setSaved(undefined);
          setRevision((v) => v + 1);
        }}
      >
        <Text style={[s.body, s.center, { padding: 8 }]}>
          입력 초기화하고 새로 쓰기
        </Text>
      </Pressable>
    </View>
  );
}
function CreateForm({
  night,
  initial,
  scenarioId,
  onDone,
  onBack,
  onStep,
  saved,
  persist,
}: Props & { saved?: Snapshot; persist: (value: Snapshot) => void }) {
  const [characterName, setCharacterName] = useState(
      saved?.characterName ??
        initial?.characterName ??
        (scenarioId === "future"
          ? "미래의 나"
          : scenarioId === "custom"
            ? ""
            : "수현"),
    ),
    [backstory, setBackstory] = useState(
      saved?.backstory ?? initial?.backstory ?? "",
    ),
    [greeting, setGreeting] = useState(
      saved?.greeting ?? initial?.greeting ?? "",
    ),
    [nickname, setNickname] = useState(
      saved?.nickname ?? initial?.userNickname ?? night.profile?.name ?? "",
    ),
    [anniversary, setAnniversary] = useState(
      saved?.anniversary ?? initial?.anniversary ?? "",
    ),
    [step, setStep] = useState(
      saved?.step ?? (initial || scenarioId !== "custom" ? 3 : 2),
    ),
    [scenario, setScenario] = useState(
      saved?.scenario ?? initial?.scenarioId ?? scenarioId,
    ),
    [voice, setVoice] = useState(saved?.voice ?? initial?.voice ?? "Noah"),
    [situation, setSituation] = useState(
      saved?.situation ?? initial?.situation ?? "",
    ),
    [relationship, setRelationship] = useState(
      saved?.relationship ??
        (initial?.relationship && !relationships.includes(initial.relationship)
          ? "직접 입력"
          : (initial?.relationship ??
            (scenarioId === "future" ? "미래의 나" : scenarioId === "love" ? "연인" : "친구"))),
    ),
    [other, setOther] = useState(
      saved?.other ??
        (initial?.relationship && !relationships.includes(initial.relationship)
          ? initial.relationship
          : ""),
    ),
    [personality, setPersonality] = useState(
      saved?.personality ?? initial?.personality ?? ["다정한"],
    ),
    [phrase, setPhrase] = useState(
      saved?.phrase ?? initial?.mustSayPhrase ?? "",
    ),
    [consent, setConsent] = useState(
      saved?.consent ?? initial?.consent ?? false,
    ),
    [memory, setMemory] = useState(
      saved?.memory ?? initial?.memoryConsent ?? false,
    ),
    [when, setWhen] = useState(
      saved?.when ?? (initial ? "custom" : DEMO ? "30s" : "22:00"),
    ),
    [date, setDate] = useState(
      saved?.date ??
        dateString(new Date(initial?.scheduledAt ?? nextTime(22, 0))),
    ),
    [time, setTime] = useState(
      saved?.time ??
        (initial
          ? new Date(initial.scheduledAt).toTimeString().slice(0, 5)
          : "22:00"),
    ),
    [advanced, setAdvanced] = useState(saved?.advanced ?? false),
    [preview, setPreview] = useState("");
  useEffect(() => {
    persist({
      characterName,
      backstory,
      greeting,
      nickname,
      anniversary,
      step,
      scenario,
      voice,
      situation,
      relationship,
      other,
      personality,
      phrase,
      consent,
      memory,
      when,
      date,
      time,
      advanced,
    });
  }, [
    characterName,
    backstory,
    greeting,
    nickname,
    anniversary,
    step,
    scenario,
    voice,
    situation,
    relationship,
    other,
    personality,
    phrase,
    consent,
    memory,
    when,
    date,
    time,
    advanced,
  ]);
  const formScroll = useRef<ScrollView>(null);
  const sequence = [2, 1, 0, 3];
  const stepIndex = sequence.indexOf(step);
  const [showStories, setShowStories] = useState(false);
  const submitting = useRef(false),
    previewVersion = useRef(0);
  useEffect(() => {
    onStep();
    formScroll.current?.scrollTo({ y: 0, animated: false });
    previewVersion.current++;
    void Speech.stop();
    setPreview("");
  }, [step]);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  useEffect(() => {
    if (playerStatus.didJustFinish) setPreview("");
  }, [playerStatus.didJustFinish]);
  useEffect(
    () => () => {
      previewVersion.current++;
      void Speech.stop();
    },
    [],
  );
  async function listen(name: string) {
    const token = ++previewVersion.current;
    try {
      setVoice(name);
      setPreview(name);
      if (DEMO) {
        await Speech.stop();
        const v = voiceOf(name);
        Speech.speak(
          "여보세요? 오늘 하루 어땠어요? 당신의 이야기를 듣고 싶었어요.",
          {
            language: "ko-KR",
            pitch: v.pitch,
            rate: v.rate,
            onDone: () => {
              if (token === previewVersion.current) setPreview("");
            },
            onError: () => {
              if (token !== previewVersion.current) return;
              setPreview("");
              night.setNote("기기에서 한국어 음성을 확인해 주세요.");
            },
          },
        );
      } else {
        const {
          data: { session },
        } = await requireAuth().auth.getSession();
        const r = await fetch(`${BACKEND}/voices/${name}/preview`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw new Error("목소리를 불러오지 못했어요.");
        const { url } = await r.json();
        player.replace({ uri: url });
        player.play();
      }
    } catch (e) {
      setPreview("");
      night.setError(
        e instanceof Error ? e.message : "음성을 재생하지 못했어요.",
      );
    }
  }
  function scheduledTime() {
    let at: number;
    if (when === "30s") at = Date.now() + 30000;
    else if (when === "custom") at = localSchedule(date, time);
    else if (when === "morning") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      at = d.getTime();
    } else {
      const [h, m] = when.split(":").map(Number);
      at = nextTime(h, m);
    }
    return at;
  }
  function scheduleLabel() {
    if (when === "30s") return "예약 버튼을 누른 뒤 30초 후";
    try {
      return new Date(scheduledTime()).toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "날짜와 시간을 확인해 주세요.";
    }
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    try {
      const at = scheduledTime();
      if (!DEMO && !night.profile?.phoneVerified)
        throw new Error("마이에서 전화번호를 먼저 인증해 주세요.");
      if (anniversary && !/^\d{4}-\d{2}-\d{2}$/.test(anniversary))
        throw new Error("기념일을 YYYY-MM-DD 형식으로 입력해 주세요.");
      const draft: CallDraft = {
        characterId: initial?.characterId,
        characterName: characterName.trim() || voice,
        backstory: backstory.trim(),
        greeting: greeting.trim(),
        userNickname: nickname.trim(),
        anniversary: anniversary || undefined,
        scenarioId: scenario,
        voice,
        situation: situation.trim() || scenarioOf(scenario).description,
        relationship:
          relationship === "직접 입력" ? other.trim() : relationship,
        personality,
        mustSayPhrase: phrase.trim(),
        scheduledAt: at,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        consent,
        memoryConsent: consent && memory && !!night.profile?.memoryEnabled,
      };
      const id = await night.book(
        draft,
        initial?.status === "scheduled" ? initial.id : undefined,
      );
      if (id) onDone(id);
    } catch (e) {
      night.setError(
        e instanceof Error ? e.message : "예약 시간을 확인해 주세요.",
      );
    } finally {
      submitting.current = false;
    }
  }
  return (
    <View style={{ flex: 1, gap: 10 }}>
      <ScrollView
        ref={formScroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 18, paddingBottom: 12 }}
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            stepIndex > 0 ? setStep(sequence[stepIndex - 1]) : onBack()
          }
        >
          <Text style={s.body}>← 이전</Text>
        </Pressable>
        <Text style={s.eyebrow}>
          {initial?.status === "scheduled" ? "예약 수정" : "나만의 전화"} · STEP{" "}
          {stepIndex + 1} / 4
        </Text>
        <View style={s.row}>
          {sequence.map((i) => (
            <View
              key={i}
              style={{
                height: 3,
                flex: 1,
                backgroundColor:
                  sequence.indexOf(i) <= stepIndex
                    ? colors.accent
                    : colors.line,
              }}
            />
          ))}
        </View>
        {step === 0 ? (
          <>
            <SectionTitle
              eyebrow="THE STORY"
              title="어떤 이야기를\n시작할까요?"
            />
            <Button secondary onPress={() => setShowStories(!showStories)}>
              {scenarioOf(scenario).category} · 다른 상황 고르기
            </Button>
            {showStories ? (
              <View style={{ gap: 10 }}>
                {scenarios.map((c) => (
                  <Choice
                    key={c.id}
                    label={`${c.emoji} ${c.category} · ${c.title}`}
                    selected={scenario === c.id}
                    onPress={() => {
                      setScenario(c.id);
                      if (c.id === "future") setRelationship("미래의 나");
                    }}
                  />
                ))}
              </View>
            ) : null}
            <Field
              label="어떤 상황에서 전화가 오나요?"
              multiline
              textAlignVertical="top"
              style={{ minHeight: 150 }}
              value={situation}
              onChangeText={setSituation}
              maxLength={1000}
              placeholder="오늘 있었던 일, 지금의 마음을 자유롭게 적어주세요."
            />
            {scenario === "horror" ? (
              <Text style={s.body}>
                가상의 미스터리 이야기예요. 원하지 않으면 언제든 통화를 마칠 수
                있어요.
              </Text>
            ) : null}
          </>
        ) : step === 1 ? (
          <>
            <SectionTitle
              eyebrow="THE VOICE"
              title="어떤 목소리로\n전화할까요?"
            />
            {voices.map((v) => (
              <View
                key={v.name}
                style={[s.card, voice === v.name && s.selected]}
              >
                <Choice
                  label={`${v.name} · ${v.description}`}
                  selected={voice === v.name}
                  onPress={() => setVoice(v.name)}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={v.name + " 목소리 들어보기"}
                  onPress={() => void listen(v.name)}
                >
                  <Text style={{ color: colors.accent }}>
                    {preview === v.name
                      ? "▂ ▄ ▆ ▄ ▂ 재생 중"
                      : "▶ 선택하고 들어보기"}
                  </Text>
                </Pressable>
              </View>
            ))}
            {DEMO ? (
              <Text style={s.body}>
                체험판에서는 기기의 읽기 음성으로 분위기를 미리 들어요. 실제
                통화 목소리와는 다를 수 있어요.
              </Text>
            ) : null}
          </>
        ) : step === 2 ? (
          <>
            <SectionTitle eyebrow="THE PERSON" title="어떤 사람인가요?" />
            <Field
              label="누구에게 전화받을까요? · 이름"
              value={characterName}
              onChangeText={setCharacterName}
              placeholder="예: 10년 뒤의 나, 오랜 친구 수현"
              maxLength={40}
            />
            <Text style={s.label}>나와의 관계</Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {relationships.map((r) => (
                <Choice
                  key={r}
                  label={r}
                  selected={relationship === r}
                  onPress={() => setRelationship(r)}
                />
              ))}
            </View>
            {relationship === "직접 입력" ? (
              <Field
                label="관계 직접 입력"
                value={other}
                onChangeText={setOther}
                maxLength={80}
              />
            ) : null}
            <Text style={s.label}>성격 · 여러 개 선택 가능</Text>
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {personalities.map((p) => (
                <Pressable
                  key={p}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: personality.includes(p) }}
                  onPress={() =>
                    setPersonality(
                      personality.includes(p)
                        ? personality.filter((v) => v !== p)
                        : [...personality, p],
                    )
                  }
                  style={[s.chip, personality.includes(p) && s.selected]}
                >
                  <Text style={s.body}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <Button secondary onPress={() => setAdvanced(!advanced)}>
              {advanced
                ? "상세 설정 접기"
                : "함께한 기억·호칭·기념일 더하기 (선택)"}
            </Button>
            {advanced ? (
              <>
                <Field
                  label="함께한 이야기 (선택)"
                  multiline
                  style={{ minHeight: 120 }}
                  value={backstory}
                  onChangeText={setBackstory}
                  placeholder="우리는 대학 때부터 친구야. 매년 여름 바다에 갔어."
                  maxLength={1000}
                />
                <Field
                  label="나를 어떻게 불러주면 좋을까요?"
                  value={nickname}
                  onChangeText={setNickname}
                  maxLength={40}
                />
              </>
            ) : null}
            <Field
              label="전화를 받았을 때, 첫 인사"
              multiline
              style={{ minHeight: 90 }}
              value={greeting}
              onChangeText={setGreeting}
              placeholder="{이름}, 나야. 우리 그 여름 기억나?"
              maxLength={300}
            />
            <Card>
              <Text style={s.eyebrow}>수화기 너머, 첫 장면</Text>
              <Text style={s.label}>{characterName || voice}</Text>
              <Text style={s.body}>
                “
                {(greeting || scenarioOf(scenario).opening).replaceAll(
                  "{이름}",
                  nickname || night.profile?.name || "너",
                )}
                ”
              </Text>
            </Card>
            {advanced ? (
              <>
                <Field
                  label="우리의 기념일 (선택 · YYYY-MM-DD)"
                  value={anniversary}
                  onChangeText={setAnniversary}
                  placeholder="2020-08-15"
                  maxLength={10}
                />
                <Field
                  label="꼭 듣고 싶은 말 (선택)"
                  value={phrase}
                  onChangeText={setPhrase}
                  placeholder="태어나줘서 고마워."
                  maxLength={200}
                />
              </>
            ) : null}
          </>
        ) : (
          <>
            <Card>
              <Text style={s.label}>{characterName || voice}에게 전화받기</Text>
              <Text style={s.body}>
                {relationship === "직접 입력" ? other : relationship} ·{" "}
                {personality.join(", ")} · {voice} 목소리
              </Text>
              <Text style={s.body}>
                “
                {(greeting || scenarioOf(scenario).opening).replaceAll(
                  "{이름}",
                  nickname || "너",
                )}
                ”
              </Text>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep(2)}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={s.body}>상대 설정 바꾸기</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep(1)}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={s.body}>목소리 바꾸기 · {voice}</Text>
                </Pressable>
              </View>
            </Card>
            <SectionTitle
              eyebrow="THE MOMENT"
              title="언제 전화할까요?"
              description={
                "현재 기기 시간대 · " +
                Intl.DateTimeFormat().resolvedOptions().timeZone
              }
            />
            {[
              { id: "22:00", label: "오늘 밤 10시" },
              { id: "23:00", label: "오늘 밤 11시" },
              { id: "00:00", label: "자정" },
              { id: "morning", label: "내일 아침 8시" },
              { id: "custom", label: "날짜와 시간 직접 선택" },
              ...(DEMO
                ? [{ id: "30s", label: "30초 뒤 · 지금 체험하기" }]
                : []),
            ].map((t) => (
              <Choice
                key={t.id}
                label={t.label}
                selected={when === t.id}
                onPress={() => setWhen(t.id)}
              />
            ))}
            {when === "custom" ? (
              <DateFields
                date={date}
                time={time}
                onDate={setDate}
                onTime={setTime}
              />
            ) : (
              <Text style={s.body}>이미 지난 시각은 다음 날로 예약해요.</Text>
            )}
            <Card>
              <Text style={s.label}>
                {characterName || voice} · {voice} 목소리
              </Text>
              <Text style={s.body}>
                {relationship === "직접 입력" ? other : relationship} ·{" "}
                {personality.join(", ") || "자연스럽게"}
              </Text>
              <Text style={s.body}>
                {DEMO
                  ? "앱을 열어 둔 상태에서 받는 체험 전화예요. 답장은 글로 입력하고, 기기 음성으로 들어요. 실제 휴대폰 전화는 아직 연결되지 않았어요."
                  : `받을 번호: ${night.profile?.phoneMasked ?? "마이에서 인증해 주세요"}`}
              </Text>
            </Card>
            <View style={s.row}>
              <Switch
                accessibilityLabel="대화 내용 저장 동의"
                value={consent}
                onValueChange={(v) => {
                  setConsent(v);
                  if (!v) setMemory(false);
                }}
              />
              <Text style={[s.body, { flex: 1 }]}>
                대화 내용과 오늘의 한마디 저장에 동의해요 (선택)
              </Text>
            </View>
            {consent ? (
              <View style={s.row}>
                <Switch
                  accessibilityLabel="다음 통화 기억 사용"
                  disabled={!night.profile?.memoryEnabled}
                  value={memory}
                  onValueChange={setMemory}
                />
                <Text style={[s.body, { flex: 1 }]}>
                  다음 전화에서 이 이야기를 기억해 주세요 (선택)
                </Text>
              </View>
            ) : null}
            <Text style={s.body}>
              음성은 녹음하지 않아요. 동의하지 않으면 시간·상황 등 예약 정보만
              남아요.
            </Text>
          </>
        )}
      </ScrollView>
      {step === 3 ? (
        <Text style={[s.body, s.center]}>
          {scheduleLabel()} · {characterName || voice}
        </Text>
      ) : null}
      <Button
        disabled={
          night.working ||
          (step === 2 &&
            (!characterName.trim() ||
              (relationship === "직접 입력" && !other.trim()))) ||
          (step === 0 && scenario === "custom" && !situation.trim())
        }
        onPress={() => {
          previewVersion.current++;
          void Speech.stop();
          player.pause();
          setPreview("");
          if (step === 3) void submit();
          else if (step === 2)
            setStep(initial || scenarioId !== "custom" ? 3 : 1);
          else if (step === 1)
            setStep(initial || scenarioId !== "custom" ? 3 : 0);
          else setStep(3);
        }}
      >
        {night.working
          ? "예약을 담고 있어요…"
          : step === 3
            ? initial?.status === "scheduled"
              ? "예약 수정 완료"
              : when === "30s"
                ? "30초 뒤 " + (characterName || voice) + "에게 전화받기"
                : "이 시간에 전화받기"
            : step === 2
              ? initial || scenarioId !== "custom"
                ? "시간 확인하기"
                : "목소리 선택하기"
              : step === 1
                ? voice + " 목소리로 계속"
                : "시간 정하기"}
      </Button>
    </View>
  );
}
