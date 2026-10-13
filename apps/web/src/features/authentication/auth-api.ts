import {
  LoginRequestSchema,
  ProblemSchema,
  SessionIdentitySchema,
} from "@dental-lab/contracts";
export type SessionIdentity = ReturnType<typeof SessionIdentitySchema.parse>;
export type AuthFailure =
  | { kind: "denied" | "invalid" | "forbidden" | "unavailable" }
  | { kind: "limited"; retryAfterSeconds: number };
type Success = { kind: "ok" };
export type SessionResult =
  { kind: "authenticated"; identity: SessionIdentity } | AuthFailure;
type Reply = { status: number; headers: Headers; body: unknown };

export function createAuthClient(transport: typeof fetch = fetch) {
  async function request(
    path: string,
    body: unknown | undefined,
    signal?: AbortSignal,
  ): Promise<Reply | null> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 8000);
    try {
      const response = await transport("/api/v1/auth/" + path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        headers:
          body === undefined
            ? { Accept: "application/json" }
            : {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      const payload =
        response.status === 204 ? undefined : await response.json();
      return {
        status: response.status,
        headers: response.headers,
        body: payload,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  function failure(response: Reply | null): AuthFailure {
    if (!response) return { kind: "unavailable" };
    const result = ProblemSchema.safeParse(response.body);
    if (!result.success || result.data.status !== response.status)
      return { kind: "unavailable" };
    if (
      response.status === 401 &&
      result.data.code === "AUTHENTICATION_REQUIRED"
    )
      return { kind: "denied" };
    if (response.status === 400 && result.data.code === "VALIDATION_FAILED")
      return { kind: "invalid" };
    if (response.status === 403 && result.data.code === "FORBIDDEN")
      return { kind: "forbidden" };
    if (response.status === 429 && result.data.code === "RATE_LIMITED") {
      const header = response.headers.get("Retry-After");
      const seconds = header && /^[0-9]+$/.test(header) ? Number(header) : 1;
      return {
        kind: "limited",
        retryAfterSeconds:
          Number.isSafeInteger(seconds) && seconds >= 1 && seconds <= 86400
            ? seconds
            : 1,
      };
    }
    return { kind: "unavailable" };
  }
  async function mutation(
    path: string,
    body: unknown,
  ): Promise<Success | AuthFailure> {
    const response = await request(path, body);
    return response?.status === 204 ? { kind: "ok" } : failure(response);
  }
  return {
    async session(signal?: AbortSignal): Promise<SessionResult> {
      const response = await request("session", undefined, signal);
      if (response?.status !== 200) return failure(response);
      const parsed = SessionIdentitySchema.safeParse(response.body);
      return parsed.success
        ? { kind: "authenticated", identity: parsed.data }
        : { kind: "unavailable" };
    },
    async login(input: unknown): Promise<Success | AuthFailure> {
      const parsed = LoginRequestSchema.safeParse(input);
      return parsed.success
        ? mutation("login", parsed.data)
        : { kind: "invalid" };
    },
    renew: () => mutation("renew", {}),
    logout: () => mutation("logout", {}),
    logoutAll: () => mutation("logout-all", {}),
  };
}
export type AuthClient = ReturnType<typeof createAuthClient>;
export function authFailureMessage(result: AuthFailure): string {
  switch (result.kind) {
    case "denied":
      return "Emaili ose fjalëkalimi nuk u pranuan. Provoni përsëri.";
    case "invalid":
      return "Kontrolloni emailin dhe fjalëkalimin.";
    case "forbidden":
      return "Kërkesa nuk u pranua. Rihapeni aplikacionin nga adresa e tij e sigurt.";
    case "limited":
      return (
        "Shumë përpjekje. Provoni përsëri pas " +
        result.retryAfterSeconds +
        " sekondash."
      );
    case "unavailable":
      return "Lidhja me shërbimin e hyrjes nuk u konfirmua. Kontrolloni internetin dhe provoni përsëri.";
  }
}
