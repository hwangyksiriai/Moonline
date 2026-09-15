import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { DEMO } from "./config";
WebBrowser.maybeCompleteAuthSession();
const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return sessionStorage.getItem(key);
    const count = Number((await SecureStore.getItemAsync(key + ".count")) ?? 0);
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(key + "." + i),
      ),
    );
    return parts.some((p) => p === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      sessionStorage.setItem(key, value);
      return;
    }
    const count = Math.ceil(value.length / 1500);
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        key + "." + i,
        value.slice(i * 1500, (i + 1) * 1500),
      );
    await SecureStore.setItemAsync(key + ".count", String(count));
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      sessionStorage.removeItem(key);
      return;
    }
    const count = Number((await SecureStore.getItemAsync(key + ".count")) ?? 0);
    await SecureStore.deleteItemAsync(key + ".count");
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(key + "." + i),
      ),
    );
  },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase =
  !DEMO && url && key
    ? createClient(url, key, {
        auth: {
          storage: secureStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === "web",
          flowType: "pkce",
        },
      })
    : null;
export function requireAuth() {
  if (!supabase)
    throw new Error(
      "로그인 연결 설정이 필요해요. 서버 설정 안내를 확인해 주세요.",
    );
  return supabase;
}
export async function emailAuth(
  email: string,
  password: string,
  name: string,
  signup: boolean,
) {
  const client = requireAuth();
  const result = signup
    ? await client.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: Linking.createURL("/") },
      })
    : await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return result.data.session
    ? "로그인했어요."
    : "이메일의 확인 링크를 눌러 가입을 완료해 주세요.";
}
export async function oauth(provider: "google" | "apple") {
  const client = requireAuth(),
    redirectTo =
      Platform.OS === "web" ? window.location.origin : Linking.createURL("/");
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: Platform.OS !== "web" },
  });
  if (error) throw error;
  if (Platform.OS !== "web" && data.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === "success") {
      await handleAuthUrl(result.url);
    }
  }
}
const exchanging = new Map<string, Promise<void>>();
export async function handleAuthUrl(url: string) {
  const code = new URL(url).searchParams.get("code");
  if (!code) return;
  let job = exchanging.get(code);
  if (!job) {
    job = (async () => {
      const { error } = await requireAuth().auth.exchangeCodeForSession(code);
      if (error) throw error;
    })();
    exchanging.set(code, job);
    setTimeout(() => exchanging.delete(code), 60000);
  }
  return job;
}
