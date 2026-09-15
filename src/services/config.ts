export const DEMO = process.env.EXPO_PUBLIC_DEMO_MODE !== "false";
export const BACKEND = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(
  /\/$/,
  "",
);
