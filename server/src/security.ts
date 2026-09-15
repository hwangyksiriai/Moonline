import { createHmac, timingSafeEqual } from "node:crypto";
export function signToken(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
export function validToken(value: string, token: unknown, secret: string) {
  if (typeof token !== "string") return false;
  const expected = Buffer.from(signToken(value, secret)),
    actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
