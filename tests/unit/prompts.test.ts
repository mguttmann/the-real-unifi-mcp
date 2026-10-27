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
    expect(names).toEqual(
      expect.arrayContaining([
        "unifi-audit-firewall",
        "unifi-network-health",
        "unifi-adoption-status",
      ]),
    );
  });
});

/** Text of the first message of a prompt, rendered with `args`. */
function render(
  register: (s: never) => void,
  args: Record<string, unknown> = {},
): { text: string; argNames: string[] } {
  let out = { text: "", argNames: [] as string[] };
  const server = {
    registerPrompt: (
      _n: string,
      def: { argsSchema: { shape: Record<string, unknown> } },
      cb: (a: Record<string, unknown>) => { messages: Array<{ content: { text: string } }> },
    ) => {
      out = {
        text: cb(args).messages[0]!.content.text,
        argNames: Object.keys(def.argsSchema.shape),
      };
    },
  };
  register(server as never);
  return out;
}

describe("prompts name only fields the API returns (N-41, N-79)", () => {
  it("unifi-network-health", () => {
    const { text } = render(registerNetworkHealthPrompt);
    expect(text).not.toMatch(/last-seen|last seen|activity|with status/i);
    expect(text).toMatch(/`state`/);
    expect(text).toMatch(/`connectedAt`/);
  });

  it("unifi-audit-firewall keeps its optional siteId arg and names no creation time", () => {
    const { text, argNames } = render(registerAuditFirewallPrompt, { siteId: "S1" });
    expect(argNames).toEqual(["siteId"]);
    expect(text).not.toMatch(/created|last 7 days/i);
    expect(text).toMatch(/`enabled`/);
    expect(text).toMatch(/configured or discovered/);
  });

  it("unifi-adoption-status", () => {
    const { text } = render(registerAdoptionStatusPrompt);
    expect(text).toMatch(/`macAddress`/);
  });
});
