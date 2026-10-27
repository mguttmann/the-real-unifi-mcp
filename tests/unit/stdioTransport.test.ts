/**
 * Audit N-94: the SDK stdio transport adds one `drain` and one `error`
 * listener to stdout for every response that waits on backpressure and
 * removes them when the write drains. With more than 10 such responses (about
 * 30 parallel calls with a slow client) Node printed MaxListenersExceededWarning
 * on stderr, although nothing leaks. createStdioTransport lifts the listener
 * limit of the stdout stream it writes to.
 */
import { PassThrough, Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { createStdioTransport } from "../../src/stdioTransport.js";

const warnings: string[] = [];
const onWarning = (w: Error) => warnings.push(`${w.name}: ${w.message}`);

afterEach(() => {
  process.off("warning", onWarning);
  warnings.length = 0;
});

function slowStdout(): Writable {
  return new Writable({
    highWaterMark: 16,
    write(_chunk, _enc, cb) {
      setTimeout(cb, 2);
    },
  });
}

describe("createStdioTransport (N-94)", () => {
  it("sends 30 responses under backpressure without a MaxListeners warning", async () => {
    process.on("warning", onWarning);
    const stdout = slowStdout();
    const transport = createStdioTransport(new PassThrough(), stdout);
    await transport.start();
    await Promise.all(
      Array.from({ length: 30 }, (_, id) =>
        transport.send({ jsonrpc: "2.0", id, result: { text: "x".repeat(200) } }),
      ),
    );
    // Warnings are emitted on the next tick.
    await new Promise((r) => setImmediate(r));
    expect(warnings.filter((w) => w.startsWith("MaxListenersExceededWarning"))).toEqual([]);
    // Every listener is removed once its write drained.
    expect(stdout.listenerCount("drain")).toBe(0);
    await transport.close();
  });
});
