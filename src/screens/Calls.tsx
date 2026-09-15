import { wantsToEnd } from "../../shared/memory";
import { useEffect, useRef, useState } from "react";
import { Switch, ScrollView, Text, View, Vibration } from "react-native";
import * as Speech from "expo-speech";
import { scenarioOf, voiceOf } from "../../shared/catalog";
import {
  type Call,
  type Message,
  countdown,
  elapsed,
} from "../../shared/model";
import { FilmPoster } from "../components/FilmPoster";
import { waitingStage } from "../../shared/waiting";
import { Button, Card, Orb, s, colors, sans } from "../components/ui";
import { Field, SectionTitle } from "../components/fields";
import { opening, mockReply } from "../services/conversation";
import { DEMO } from "../services/config";
import type { Night } from "../hooks/useNight";
export function Waiting({
  night,
  call,
  onEdit,
  onHome,
}: {
  night: Night;
  call: Call;
  onEdit: () => void;
  onHome: () => void;
}) {
  const [testState, setTestState] = useState<
    "idle" | "playing" | "confirm" | "heard" | "failed"
  >("idle");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      void Speech.stop();
    };
  }, []);
  const name = call.characterName || call.voice,
    stage = waitingStage(call.scheduledAt - night.now);
  return (
    <>
      <Text style={s.eyebrow}>
        {stage === "soon" ? "잠시 후 전화가 도착해요" : "예약이 담겼어요"}
      </Text>
      <Text style={s.title}>{name}에게서 오는 전화</Text>
      <FilmPoster script="" height={260}>
        <Text style={{ color: "#FFF7DF", fontSize: 18 }}>
          {call.userNickname || night.profile?.name}님, 곧 만나요.
        </Text>
        <Text
          accessibilityLiveRegion="none"
          style={[s.time, { color: "#FFF2CB", fontSize: 38 }]}
        >
          {countdown(call.scheduledAt, night.now)}
        </Text>
        <Text style={{ color: "#FFF7DF", fontSize: 14 }}>
          {new Date(call.scheduledAt).toLocaleString("ko-KR", {
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </FilmPoster>
      <Text style={s.body}>
        {DEMO
          ? "체험 전화는 이 앱을 열어 둔 상태에서 도착해요. 답장은 글로 입력해요."
          : "앱을 닫아도 인증한 휴대폰으로 전화가 와요. 휴대폰의 통화 화면에서 받아 주세요."}
      </Text>
      {DEMO ? (
        <Card>
          <Text style={s.label}>목소리를 들을 준비</Text>
          <Button
            secondary
            onPress={() => {
              setTestState("playing");
              Speech.speak("잘 들리나요? 곧 만나요.", {
                language: "ko-KR",
                onDone: () => {
                  if (active.current)
                    setTestState((value) =>
                      value === "playing" ? "confirm" : value,
                    );
                },
                onError: () => {
                  if (active.current) setTestState("failed");
                },
              });
            }}
          >
            {testState === "heard"
              ? "✓ 확인 완료 · 다시 듣기"
              : testState === "playing"
                ? "재생 중 · 다시 듣기"
                : "소리 시험하기"}
          </Button>
          {testState === "playing" || testState === "confirm" ? (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => setTestState("heard")}>잘 들려요</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button secondary onPress={() => setTestState("failed")}>
                  안 들려요
                </Button>
              </View>
            </View>
          ) : null}
          {testState === "failed" ? (
            <Text style={s.body}>
              기기 볼륨·무음 설정을 확인한 뒤 다시 들어보세요. 소리가 없어도
              글로 체험할 수 있어요.
            </Text>
          ) : null}
        </Card>
      ) : null}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button secondary onPress={onEdit}>
            시간·설정 수정
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            disabled={night.working}
            onPress={() =>
              void night.cancel(call.id).then((ok) => {
                if (ok) onHome();
              })
            }
          >
            예약 취소
          </Button>
        </View>
      </View>
      <Button secondary onPress={onHome}>
        홈으로
      </Button>
    </>
  );
}
export function Incoming({ night, call }: { night: Night; call: Call }) {
  useEffect(() => {
    Vibration.vibrate([0, 450, 650, 450], true);
    return () => Vibration.cancel();
  }, [call.id]);
  return (
    <>
      <Text style={[s.eyebrow, s.center]}>INCOMING CALL</Text>
      <Orb letter={(call.characterName || call.voice)[0]} pulse />
      <Text style={[s.title, s.center]}>
        {call.characterName || call.voice}
      </Text>
      <Text style={[s.body, s.center]}>
        {scenarioOf(call.scenarioId).title}
      </Text>
      <Text style={[s.body, s.center]}>앱 안에서 받는 데모 전화</Text>
      <View style={{ height: 30 }} />
      <Button
        disabled={night.working}
        onPress={() => void night.accept(call.id)}
      >
        ↗ 전화 받기
      </Button>
      <Button
        secondary
        disabled={night.working}
        onPress={() => void night.cancel(call.id)}
      >
        거절
      </Button>
    </>
  );
}
export function Conversation({
  night,
  call,
  onDone,
}: {
  night: Night;
  call: Call;
  onDone: () => void;
}) {
  const memory = night.profile?.memoryEnabled
    ? night.calls.find(
        (c) =>
          c.id !== call.id &&
          c.status === "completed" &&
          c.memoryConsent &&
          c.summary &&
          (call.characterId
            ? c.characterId === call.characterId
            : c.voice === call.voice && c.scenarioId === call.scenarioId),
      )?.summary
    : undefined;
  const [messages, setMessages] = useState<Message[]>(() => [
      {
        speaker: "caller",
        text: opening(call, night.profile?.name ?? "", memory),
        at: Date.now(),
      },
    ]),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [sound, setSound] = useState(true),
    [audioError, setAudioError] = useState("");
  const messageScroll = useRef<ScrollView>(null),
    audioVersion = useRef(0);
  const version = useRef(0),
    locked = useRef(false);
  function speak(text: string) {
    if (!sound) return;
    const v = voiceOf(call.voice);
    const token = ++audioVersion.current;
    void Speech.stop();
    Speech.speak(text, {
      language: "ko-KR",
      pitch: v.pitch,
      rate: v.rate,
      onError: () => {
        if (token === audioVersion.current)
          setAudioError(
            "음성을 재생하지 못했어요. 글로 계속하거나 소리를 다시 켜주세요.",
          );
      },
    });
  }
  useEffect(() => {
    speak(messages[0].text);
    return () => {
      version.current++;
      audioVersion.current++;
      void Speech.stop();
    };
  }, []);
  async function finish(finalMessages = messages) {
    version.current++;
    audioVersion.current++;
    locked.current = true;
    void Speech.stop();
    const ok = await night.complete(call.id, finalMessages);
    if (ok) {
      night.setNote("");
      onDone();
    } else {
      locked.current = false;
      setBusy(false);
    }
  }
  async function send(text = draft) {
    if (locked.current || !text.trim()) return;
    locked.current = true;
    setBusy(true);
    const token = ++version.current,
      next = [
        ...messages,
        { speaker: "you" as const, text: text.trim(), at: Date.now() },
      ];
    setMessages(next);
    setDraft("");
    await new Promise((resolve) => setTimeout(resolve, 650));
    if (token !== version.current) return;
    const reply = mockReply(text, call, next);
    const replied: Message[] = [
      ...next,
      { speaker: "caller", text: reply, at: Date.now() },
    ];
    setMessages(replied);
    if (wantsToEnd(text)) {
      await finish(replied);
      return;
    }
    speak(reply);
    setBusy(false);
    locked.current = false;
  }
  return (
    <View
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 520,
        alignSelf: "center",
        padding: 16,
        gap: 10,
      }}
    >
      <Text style={[s.eyebrow, s.center]}>
        CONNECTED ·{" "}
        {elapsed(
          Math.max(
            0,
            Math.floor((night.now - (call.startedAt ?? night.now)) / 1000),
          ),
        )}
      </Text>
      <Text style={[s.title, s.center]}>
        {call.characterName || call.voice}
      </Text>
      <Text style={[s.body, s.center]}>
        {scenarioOf(call.scenarioId).title}
        {"\n"}데모 대화 · 답장을 입력하거나 골라주세요.
      </Text>
      <View style={[s.row, { justifyContent: "center" }]}>
        <Text style={s.body}>소리로 듣기</Text>
        <Switch
          accessibilityLabel="소리로 듣기"
          value={sound}
          onValueChange={(v) => {
            setSound(v);
            audioVersion.current++;
            setAudioError("");
            if (!v) void Speech.stop();
          }}
        />
      </View>
      {audioError ? <Text style={s.body}>{audioError}</Text> : null}
      {night.error ? (
        <Text accessibilityRole="alert" style={s.body}>
          {night.error}
        </Text>
      ) : null}
      <ScrollView
        ref={messageScroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 10 }}
        onContentSizeChange={() =>
          messageScroll.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              s.card,
              {
                alignSelf: m.speaker === "you" ? "flex-end" : "flex-start",
                maxWidth: "94%",
                backgroundColor: m.speaker === "you" ? "#E6E9D8" : "#FAF6ED",
              },
            ]}
          >
            <Text style={s.eyebrow}>
              {m.speaker === "you" ? "나" : call.characterName || call.voice}
            </Text>
            <Text style={{ color: colors.text, fontSize: 16, lineHeight: 26 }}>
              {m.text}
            </Text>
          </View>
        ))}
        {busy ? <Text style={s.body}>잠시 생각하고 있어요…</Text> : null}
      </ScrollView>
      <View style={s.row}>
        {["다른 얘기 하자", "고마워"].map((t) => (
          <View key={t} style={{ flex: 1 }}>
            <Button secondary disabled={busy} onPress={() => void send(t)}>
              {t}
            </Button>
          </View>
        ))}
      </View>
      <Field
        label="대화 입력"
        value={draft}
        onChangeText={setDraft}
        placeholder="지금의 마음을 들려주세요"
        maxLength={500}
        onSubmitEditing={() => void send()}
      />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Button disabled={busy || !draft.trim()} onPress={() => void send()}>
            이야기하기
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            disabled={night.working}
            onPress={() => void finish()}
          >
            통화 마치기
          </Button>
        </View>
      </View>
    </View>
  );
}
export function RealCall({ night, call }: { night: Night; call: Call }) {
  return (
    <>
      <Orb letter={call.voice[0]} pulse />
      <SectionTitle
        eyebrow="YOUR PHONE IS CALLING"
        title={
          call.status === "connected"
            ? "전화가 연결되었어요."
            : "휴대폰으로 전화하고 있어요."
        }
        description="휴대폰의 통화 화면에서 대화해 주세요. 통화가 끝나면 기록이 자동으로 도착합니다."
      />
      <Button secondary onPress={() => void night.refresh()}>
        상태 새로고침
      </Button>
      <Button
        disabled={night.working}
        onPress={() => void night.complete(call.id, [])}
      >
        통화 종료 요청
      </Button>
    </>
  );
}
export function CallDone({
  call,
  night,
  onAgain,
  onHistory,
}: {
  call: Call;
  night: Night;
  onAgain: () => void;
  onHistory: () => void;
}) {
  return (
    <>
      <Orb letter={(call.characterName || call.voice)[0]} />
      <SectionTitle
        eyebrow="A LETTER TO KEEP"
        title={(call.characterName || call.voice) + "와의 통화를 마쳤어요."}
      />
      <Text style={s.body}>
        {new Date(call.endedAt ?? Date.now()).toLocaleString("ko-KR")} ·{" "}
        {elapsed(call.duration)}
      </Text>
      <Card>
        <Text style={s.label}>
          {scenarioOf(call.scenarioId).emoji}{" "}
          {scenarioOf(call.scenarioId).title}
        </Text>
        {call.quote ? (
          <>
            <Text style={s.eyebrow}>오늘의 한마디</Text>
            <Text style={[s.title, { fontSize: 22, lineHeight: 34 }]}>
              “{call.quote}”
            </Text>
            <Button secondary onPress={() => void night.favorite(call.id)}>
              {call.favorite ? "♥ 저장됨" : "♡ 저장"}
            </Button>
          </>
        ) : (
          <Text style={s.body}>
            {call.consent
              ? DEMO
                ? "나눈 대화가 없어 한마디를 남기지 않았어요."
                : "한마디가 아직 없어요. 기록에서 다시 확인해 주세요."
              : "대화 내용은 저장하지 않았어요."}
          </Text>
        )}
      </Card>
      <Button onPress={onAgain}>다시 전화받기</Button>
      <Button secondary onPress={onHistory}>
        통화 기록 보기
      </Button>
    </>
  );
}
