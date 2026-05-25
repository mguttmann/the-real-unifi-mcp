import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAdoptionStatusPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-adoption-status",
    {
      title: "Adoption status",
      description: "Reports pending adoptions and recommends accept/reject.",
      argsSchema: {},
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Check UniFi adoption status.",
              "1. Call `unifi_net_list_pending_devices`. If empty, report all clear.",
              "2. For each pending device, show MAC, model, and any IP seen.",
              "3. Recommend adopt / leave / investigate per device based on whether the MAC is known and expected.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
