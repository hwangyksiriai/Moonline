import type { Call, Profile } from "../../shared/model.ts";
export type ServerCall = Call & {
  userId: string;
  version: number;
  providerCallId?: string;
  claimedAt?: number;
  streamSid?: string;
  reminders?: number[];
  summaryState?: "pending" | "processing" | "ready" | "failed";
  summaryClaimedAt?: number;
};
export type ServerProfile = Profile & { phone?: string; pushToken?: string };
export function publicCall(c: ServerCall): Call {
  const {
    userId,
    version,
    providerCallId,
    claimedAt,
    streamSid,
    reminders,
    summaryState,
    summaryClaimedAt,
    ...visible
  } = c;
  return visible;
}
export function publicProfile(p: ServerProfile): Profile {
  const { phone, pushToken, ...visible } = p;
  return {
    ...visible,
    phoneMasked: phone
      ? phone.slice(0, 3) + " •••• " + phone.slice(-4)
      : undefined,
  };
}
