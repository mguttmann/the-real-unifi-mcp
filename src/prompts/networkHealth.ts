import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerNetworkHealthPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-network-health",
    {
      title: "Network health summary",
      description:
        "Summarises configured WANs, device states and firmware updates, and connected clients.",
      argsSchema: z.object({}),
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Produce a UniFi network health summary.",
              "Use the paging params (offset, limit) until every page is read.",
              "1. Call `unifi_net_list_wans`: list the configured WANs by `name` (the list has no link status).",
              "2. Call `unifi_net_list_devices`: count devices per `state`; list every device that is not ONLINE with `name`, `model` and `ipAddress`, and every device with `firmwareUpdatable` true.",
              "3. Call `unifi_net_list_clients`: count clients per `type` (wired, wireless) and list the 10 most recently connected (`connectedAt`) with `name` and `ipAddress`.",
              "4. Highlight anomalies and recommend actions.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
