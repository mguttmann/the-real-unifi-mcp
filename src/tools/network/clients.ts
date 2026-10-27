import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../../server.js";
import { errorResult, apiPath, vendorAction } from "../helpers.js";
import { confirmShape } from "../destructiveGuard.js";
import { readOnly, writeOnce, writeIdempotent, pagShape, netGet, netWrite } from "./common.js";

/**
 * The vendor client action discriminator only knows AUTHORIZE_GUEST_ACCESS and
 * UNAUTHORIZE_GUEST_ACCESS. Block/unblock have no endpoint, so the tools stay
 * registered (tool contract) but refuse without a request (audit N-6).
 */
function notSupported(toolName: string) {
  return errorResult(
    `${toolName} is not supported: the UniFi Network API has no block/unblock action for clients (only AUTHORIZE_GUEST_ACCESS and UNAUTHORIZE_GUEST_ACCESS via unifi_net_client_action). No request was sent.`,
  );
}

export function registerClientTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_net_list_clients",
    {
      title: "List connected clients",
      description: "Currently connected clients on the site.",
      inputSchema: z.object(pagShape),
      annotations: readOnly,
    },
    async (a) =>
      netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/clients`, {
        offset: a.offset,
        limit: a.limit,
        filter: a.filter,
      }),
  );

  server.registerTool(
    "unifi_net_get_client",
    {
      title: "Get connected client",
      description: "Detail for a connected client by id.",
      inputSchema: z.object({ clientId: z.string() }),
      annotations: readOnly,
    },
    async (a) => netGet(ctx, (sid) => apiPath`/v1/sites/${sid}/clients/${a.clientId}`),
  );

  server.registerTool(
    "unifi_net_client_action",
    {
      title: "Execute client action",
      description:
        "Action on a connected client. Vendor values: AUTHORIZE_GUEST_ACCESS, UNAUTHORIZE_GUEST_ACCESS (lowercase and dashes are mapped). The Network API has no block/unblock action.",
      inputSchema: z.object({
        clientId: z.string(),
        action: z.string().describe('e.g. "AUTHORIZE_GUEST_ACCESS", "UNAUTHORIZE_GUEST_ACCESS"'),
        ...confirmShape,
      }),
      annotations: writeOnce,
    },
    async (a) =>
      netWrite(
        ctx,
        a,
        "unifi_net_client_action",
        "POST",
        (sid) => apiPath`/v1/sites/${sid}/clients/${a.clientId}/actions`,
        { action: vendorAction(a.action) },
      ),
  );

  server.registerTool(
    "unifi_net_block_client",
    {
      title: "Block client",
      description:
        "Not supported: the UniFi Network API defines no block action for clients, so this tool returns an error and sends nothing. Kept for compatibility.",
      inputSchema: z.object({ clientId: z.string(), ...confirmShape }),
      // Blocking (unblocking) twice equals doing it once (audit N-27).
      annotations: writeIdempotent,
    },
    async () => notSupported("unifi_net_block_client"),
  );

  server.registerTool(
    "unifi_net_unblock_client",
    {
      title: "Unblock client",
      description:
        "Not supported: the UniFi Network API defines no unblock action for clients, so this tool returns an error and sends nothing. Kept for compatibility.",
      inputSchema: z.object({ clientId: z.string(), ...confirmShape }),
      // Blocking (unblocking) twice equals doing it once (audit N-27).
      annotations: writeIdempotent,
    },
    async () => notSupported("unifi_net_unblock_client"),
  );
}
