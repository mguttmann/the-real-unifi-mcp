import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuditFirewallPrompt } from "./auditFirewall.js";
import { registerNetworkHealthPrompt } from "./networkHealth.js";
import { registerAdoptionStatusPrompt } from "./adoptionStatus.js";

export function registerPrompts(server: McpServer): void {
  registerAuditFirewallPrompt(server);
  registerNetworkHealthPrompt(server);
  registerAdoptionStatusPrompt(server);
}
