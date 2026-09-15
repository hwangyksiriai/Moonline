export type Config = {
  demo: boolean;
  port: number;
  host: string;
  backendUrl: string;
  cors: string[];
  databaseUrl?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  openaiKey?: string;
  realtimeModel: string;
  summaryModel: string;
  ttsModel: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioPhone?: string;
  verifySid?: string;
  signingSecret: string;
  maxCallSeconds: number;
  maxDailyCalls: number;
  phonePrefixes: string[];
  demoFile: string;
  expoToken?: string;
};
export function configFrom(env: NodeJS.ProcessEnv = process.env): Config {
  const demo = env.DEMO_MODE !== "false";
  if (!demo) {
    for (const key of [
      "DATABASE_URL",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "OPENAI_API_KEY",
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_PHONE_NUMBER",
      "TWILIO_VERIFY_SERVICE_SID",
      "STREAM_SIGNING_SECRET",
      "BACKEND_URL",
    ])
      if (!env[key]) throw new Error("Missing required server setting: " + key);
    if (!env.BACKEND_URL!.startsWith("https://"))
      throw new Error("Real mode requires an HTTPS BACKEND_URL");
    if (env.STREAM_SIGNING_SECRET!.length < 32)
      throw new Error(
        "STREAM_SIGNING_SECRET must contain at least 32 characters",
      );
  }
  return {
    demo,
    port: Number(env.PORT ?? 3001),
    host: env.HOST ?? "127.0.0.1",
    backendUrl: (env.BACKEND_URL ?? "http://localhost:3001").replace(/\/$/, ""),
    cors: (
      env.CORS_ORIGINS ?? "http://localhost:8081,http://localhost:8082"
    ).split(","),
    databaseUrl: env.DATABASE_URL,
    supabaseUrl: env.SUPABASE_URL,
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
    openaiKey: env.OPENAI_API_KEY,
    realtimeModel: env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
    summaryModel: env.OPENAI_SUMMARY_MODEL ?? "gpt-4.1-mini",
    ttsModel: env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
    twilioSid: env.TWILIO_ACCOUNT_SID,
    twilioToken: env.TWILIO_AUTH_TOKEN,
    twilioPhone: env.TWILIO_PHONE_NUMBER,
    verifySid: env.TWILIO_VERIFY_SERVICE_SID,
    signingSecret:
      env.STREAM_SIGNING_SECRET ?? "demo-only-never-used-for-real-calls",
    maxCallSeconds: Math.min(
      3600,
      Math.max(60, Number(env.MAX_CALL_SECONDS ?? 900)),
    ),
    maxDailyCalls: Math.max(1, Number(env.MAX_DAILY_CALLS ?? 5)),
    phonePrefixes: (env.ALLOWED_PHONE_PREFIXES ?? "+82").split(","),
    demoFile: env.DEMO_DATA_FILE ?? "./data/demo.sqlite",
    expoToken: env.EXPO_ACCESS_TOKEN,
  };
}
