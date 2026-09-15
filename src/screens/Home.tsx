import { DEMO } from "../services/config";
import { Pressable, ScrollView, Text, View } from "react-native";
import { GlassSurface, MoonSpace } from "../components/Glass";

import { scenarios, scenarioOf } from "../../shared/catalog";
import { countdown, type Call } from "../../shared/model";
import { Button, Card, s, colors } from "../components/ui";
import type { Night } from "../hooks/useNight";
export function Home({
  night,
  onCreate,
  onCall,
  onCharacter,
}: {
  night: Night;
  onCreate: (id: string) => void;
  onCall: (id: string) => void;
  onCharacter: (call: Call) => void;
}) {
  const pending = night.calls
    .filter((c) => c.status === "scheduled")
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  return (
    <>
      <MoonSpace />
      <View style={{ gap: 12 }}>
        <Text style={s.eyebrow}>A VOICE TO END YOUR DAY</Text>
        <Text style={s.title}>오늘, 누구에게{"\n"}전화받고 싶나요?</Text>
        <Text style={s.body}>{night.profile?.name}님, 하루의 끝에 다정함을 남겨요.</Text>
      </View>
      <Button onPress={() => onCreate("comfort")}>
        {DEMO ? "다정한 전화 체험하기" : "다정한 전화 예약하기"}
      </Button>
      <Button secondary onPress={() => onCreate("custom")}>
        나만의 전화 만들기 · 이어 쓰기
      </Button>
      {DEMO ? <Text style={s.body}>앱 안에서 글로 답하고 기기 음성으로 듣는 체험판이에요.</Text> : null}
      {pending.length ? (
        <View style={{ gap: 12 }}>
          <Text style={s.label}>
            기다리는 전화{" "}
            <Text style={{ color: colors.accent }}>{pending.length}</Text>
          </Text>
          {pending.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() => onCall(c.id)}
            >
              <Card>
                <Text style={s.eyebrow}>
                  {scenarioOf(c.scenarioId).emoji} {c.characterName || c.voice}
                  에게서
                </Text>
                <Text style={s.label}>{scenarioOf(c.scenarioId).title}</Text>
                <Text style={s.body}>
                  {new Date(c.scheduledAt).toLocaleString("ko-KR", {
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={[s.time, { fontSize: 30 }]}>
                  {countdown(c.scheduledAt, night.now)}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}
      {night.calls.some((c) => c.characterId) ? (
        <View style={{ gap: 12 }}>
          <Text style={s.label}>다시 듣고 싶은 목소리</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {Array.from(
              new Map(
                [...night.calls]
                  .reverse()
                  .filter((c) => c.characterId)
                  .map((c) => [c.characterId, c]),
              ).values(),
            ).map((c) => (
              <Pressable
                key={c.characterId}
                accessibilityRole="button"
                onPress={() => onCharacter(c)}
                style={s.chip}
              >
                <Text style={s.label}>{c.characterName || c.voice}</Text>
                <Text style={s.body}>{c.relationship} · 다시 예약 ↗</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={[s.row, { justifyContent: "space-between", marginTop: 8 }]}>
        <Text style={s.label}>오늘 밤의 추천</Text>
        <Text style={s.body}>옆으로 넘겨보세요 →</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={290}
        decelerationRate="fast"
        contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
      >
        {scenarios
          .filter((c) => c.id !== "custom")
          .map((c, i) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={c.category + " 전화 선택"}
              onPress={() => onCreate(c.id)}
            >
              <GlassSurface
                style={[
                  s.card,
                  {
                    width: 276,
                    minHeight: 290,
                    backgroundColor: c.color + "16",
                    justifyContent: "space-between",
                  },
                ]}
              >
                <Text style={s.eyebrow}>
                  0{i + 1} / {c.category}
                </Text>
                <Text
                  style={{
                    fontSize: 74,
                    color: colors.accent,
                    textAlign: "center",
                    marginVertical: 8,
                  }}
                >
                  {c.emoji}
                </Text>
                <View style={{ gap: 12 }}>
                  <Text style={[s.title, { fontSize: 23, lineHeight: 32 }]}>
                    {c.title}
                  </Text>
                  <Text style={s.body}>{c.description}</Text>
                  <Text style={{ color: colors.accent }}>
                    이 전화 받아보기 ↗
                  </Text>
                </View>
              </GlassSurface>
            </Pressable>
          ))}
      </ScrollView>
      <Button secondary onPress={() => onCreate("custom")}>
        ＋ 나만의 전화 만들기
      </Button>
      <Text style={[s.body, s.center]}>
        아직 오지 않은 순간에도,{"\n"}당신을 위한 목소리가 있어요.
      </Text>
    </>
  );
}
