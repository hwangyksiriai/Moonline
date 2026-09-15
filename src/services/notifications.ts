import { Platform } from "react-native";
import Constants from "expo-constants";
import type { Call } from "../../shared/model";
import { scenarioOf } from "../../shared/catalog";
export async function cancelReminder(id: string) {
  if (Platform.OS === "web") return;
  const N = await import("expo-notifications");
  await Promise.all(
    [id, id + "-30", id + "-5"].map((key) =>
      N.cancelScheduledNotificationAsync(key),
    ),
  );
}
export async function scheduleReminder(call: Call) {
  if (Platform.OS === "web")
    return "브라우저에서는 앱을 열어 두면 전화가 도착해요.";
  try {
    const N = await import("expo-notifications");
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === "android")
      await N.setNotificationChannelAsync("calls", {
        name: "기다리는 전화",
        importance: N.AndroidImportance.MAX,
        sound: "default",
      });
    if (!(await N.requestPermissionsAsync()).granted)
      return "알림이 꺼져 있어요. 예약 시간에 앱을 열어 주세요.";
    await cancelReminder(call.id);
    for (const minutes of [30, 5, 0]) {
      const at = call.scheduledAt - minutes * 60000;
      if (at <= Date.now()) continue;
      await N.scheduleNotificationAsync({
        identifier: minutes ? call.id + "-" + minutes : call.id,
        content: {
          title: "Moonline · " + scenarioOf(call.scenarioId).category,
          body:
            minutes === 30
              ? "30분 뒤 전화가 옵니다."
              : minutes === 5
                ? "조금 있으면 전화가 옵니다."
                : "기다리던 전화가 도착했어요. 눌러서 받아주세요.",
          sound: "default",
          data: { callId: call.id },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: new Date(at),
          channelId: "calls",
        },
      });
    }
    return "";
  } catch {
    return "알림을 예약하지 못했어요. 앱을 열어 두면 수신할 수 있어요.";
  }
}
export async function pushToken() {
  if (Platform.OS === "web" || Constants.appOwnership === "expo")
    throw new Error("원격 알림은 개발 빌드에서 연결할 수 있어요.");
  const N = await import("expo-notifications");
  if (Platform.OS === "android")
    await N.setNotificationChannelAsync("calls", {
      name: "기다리는 전화",
      importance: N.AndroidImportance.HIGH,
    });
  if (!(await N.requestPermissionsAsync()).granted)
    throw new Error("알림 권한을 허용해 주세요.");
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("EAS 프로젝트 설정이 필요해요.");
  return (await N.getExpoPushTokenAsync({ projectId })).data;
}
