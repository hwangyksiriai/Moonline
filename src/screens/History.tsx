import { memoryLines, quoteCandidates } from "../../shared/memory";
import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import type { Night } from "../hooks/useNight";
import { scenarioOf } from "../../shared/catalog";
import { elapsed, terminal, type Call } from "../../shared/model";
import { Button, Card, s, colors } from "../components/ui";
import { Choice, Field, SectionTitle } from "../components/fields";
export function History({
  night,
  onAgain,
}: {
  night: Night;
  onAgain: (c: Call) => void;
}) {
  const [filter, setFilter] = useState("all"),
    [person, setPerson] = useState("all"),
    [open, setOpen] = useState(""),
    [confirm, setConfirm] = useState(""),
    [editing, setEditing] = useState(""),
    [memoryDraft, setMemoryDraft] = useState("");
  const calls = night.calls
    .filter(
      (c) =>
        terminal(c.status) &&
        (filter === "all" || c.favorite) &&
        (person === "all" || c.characterId === person),
    )
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
  return (
    <>
      <SectionTitle
        eyebrow="LETTERS YOU HAVE RECEIVED"
        title="지나온 밤의 목소리"
        description="시간은 지나도, 다정한 말은 남으니까."
      />
      <View style={s.row}>
        <Choice
          label="전체 기록"
          selected={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <Choice
          label="♥ 저장한 한마디"
          selected={filter === "saved"}
          onPress={() => setFilter("saved")}
        />
      </View>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Choice
          label="모든 상대"
          selected={person === "all"}
          onPress={() => setPerson("all")}
        />
        {Array.from(
          new Map(
            night.calls
              .filter((c) => c.characterId)
              .map((c) => [c.characterId, c]),
          ).values(),
        ).map((c) => (
          <Choice
            key={c.characterId}
            label={c.characterName || c.voice}
            selected={person === c.characterId}
            onPress={() => setPerson(c.characterId!)}
          />
        ))}
      </View>
      {calls.length === 0 ? (
        <Card>
          <Text style={s.label}>
            {filter === "all"
              ? "아직 도착한 편지가 없어요."
              : "저장한 한마디가 없어요."}
          </Text>
          <Text style={s.body}>통화를 마친 뒤 이곳에서 다시 만나세요.</Text>
        </Card>
      ) : (
        calls.map((c) => (
          <Card key={c.id}>
            <Text style={s.eyebrow}>
              {new Date(c.endedAt ?? c.scheduledAt).toLocaleDateString(
                "ko-KR",
                { month: "long", day: "numeric" },
              )}{" "}
              ·{" "}
              {new Date(c.endedAt ?? c.scheduledAt).toLocaleTimeString(
                "ko-KR",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(open === c.id ? "" : c.id)}
            >
              <Text style={s.label}>
                {scenarioOf(c.scenarioId).emoji} {c.characterName || c.voice}
                에게서 온 전화
              </Text>
              <Text style={s.body}>
                {c.characterName || c.voice} ·{" "}
                {c.status === "completed"
                  ? elapsed(c.duration)
                  : c.status === "cancelled"
                    ? "취소된 전화"
                    : "연결하지 못한 전화"}{" "}
                · {open === c.id ? "접기 ↑" : "자세히 ↓"}
              </Text>
            </Pressable>
            {c.quote ? (
              <>
                <Text style={[s.body, { color: colors.accent }]}>“{c.quote}”</Text>
                <Button secondary onPress={() => void night.favorite(c.id)}>
                  {c.favorite ? "♥ 저장됨" : "♡ 한마디 저장"}
                </Button>
              </>
            ) : null}
            {open === c.id ? (
              <>
                <Text style={s.body}>상황 · {c.situation}</Text>
                {c.failureReason ? (
                  <Text style={s.body}>{c.failureReason}</Text>
                ) : null}
                {c.summary ? (
                  <>
                    <Text style={s.eyebrow}>기억하는 이야기</Text>
                    <Text style={s.body}>
                      다음 통화에 참고하는 내용이에요. 수정하거나 한 줄씩 지울
                      수 있어요.
                    </Text>
                    <View style={s.row}>
                      <Switch
                        accessibilityLabel="이 기억을 다음 통화에 사용"
                        value={!!c.memoryConsent}
                        onValueChange={(v) =>
                          void night.editKeepsake(c.id, { memoryConsent: v })
                        }
                      />
                      <Text style={s.body}>다음 통화에 사용</Text>
                    </View>
                    {memoryLines(c.summary).map((line, i, lines) => (
                      <View key={i} style={{ gap: 6 }}>
                        <Text style={s.body}>{line}</Text>
                        <Button
                          secondary
                          disabled={night.working}
                          onPress={() =>
                            void night.editKeepsake(c.id, {
                              summary: lines
                                .filter((_, j) => i !== j)
                                .join("\n"),
                            })
                          }
                        >
                          이 기억만 지우기
                        </Button>
                      </View>
                    ))}
                    <Button
                      secondary
                      onPress={() => {
                        setEditing(c.id);
                        setMemoryDraft(memoryLines(c.summary).join("\n"));
                      }}
                    >
                      기억 내용 수정
                    </Button>
                  </>
                ) : null}
                {editing === c.id ? (
                  <>
                    <Field
                      label="다음 통화에서 기억할 내용 · 한 줄에 하나씩"
                      multiline
                      maxLength={600}
                      value={memoryDraft}
                      onChangeText={setMemoryDraft}
                    />
                    <Button
                      disabled={night.working}
                      onPress={() =>
                        void night
                          .editKeepsake(c.id, { summary: memoryDraft.trim() })
                          .then((ok) => {
                            if (ok) setEditing("");
                          })
                      }
                    >
                      기억 수정 저장
                    </Button>
                    <Button secondary onPress={() => setEditing("")}>
                      수정 취소
                    </Button>
                  </>
                ) : null}
                {quoteCandidates(c).length ? (
                  <>
                    <Text style={s.eyebrow}>남기고 싶은 한마디 고르기</Text>
                    {quoteCandidates(c).map((q) => (
                      <Choice
                        key={q}
                        label={q}
                        selected={q === c.quote}
                        onPress={() =>
                          void night.editKeepsake(c.id, { quote: q })
                        }
                      />
                    ))}
                    <Button
                      secondary
                      onPress={() =>
                        void night.editKeepsake(c.id, { quote: null })
                      }
                    >
                      한마디 남기지 않기
                    </Button>
                  </>
                ) : null}
                <Text style={s.eyebrow}>나눈 대화</Text>
                {c.messages?.map((m, i) => (
                  <Text key={i} style={s.body}>
                    {m.speaker === "you" ? "나" : c.characterName || c.voice} ·{" "}
                    {m.text}
                  </Text>
                ))}
                {!c.consent ? (
                  <Text style={s.body}>대화 내용은 저장하지 않았어요.</Text>
                ) : null}
                <Button onPress={() => onAgain(c)}>다시 전화받기</Button>
                {c.consent ? (
                  <Button secondary onPress={() => setConfirm(c.id)}>
                    이 대화와 기억 지우기
                  </Button>
                ) : null}
                {confirm === c.id ? (
                  <>
                    <Text style={s.body}>
                      대화와 기억, 한마디를 지울까요? 통화 시간은 남고, 지운
                      내용은 복구할 수 없어요.
                    </Text>
                    <Button
                      disabled={night.working}
                      onPress={() =>
                        void night.forget(c.id).then(() => setConfirm(""))
                      }
                    >
                      지우기
                    </Button>
                    <Button secondary onPress={() => setConfirm("")}>
                      유지하기
                    </Button>
                  </>
                ) : null}
              </>
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}
