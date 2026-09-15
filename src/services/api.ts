import { BACKEND } from "./config";
import { requireAuth } from "./auth";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!BACKEND) throw new Error("서버 주소가 설정되지 않았어요.");
  const {
    data: { session },
  } = await requireAuth().auth.getSession();
  if (!session) throw new Error("먼저 로그인해 주세요.");
  const response = await fetch(BACKEND + path, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "요청을 처리하지 못했어요.");
  return result as T;
}
