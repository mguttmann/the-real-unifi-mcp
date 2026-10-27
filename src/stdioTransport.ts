import type { Readable, Writable } from "node:stream";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

/**
 * The stdio transport of the server (process stdin and stdout by default).
 *
 * The SDK adds one `drain` and one `error` listener to stdout for every
 * response that waits on backpressure and removes both when that write
 * drains. More than 10 waiting responses (about 30 parallel calls with a slow
 * client) made Node print MaxListenersExceededWarning on stderr although
 * nothing leaks (audit N-94), so the listener limit of this one stream is
 * lifted.
 */
export function createStdioTransport(
  stdin: Readable = process.stdin,
  stdout: Writable = process.stdout,
): StdioServerTransport {
  stdout.setMaxListeners(0);
  return new StdioServerTransport(stdin, stdout);
}
