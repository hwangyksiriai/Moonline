import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Orb, s } from "../components/ui";
import { Field, SectionTitle } from "../components/fields";
import { DEMO } from "../services/config";
import { emailAuth, oauth } from "../services/auth";
import type { Night } from "../hooks/useNight";
const pages = [
  {
    icon: "✉",
    title: "기다리던 사람에게서\n전화가 옵니다.",
    body: "원하는 사람과 상황을 선택하세요.",
  },
  {
    icon: "☾",
    title: "전화 받을 시간을\n정하세요.",
    body: "오늘 밤 10시. 생일이 되는 순간.\n당신의 시간에 맞춰 기다릴게요.",
  },
  {
    icon: "✦",
    title: "그리고,\n전화가 도착합니다.",
    body: "당신의 이야기를 듣고\n대화를 이어갑니다.",
  },
];
export function Onboarding({ night }: { night: Night }) {
  const [page, setPage] = useState(0),
    p = pages[page];
  return (
    <>
      <Text style={s.eyebrow}>A LETTER, JUST FOR YOU</Text>
      <Orb letter={p.icon} />
      <Text style={s.title}>{p.title}</Text>
      <Text style={s.body}>{p.body}</Text>
      <View style={[s.row, { marginVertical: 28 }]}>
        {pages.map((_, i) => (
          <View
            key={i}
            style={{
              height: 4,
              width: i === page ? 40 : 12,
              borderRadius: 4,
              backgroundColor: i === page ? "#5B7158" : "#DDD5C1",
            }}
          />
        ))}
      </View>
      {DEMO ? (
        <Text style={s.body}>
          체험판은 앱 안에서 가상의 인물과 대화해요. 글로 답하고 기기의 읽기
          음성으로 듣습니다. 실제 휴대폰 전화는 아직 연결되지 않았어요.
        </Text>
      ) : null}
      <Button
        disabled={night.working}
        onPress={() =>
          page < 2 ? setPage(page + 1) : void night.finishOnboarding()
        }
      >
        {page === 2 ? "첫 전화 예약하기" : "다음"}
      </Button>
      <Button secondary onPress={() => void night.finishOnboarding()}>
        건너뛰기
      </Button>
    </>
  );
}
export function SignIn({ night }: { night: Night }) {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(action: () => Promise<unknown>) {
    setBusy(true);
    night.setError("");
    try {
      const result = await action();
      if (typeof result === "string") night.setNote(result);
    } catch (e) {
      night.setError(
        e instanceof Error ? e.message : "로그인을 완료하지 못했어요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="YOUR LETTERBOX"
        title={DEMO ? "어떤 이름으로\n불러드릴까요?" : "당신만의 Moonline함"}
        description={
          DEMO
            ? "이름 하나면 시작할 수 있어요. 가입 없이 기기에 저장되는 체험판입니다."
            : "로그인하면 예약과 기록을 안전하게 이어볼 수 있어요."
        }
      />
      {DEMO || signup ? (
        <Field
          label="이름"
          value={name}
          onChangeText={setName}
          maxLength={40}
          placeholder="밤의 여행자"
        />
      ) : null}
      {DEMO ? (
        <Button
          disabled={night.working}
          onPress={() => void night.enterDemo(name)}
        >
          Moonline 시작하기
        </Button>
      ) : (
        <>
          <Button
            secondary
            disabled={busy}
            onPress={() => void submit(() => oauth("apple"))}
          >
            Apple로 계속하기
          </Button>
          <Button
            secondary
            disabled={busy}
            onPress={() => void submit(() => oauth("google"))}
          >
            Google로 계속하기
          </Button>
          <View style={s.divider} />
          <Field
            label="이메일"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Field
            label="비밀번호"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            disabled={busy || !email || password.length < 8}
            onPress={() =>
              void submit(() => emailAuth(email, password, name, signup))
            }
          >
            {busy
              ? "연결 중…"
              : signup
                ? "이메일로 가입하기"
                : "이메일로 로그인"}
          </Button>
          <Button secondary onPress={() => setSignup(!signup)}>
            {signup ? "이미 계정이 있어요" : "처음이에요 · 가입하기"}
          </Button>
          <Text style={s.body}>비밀번호는 8자 이상 입력해 주세요.</Text>
        </>
      )}
    </>
  );
}
