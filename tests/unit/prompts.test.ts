import { describe, expect, it, vi } from "vitest";
import { registerAuditFirewallPrompt } from "../../src/prompts/auditFirewall.js";
import { registerNetworkHealthPrompt } from "../../src/prompts/networkHealth.js";
import { registerAdoptionStatusPrompt } from "../../src/prompts/adoptionStatus.js";

describe("prompts", () => {
  it("registers all 3 prompt names", () => {
    const names: string[] = [];
    const server = { registerPrompt: (name: string) => names.push(name) } as never;
    registerAuditFirewallPrompt(server);
    registerNetworkHealthPrompt(server);
    registerAdoptionStatusPrompt(server);
    expect(names).toEqual(expect.arrayContaining([
      "unifi-audit-firewall",
      "unifi-network-health",
      "unifi-adoption-status",
    ]));
  });
});
