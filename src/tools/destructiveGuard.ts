import { z } from "zod";
import { jsonResult, redactBody } from "./helpers.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../config.js";

export const confirmShape = {
  confirm: z
    .literal("YES")
    .optional()
    .describe('Required when UNIFI_CONFIRM_WRITES=true. Exact string "YES".'),
};

export interface WriteRequestDescription {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  toolName?: string;
}

export async function runGuarded(
  cfg: Pick<Config, "confirmWrites">,
  args: { confirm?: "YES" },
  req: WriteRequestDescription,
  execute: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  if (!cfg.confirmWrites) return execute();
  if (args.confirm === "YES") return execute();
  return jsonResult({
    preview: {
      tool: req.toolName,
      method: req.method,
      url: req.url,
      body: req.body !== undefined ? redactBody(req.body) : undefined,
    },
    hint: 'UNIFI_CONFIRM_WRITES=true is set. Re-run with `confirm: "YES"` to apply this change.',
  });
}
