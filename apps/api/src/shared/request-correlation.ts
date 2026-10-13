import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
const scope = new AsyncLocalStorage<string>();
export function withRequestCorrelation(id: string, work: () => void): void {
  scope.run(id, work);
}
export function currentRequestCorrelation(): string {
  return scope.getStore() ?? randomUUID();
}
