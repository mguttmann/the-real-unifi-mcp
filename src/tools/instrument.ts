import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../server.js";
import { runWithCallerSignal } from "../client/callerSignal.js";

type Handler = (...params: unknown[]) => unknown;

/**
 * Wraps every tool registered on `server` after this call, generated and
 * hand-written alike, in one place:
 * - the handler runs with the MCP request's abort signal as caller signal,
 *   so a cancelled call aborts its API request and retry sleep (audit N-35).
 */
export function instrumentTools(server: McpServer, _ctx: ServerContext): void {
  const register = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
  (server as unknown as { registerTool: (...args: unknown[]) => unknown }).registerTool = (
    name: unknown,
    config: unknown,
    handler: unknown,
  ) => {
    const wrapped = async (...params: unknown[]): Promise<CallToolResult> => {
      const extra = params[params.length - 1] as { mcpReq?: { signal?: AbortSignal } } | undefined;
      return (await runWithCallerSignal(extra?.mcpReq?.signal, () =>
        (handler as Handler)(...params),
      )) as CallToolResult;
    };
    return register(name, config, wrapped);
  };
}
