import { VoiceLibrary } from "../components/VoiceLibrary";
import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Button, Card, s } from "../components/ui";
import { Field, SectionTitle } from "../components/fields";
import { DEMO } from "../services/config";
import { api } from "../services/api";
import { supabase } from "../services/auth";
import {
  pushToken,
  cancelReminder,
  scheduleReminder,
} from "../services/notifications";
import type { Night } from "../hooks/useNight";
export function Profile({ night }: { night: Night }) {
  const [name, setName] = useState(night.profile?.name ?? ""),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    night.setError("");
    try {
      await fn();
    } catch (e) {
      night.setError(
        e instanceof Error ? e.message : "요청을 처리하지 못했어요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle eyebrow="YOUR LITTLE CORNER" title="나의 Moonline" />
      <Card>
        <Text style={s.label}>{night.profile?.name}님의 편지함</Text>
        <Text style={s.body}>
          {DEMO ? "이 기기에 저장되는 체험판" : night.profile?.email}
        </Text>
        <Text style={s.body}>
          함께한 전화{" "}
          {night.calls.filter((c) => c.status === "completed").length}통 ·
          저장한 한마디 {night.calls.filter((c) => c.favorite).length}개
        </Text>
      </Card>
      <Field
        label="불러줬으면 하는 이름"
        value={name}
        onChangeText={setName}
        maxLength={40}
      />
      <Button
        secondary
        disabled={night.working || !name.trim()}
        onPress={() => void night.saveProfile({ name: name.trim() })}
      >
        이름 저장
      </Button>
      <Text style={s.body}>
        시간대 · {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </Text>
      <Card>
        <View style={s.row}>
          <Text style={[s.label, { flex: 1 }]}>이야기 기억하기</Text>
          <Switch
            accessibilityLabel="기억 사용 설정"
            value={night.profile?.memoryEnabled ?? false}
            onValueChange={(v) => void night.saveProfile({ memoryEnabled: v })}
          />
        </View>
        <Text style={s.body}>
          각 예약에서 동의한 이야기만 다음 통화에 사용해요. 끄면 이전 기억을
          대화에 사용하지 않아요. 기존 기억은 기록에서 지울 수 있어요.
        </Text>
      </Card>
      <Card>
        <View style={s.row}>
          <Text style={[s.label, { flex: 1 }]}>전화 전 알림</Text>
          <Switch
            accessibilityLabel="알림 설정"
            disabled={busy}
            value={night.profile?.notificationsEnabled ?? false}
            onValueChange={(v) =>
              void action(async () => {
                await night.saveProfile({ notificationsEnabled: v });
                if (DEMO) {
                  for (const c of night.calls.filter(
                    (c) => c.status === "scheduled",
                  )) {
                    if (v) night.setNote((await scheduleReminder(c)) ?? "");
                    else await cancelReminder(c.id);
                  }
                }
              })
            }
          />
        </View>
        <Text style={s.body}>
          30분 전과 5분 전에 알려드려요. 마지막 1분에는 알림을 보내지 않아요.
        </Text>
        {!DEMO ? (
          <Button
            secondary
            disabled={busy}
            onPress={() =>
              void action(async () => {
                await api("/me/push-token", "POST", {
                  token: await pushToken(),
                });
                night.setNote("이 기기의 알림을 연결했어요.");
              })
            }
          >
            이 기기 알림 연결
          </Button>
        ) : null}
      </Card>
      {!DEMO ? (
        <Card>
          <Text style={s.label}>전화 받을 번호</Text>
          <Text style={s.body}>
            {night.profile?.phoneMasked ?? "등록된 번호가 없어요."}{" "}
            {night.profile?.phoneVerified ? "· 인증 완료" : ""}
          </Text>
          <Field
            label="휴대폰 번호 (국가번호 포함)"
            value={phone}
            onChangeText={setPhone}
            placeholder="+821012345678"
            keyboardType="phone-pad"
            maxLength={16}
          />
          <Button
            secondary
            disabled={busy || !/^\+[1-9]\d{7,14}$/.test(phone)}
            onPress={() =>
              void action(async () => {
                await api("/me/phone/start", "POST", { phone });
                setSent(true);
                night.setNote("인증 문자를 보냈어요.");
              })
            }
          >
            인증번호 받기
          </Button>
          {sent ? (
            <>
              <Field
                label="인증번호"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Button
                disabled={busy || code.length !== 6}
                onPress={() =>
                  void action(async () => {
                    await api("/me/phone/verify", "POST", { phone, code });
                    setPhone("");
                    setCode("");
                    setSent(false);
                    await night.refresh();
                  })
                }
              >
                인증 완료
              </Button>
            </>
          ) : null}
        </Card>
      ) : (
        <Text style={s.body}>
          체험판은 실제 전화번호를 수집하지 않아요. 대화는 규칙형 데모이며
          목소리는 기기의 읽기 음성을 사용합니다.
        </Text>
      )}
      <Text style={s.body}>
        Moonline의 인물은 가상의 캐릭터입니다. 직접 녹음 버튼을 눌렀을 때만 마이크를 사용해요. 대화 저장
        여부는 예약할 때 선택할 수 있어요.
      </Text>
      <VoiceLibrary ownerId={night.profile!.id} />
      {!DEMO ? (
        <Button secondary onPress={() => void supabase?.auth.signOut()}>
          로그아웃
        </Button>
      ) : null}
      <Text style={[s.eyebrow, s.center]}>Moonline · MVP 0.2</Text>
    </>
  );
}
