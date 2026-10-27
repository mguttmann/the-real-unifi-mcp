import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../server.js";
import { runWithCallerSignal } from "../client/callerSignal.js";
import { capResultText, redactResultText } from "./helpers.js";

type Handler = (...params: unknown[]) => unknown;

/**
 * Wraps every tool registered on `server` after this call, generated and
 * hand-written alike, in one place:
 * - the handler runs with the MCP request's abort signal as caller signal,
 *   so a cancelled call aborts its API request and retry sleep (audit N-35);
 * - with UNIFI_REDACT_SECRETS, secret fields of every result are masked (N-22);
 * - with UNIFI_MAX_RESULT_BYTES, longer result texts are cut (N-32).
 */
export function instrumentTools(server: McpServer, ctx: ServerContext): void {
  const register = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
  (server as unknown as { registerTool: (...args: unknown[]) => unknown }).registerTool = (
    name: unknown,
    config: unknown,
    handler: unknown,
  ) => {
    const wrapped = async (...params: unknown[]): Promise<CallToolResult> => {
      const extra = params[params.length - 1] as { mcpReq?: { signal?: AbortSignal } } | undefined;
      const result = (await runWithCallerSignal(extra?.mcpReq?.signal, () =>
        (handler as Handler)(...params),
      )) as CallToolResult;
      return finish(result, ctx.cfg);
    };
    return register(name, config, wrapped);
  };
}

function finish(result: CallToolResult, cfg: ServerContext["cfg"]): CallToolResult {
  if (!cfg.redactSecrets && cfg.maxResultBytes === undefined) return result;
  if (!Array.isArray(result?.content)) return result;
  return {
    ...result,
    content: result.content.map((c) => {
      if (c.type !== "text") return c;
      let t = c.text;
      if (cfg.redactSecrets) t = redactResultText(t);
      if (cfg.maxResultBytes !== undefined) t = capResultText(t, cfg.maxResultBytes);
      return { ...c, text: t };
    }),
  };
}
