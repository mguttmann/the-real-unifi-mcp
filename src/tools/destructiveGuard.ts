import { z } from "zod";
import { jsonResult, redactBody } from "./helpers.js";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Config } from "../config.js";

export const confirmShape = {
  confirm: z
    .literal("YES")
    .optional()
    .describe(
      'Exact string "YES". Required to apply the change while write confirmation is on (the default); without it the tool returns a preview. Not needed when UNIFI_CONFIRM_WRITES is false, 0, no or off.',
    ),
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
    hint: 'Write confirmation is on (UNIFI_CONFIRM_WRITES). Re-run with `confirm: "YES"` to apply this change.',
  });
}
