import { z } from "zod";
import { errorResult, jsonResult, lenientOptional, redactBody } from "./helpers.js";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Config } from "../config.js";
import type { HttpMethod } from "../client/unifiClient.js";

/** Params of every write tool: the confirm step and, since 0.3.0, `dry_run` (audit N-23). */
export const confirmShape = {
  confirm: z
    .literal("YES")
    .optional()
    .describe(
      'Exact string "YES". Required to apply the change while write confirmation is on (the default); without it the tool returns a preview. Not needed when UNIFI_CONFIRM_WRITES is false, 0, no or off.',
    ),
  // Lenient: 0.2.1 stripped dry_run, so any value was accepted; only `true` counts.
  dry_run: lenientOptional(
    z.boolean(),
    'true: return the preview of the request and send nothing, also with confirm "YES" or with write confirmation off. Other values are ignored.',
  ),
};

export interface WriteRequestDescription {
  method: HttpMethod;
  url: string;
  body?: unknown;
  toolName?: string;
}

function preview(req: WriteRequestDescription, hint: string): CallToolResult {
  return jsonResult({
    preview: {
      tool: req.toolName,
      method: req.method,
      url: req.url,
      body: req.body !== undefined ? redactBody(req.body) : undefined,
    },
    hint,
  });
}

/**
 * The write guard of every write tool: `dry_run: true` returns the preview;
 * UNIFI_READ_ONLY refuses; otherwise the preview-then-confirm step of
 * UNIFI_CONFIRM_WRITES decides whether `execute` runs.
 */
export async function runGuarded(
  cfg: Pick<Config, "confirmWrites" | "readOnly">,
  args: { confirm?: "YES"; dry_run?: unknown },
  req: WriteRequestDescription,
  execute: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  if (args.dry_run === true)
    return preview(req, "dry_run: nothing was sent. Call again without dry_run to apply.");
  if (cfg.readOnly)
    return errorResult(
      `${req.toolName ?? "This tool"} refused: UNIFI_READ_ONLY is on, so write tools send no request. Use dry_run: true to see the request.`,
      { code: "READ_ONLY" },
    );
  if (!cfg.confirmWrites) return execute();
  if (args.confirm === "YES") return execute();
  return preview(
    req,
    'Write confirmation is on (UNIFI_CONFIRM_WRITES). Re-run with `confirm: "YES"` to apply this change.',
  );
}
