import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The abort signal of the MCP request that is being handled (audit N-35). The
 * tool wrapper in `src/tools/instrument.ts` runs every tool handler inside
 * `runWithCallerSignal`, so the API client sees a caller's cancellation
 * without every tool passing the signal on.
 */
const store = new AsyncLocalStorage<AbortSignal | undefined>();

export function runWithCallerSignal<T>(signal: AbortSignal | undefined, fn: () => T): T {
  return store.run(signal, fn);
}

export function callerSignal(): AbortSignal | undefined {
  return store.getStore();
}
