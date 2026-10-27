#!/usr/bin/env node
import "dotenv/config";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { buildServer, createContext } from "./server.js";
import { formatFatal } from "./utils/logger.js";

function main(): void {
  const ctx = createContext();
  // The client's opening message decides the protocol era: `initialize`
  // (2024-11-05 to 2025-11-25) pins the connection to a 2025-era instance,
  // served exactly as the former `server.connect(new StdioServerTransport())`;
  // a 2026-07-28 opening (`server/discover`) gets a modern instance. Both come
  // from this factory and share one API client and discovery cache.
  serveStdio(() => buildServer(ctx.cfg, ctx).server, {
    legacy: "serve",
    onerror: (err) => ctx.logger.warn("stdio transport error", { error: err.message }),
  });
  ctx.logger.info("UniFi MCP server connected (stdio)");
}

try {
  main();
} catch (err) {
  process.stderr.write(formatFatal(err));
  process.exit(1);
}
