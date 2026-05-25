#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const { server, ctx } = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  ctx.logger.info("UniFi MCP server connected (stdio)");
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
