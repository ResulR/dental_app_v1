export type TechnicalEvent = {
  event:
    | "request_completed"
    | "request_aborted"
    | "api_started"
    | "api_start_failed"
    | "api_stop_failed";
  requestId?: string;
  route?: "health" | "unmatched";
  method?: string;
  status?: number;
  durationMs?: number;
};
export type TechnicalLogger = (event: TechnicalEvent) => void;
const events = new Set([
  "request_completed",
  "request_aborted",
  "api_started",
  "api_start_failed",
  "api_stop_failed",
]);
const methods = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);
export function createTechnicalLogger(
  write: (line: string) => void = (line) => {
    process.stdout.write(line + "\n");
  },
): TechnicalLogger {
  return (input) => {
    if (!events.has(input.event)) throw new Error("INVALID_TECHNICAL_EVENT");
    const record: Record<string, string | number> = {
      channel: "technical",
      at: new Date().toISOString(),
      event: input.event,
      level:
        input.event.endsWith("failed") || (input.status ?? 0) >= 500
          ? "error"
          : "info",
    };
    if (
      input.requestId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        input.requestId,
      )
    )
      record.request_id = input.requestId;
    if (input.route === "health" || input.route === "unmatched")
      record.route = input.route;
    if (input.method !== undefined)
      record.method = methods.has(input.method) ? input.method : "OTHER";
    if (
      Number.isInteger(input.status) &&
      (input.status ?? -1) >= 0 &&
      (input.status ?? 600) <= 599
    )
      record.status = input.status as number;
    if (Number.isFinite(input.durationMs) && (input.durationMs ?? -1) >= 0)
      record.duration_ms = Math.round(input.durationMs as number);
    try {
      write(JSON.stringify(record));
    } catch {
      process.stderr.write(
        '{"channel":"technical","event":"log_sink_failed","level":"error"}\n',
      );
    }
  };
}
