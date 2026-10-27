import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export function registerAdoptionStatusPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-adoption-status",
    {
      title: "Adoption status",
      description: "Reports pending adoptions and recommends accept/reject.",
      argsSchema: z.object({}),
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
              "2. For each pending device, show `macAddress`, `model`, `ipAddress`, `state` and `firmwareVersion`.",
              "3. Recommend adopt / leave / investigate per device based on whether the MAC is known and expected.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
