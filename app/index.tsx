import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNight } from "../src/hooks/useNight";
import { DEMO } from "../src/services/config";
import { Button, Orb, s, colors, sans } from "../src/components/ui";
import { Onboarding, SignIn } from "../src/screens/Welcome";
import { Home } from "../src/screens/Home";
import { CreateCall } from "../src/screens/CreateCall";
import {
  Waiting,
  Incoming,
  Conversation,
  RealCall,
  CallDone,
} from "../src/screens/Calls";
import { History } from "../src/screens/History";
import { Profile } from "../src/screens/Profile";
import { terminal, type Call } from "../shared/model";

import { GlassSurface, WarmBackdrop } from "../src/components/Glass";

type Screen = "home" | "create" | "waiting" | "history" | "profile" | "done";
export default function App() {
  const night = useNight(),
    [screen, setScreen] = useState<Screen>("home"),
    [selected, setSelected] = useState(""),
    [scenario, setScenario] = useState("future"),
    [initial, setInitial] = useState<Call | undefined>(),
    [wizardKey, setWizardKey] = useState(0);
  const scroll = useRef<ScrollView>(null),
    previous = useRef("");
  const live = night.profile
    ? (night.calls.find((c) => c.status === "connected") ??
      night.calls.find((c) => c.status === "calling"))
    : undefined;
  const call = night.calls.find((c) => c.id === selected);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [screen, live?.id, live?.status, night.onboarded, !!night.profile]);
  useEffect(() => {
    if (live) {
      previous.current = live.id;
      return;
    }
    if (previous.current) {
      const ended = night.calls.find((c) => c.id === previous.current);
      if (ended?.status === "completed") {
        setSelected(ended.id);
        setScreen("done");
      }
      previous.current = "";
    }
  }, [live?.id, night.calls]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (live) return true;
      if (screen !== "home") {
        setScreen("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen, live]);
  function create(id: string, old?: Call) {
    night.setNote("");
    setScenario(id);
    setInitial(old);
    setWizardKey((v) => v + 1);
    setScreen("create");
    night.setError("");
  }
  function navigate(next: Screen) {
    night.setError("");
    night.setNote("");
    setScreen(next);
  }
  if (!night.loaded)
    return (
      <SafeAreaView style={s.page}>
        <View style={s.content}>
          <Orb />
          <Text style={s.title}>Moonline을 열고 있어요.</Text>
          {night.error ? (
            <>
              <Text style={s.body}>{night.error}</Text>
              <Button onPress={() => void night.hydrate()}>다시 시도</Button>
            </>
          ) : null}
        </View>
      </SafeAreaView>
    );
  if (live?.status === "connected" && DEMO)
    return (
      <SafeAreaView style={s.page}>
        <WarmBackdrop />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Conversation
            key={live.id}
            night={night}
            call={live}
            onDone={() => {
              setSelected(live.id);
              setScreen("done");
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.page}>
      <WarmBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <GlassSurface
          style={[
            s.row,
            {
              paddingHorizontal: 20,
              paddingVertical: 8,
              marginHorizontal: 14,
              marginTop: 6,
              borderRadius: 24,
              justifyContent: "space-between",
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            disabled={!!live}
            onPress={() => navigate("home")}
          >
            <Text
              style={[
                s.label,
                {
                  letterSpacing: -0.8,
                  fontFamily: sans,
                  fontSize: 25,
                  fontWeight: "500",
                },
              ]}
            >
              Moonline <Text style={{ color: colors.accent }}>✦</Text>
            </Text>
          </Pressable>
          <Text style={s.eyebrow}>
            {DEMO ? "NIGHT LETTER / DEMO" : "NIGHT LETTER"}
          </Text>
        </GlassSurface>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={screen !== "create" || !!live}
          contentContainerStyle={[
            s.content,
            screen === "create" &&
              !live && { flex: 1, padding: 16, paddingBottom: 6 },
          ]}
          onContentSizeChange={() => {
            if (live?.status === "connected" && DEMO)
              scroll.current?.scrollToEnd({ animated: true });
          }}
        >
          {night.error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => night.setError("")}
            >
              <Text
                accessibilityRole="alert"
                style={{ color: "#A34538", lineHeight: 23 }}
              >
                {night.error} · 닫기
              </Text>
            </Pressable>
          ) : null}
          {night.note ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => night.setNote("")}
            >
              <Text style={s.body}>{night.note} · 닫기</Text>
            </Pressable>
          ) : null}
          {!night.onboarded ? (
            <Onboarding night={night} />
          ) : !night.profile ? (
            <SignIn night={night} />
          ) : live ? (
            DEMO ? (
              live.status === "calling" ? (
                <Incoming night={night} call={live} />
              ) : (
                <Conversation
                  key={live.id}
                  night={night}
                  call={live}
                  onDone={() => {
                    setSelected(live.id);
                    setScreen("done");
                  }}
                />
              )
            ) : (
              <RealCall night={night} call={live} />
            )
          ) : screen === "create" ? (
            <CreateCall
              key={wizardKey}
              night={night}
              scenarioId={scenario}
              initial={initial}
              onDone={(id) => {
                setSelected(id);
                setScreen("waiting");
              }}
              onBack={() => navigate("home")}
              onStep={() => scroll.current?.scrollTo({ y: 0, animated: false })}
            />
          ) : screen === "waiting" && call && !terminal(call.status) ? (
            <Waiting
              night={night}
              call={call}
              onEdit={() => create(call.scenarioId ?? "future", call)}
              onHome={() => navigate("home")}
            />
          ) : screen === "history" ? (
            <History
              night={night}
              onAgain={(c) =>
                create(c.scenarioId ?? "future", {
                  ...c,
                  id: "",
                  status: "draft",
                  scheduledAt: Date.now() + 3600000,
                })
              }
            />
          ) : screen === "profile" ? (
            <Profile night={night} />
          ) : screen === "done" && call ? (
            <CallDone
              night={night}
              call={call}
              onAgain={() =>
                create(call.scenarioId ?? "future", {
                  ...call,
                  id: "",
                  status: "draft",
                  scheduledAt: Date.now() + 3600000,
                })
              }
              onHistory={() => navigate("history")}
            />
          ) : (
            <Home
              night={night}
              onCharacter={(c) =>
                create(c.scenarioId ?? "future", {
                  ...c,
                  id: "",
                  status: "draft",
                  scheduledAt: Date.now() + 3600000,
                })
              }
              onCreate={(id) => create(id)}
              onCall={(id) => {
                setSelected(id);
                setScreen("waiting");
              }}
            />
          )}
        </ScrollView>
        {night.profile && !live ? (
          <GlassSurface
            accessibilityRole="tablist"
            style={[
              s.row,
              {
                paddingHorizontal: 6,
                paddingVertical: 8,
                marginHorizontal: 14,
                marginBottom: 10,
                borderRadius: 28,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: "rgba(255,249,233,.38)",
                justifyContent: "space-around",
              },
            ]}
          >
            {[
              { id: "home", label: "☾ 홈" },
              { id: "create", label: "＋ 전화 만들기" },
              { id: "history", label: "▤ 기록" },
              { id: "profile", label: "○ 마이" },
            ].map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: screen === t.id }}
                onPress={() =>
                  t.id === "create"
                    ? create("custom")
                    : navigate(t.id as Screen)
                }
                style={{
                  padding: 10,
                  borderRadius: 20,
                  backgroundColor:
                    screen === t.id ? "rgba(213,226,193,.8)" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: screen === t.id ? colors.accent : colors.muted,
                    fontSize: 13,
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </GlassSurface>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
