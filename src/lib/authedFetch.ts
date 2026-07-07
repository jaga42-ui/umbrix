import { getCurrentIdToken } from "@/components/AuthProvider";

/**
 * Drop-in replacement for `fetch` that attaches the signed-in user's Firebase
 * ID token as a Bearer credential. In demo mode (no token) it behaves like a
 * plain fetch, so the server falls back to its legacy demo handling.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getCurrentIdToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
