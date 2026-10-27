import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerNetworkHealthPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-network-health",
    {
      title: "Network health summary",
      description:
        "Summarises WAN status, device online/offline counts, and top clients by activity.",
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
              "1. Call `unifi_net_list_wans`: list each WAN with status.",
              "2. Call `unifi_net_list_devices`: count online vs offline, list any offline device with last-seen.",
              "3. Call `unifi_net_list_clients`: top 10 by recent activity.",
              "4. Highlight anomalies and recommend actions.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
