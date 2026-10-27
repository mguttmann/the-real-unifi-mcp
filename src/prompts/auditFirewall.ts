import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerAuditFirewallPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-audit-firewall",
    {
      title: "Audit firewall posture",
      description:
        "Walks firewall zones and policies; flags disabled rules, broad allow-any-any rules, and policies without descriptions; suggests hardening.",
      argsSchema: z.object({
        siteId: z
          .string()
          .optional()
          .describe("Optional Network site id; defaults to discovered site."),
      }),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Audit the UniFi firewall posture.",
              "1. Call `unifi_net_list_firewall_zones` and `unifi_net_list_firewall_policies` (use full pagination).",
              "2. Group policies by zone pair.",
              "3. Flag: disabled rules, allow-any-any constructs, rules without descriptions, rules created in the last 7 days.",
              `4. Site id: ${args.siteId ?? "(auto-discovered)"}.`,
              "Report concrete actions to harden the posture.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
