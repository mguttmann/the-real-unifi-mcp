import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { extractEndpointJson } from "../../src/client/rsc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (n: string) => readFileSync(resolve(__dirname, "../fixtures/rsc", n), "utf8");

describe("RSC parser against live fixtures", () => {
  it("parses createfirewallpolicy fixture", () => {
    const ep = extractEndpointJson(fx("createfirewallpolicy.txt"));
    expect(ep).not.toBeNull();
    expect(ep?.method).toBe("POST");
    expect(ep?.path).toContain("/firewall/policies");
    expect(ep?.requestBody).toBeDefined();
  });

  it("parses getinfo fixture", () => {
    const ep = extractEndpointJson(fx("getinfo.txt"));
    expect(ep?.method).toBe("GET");
    expect(ep?.path).toContain("/info");
  });

  it("parses deletefirewallpolicy fixture", () => {
    const ep = extractEndpointJson(fx("deletefirewallpolicy.txt"));
    expect(ep?.method).toBe("DELETE");
    expect(ep?.path).toContain("/firewall/policies/");
  });
});
