#!/usr/bin/env node
import "./loadEnv.js";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { buildServer, createContext } from "./server.js";
import { formatFatal } from "./utils/logger.js";
import { createStdioTransport } from "./stdioTransport.js";

function main(): void {
  const ctx = createContext();
  // The client's opening message decides the protocol era: `initialize`
  // (2024-11-05 to 2025-11-25) pins the connection to a 2025-era instance,
  // served exactly as the former `server.connect(new StdioServerTransport())`;
  // a 2026-07-28 opening (`server/discover`) gets a modern instance. Both come
  // from this factory and share one API client and discovery cache.
  const transport = createStdioTransport();
  let lastError: string | undefined;
  serveStdio(() => buildServer(ctx.cfg, ctx).server, {
    legacy: "serve",
    transport,
    onerror: (err) => {
      lastError = err.message;
      ctx.logger.warn("stdio transport error", { error: err.message });
    },
  });
  // serveStdio has set its own close handler; chain ours behind it. stdin
  // reaching end-of-file is the normal end of a session (exit code 0). Any
  // other close, for example one message above the SDK read-buffer limit or a
  // stdout error, ends the session as a failure: log it and exit non-zero
  // (audit N-80; 0.2.1 exited 0 without a log line).
  const sdkOnClose = transport.onclose;
  transport.onclose = () => {
    sdkOnClose?.();
    if (process.stdin.readableEnded) return;
    ctx.logger.error("stdio transport closed", { error: lastError ?? "unknown" });
    process.exitCode = 1;
  };
  ctx.logger.info("UniFi MCP server connected (stdio)");
}

try {
  main();
} catch (err) {
  process.stderr.write(formatFatal(err));
  process.exit(1);
}
