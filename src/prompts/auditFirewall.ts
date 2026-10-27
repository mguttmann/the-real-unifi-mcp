import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";

export function registerAuditFirewallPrompt(server: McpServer): void {
  server.registerPrompt(
    "unifi-audit-firewall",
    {
      title: "Audit firewall posture",
      description:
        "Walks firewall zones and policies; flags disabled rules, broad allow-any-any rules, policies without descriptions and rules without logging; suggests hardening.",
      argsSchema: z.object({
        siteId: z
          .string()
          .optional()
          .describe(
            "Not used for the calls: the tools use the configured (UNIFI_NETWORK_SITE_ID) or discovered site. Kept for compatibility; named in the report.",
          ),
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
              "3. Flag: disabled policies (`enabled` false), allow-any-any constructs (`action` allow with unrestricted `source` and `destination`), policies without `description`, and allow policies with `loggingEnabled` false.",
              `4. The tools use the configured or discovered Network site${args.siteId ? ` (the caller named site ${args.siteId}; check that it is the same)` : ""}.`,
              "Report concrete actions to harden the posture.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
