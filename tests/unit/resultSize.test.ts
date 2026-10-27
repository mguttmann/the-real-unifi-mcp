/**
 * 0.4.0: smaller default results. The Site Manager site lists omit the
 * `statistics` object of every site unless `includeStatistics: true`, and
 * UNIFI_MAX_RESULT_BYTES has a default cap. `fetch` is a fake; nothing
 * leaves the process.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { DEFAULT_MAX_RESULT_BYTES } from "../../src/constants.js";
import { connectInProcess } from "../contract/liveTools.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function text(res: unknown): string {
  return (res as { content: Array<{ text?: string }> }).content[0]?.text ?? "";
}

function stubFetch(payload: unknown) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return urls;
}

/** A Site Manager site as in the vendor example (site-manager v1.0.0 listSites). */
function site(i: number, wanIssues = 0) {
  return {
    siteId: `site-${i}`,
    hostId: `host-${i}`,
    meta: { desc: "Default", name: "default", timezone: "Europe/Berlin" },
    statistics: {
      counts: { totalDevice: 1, wifiClient: 0 },
      internetIssues: [],
      wanIssues: Array.from({ length: wanIssues }, (_, k) => ({
        index: k,
        wanUptime: 99.5,
        highLatency: true,
        count: k,
      })),
    },
    permission: "admin",
    isOwner: true,
  };
}

function smPayload(sites: unknown[]) {
  return { data: sites, httpStatusCode: 200, traceId: "t", nextToken: "next-1" };
}

const SITE_TOOLS = ["unifi_sm_list_sites", "unifi_gen_listsites"] as const;

describe("includeStatistics on the Site Manager site lists", () => {
  for (const tool of SITE_TOOLS) {
    it(`${tool}: omitted or false drops statistics, other fields and paging stay`, async () => {
      const urls = stubFetch(smPayload([site(1), site(2)]));
      const { client, close } = await connectInProcess();
      try {
        for (const args of [{}, { includeStatistics: false }]) {
          const out = JSON.parse(text(await client.callTool({ name: tool, arguments: args }))) as {
            data: { data: Array<Record<string, unknown>>; nextToken: string };
            pagination?: unknown;
          };
          expect(out.data.data).toHaveLength(2);
          for (const s of out.data.data) {
            expect(s).not.toHaveProperty("statistics");
            expect(s).toMatchObject({ siteId: expect.any(String), meta: { name: "default" } });
          }
          expect(out.data.nextToken).toBe("next-1");
        }
        expect(urls.every((u) => !u.includes("includeStatistics"))).toBe(true);
      } finally {
        await close();
      }
    });

    it(`${tool}: true keeps the full result`, async () => {
      const payload = smPayload([site(1, 2)]);
      stubFetch(payload);
      const { client, close } = await connectInProcess();
      try {
        const res = await client.callTool({ name: tool, arguments: { includeStatistics: true } });
        expect(JSON.parse(text(res)).data).toEqual(payload);
      } finally {
        await close();
      }
    });

    it(`${tool}: a non-boolean value counts as false, without error`, async () => {
      stubFetch(smPayload([site(1)]));
      const { client, close } = await connectInProcess();
      try {
        for (const v of ["true", 1, { x: 1 }, null]) {
          const res = await client.callTool({ name: tool, arguments: { includeStatistics: v } });
          expect(res.isError, JSON.stringify(v)).toBeFalsy();
          expect(JSON.parse(text(res)).data.data[0]).not.toHaveProperty("statistics");
        }
      } finally {
        await close();
      }
    });

    it(`${tool}: a body without a site array is returned unchanged`, async () => {
      stubFetch({ data: null, statistics: { kept: true } });
      const { client, close } = await connectInProcess();
      try {
        const res = await client.callTool({ name: tool, arguments: {} });
        expect(JSON.parse(text(res)).data).toEqual({ data: null, statistics: { kept: true } });
      } finally {
        await close();
      }
    });
  }
});

describe("UNIFI_MAX_RESULT_BYTES default (0.4.0)", () => {
  const base = { UNIFI_API_KEY: "k" };

  it("unset or empty: the default cap", () => {
    expect(DEFAULT_MAX_RESULT_BYTES).toBe(100_000);
    expect(loadConfig(base).maxResultBytes).toBe(DEFAULT_MAX_RESULT_BYTES);
    for (const v of ["", " "])
      expect(loadConfig({ ...base, UNIFI_MAX_RESULT_BYTES: v }).maxResultBytes).toBe(
        DEFAULT_MAX_RESULT_BYTES,
      );
  });

  it("0, off or none: no cap", () => {
    for (const v of ["0", "off", "none", " OFF ", "None"])
      expect(loadConfig({ ...base, UNIFI_MAX_RESULT_BYTES: v }).maxResultBytes, v).toBe(0);
  });

  it("a positive integer sets the cap; anything else stops the server", () => {
    expect(loadConfig({ ...base, UNIFI_MAX_RESULT_BYTES: "4096" }).maxResultBytes).toBe(4096);
    for (const v of ["-1", "1.5", "abc", "00x", "no", "1e5"])
      expect(() => loadConfig({ ...base, UNIFI_MAX_RESULT_BYTES: v }), v).toThrow(
        /UNIFI_MAX_RESULT_BYTES/,
      );
  });

  // About 130 KB of sites, as reported by a gateway operator for an account
  // whose sites carry long statistics.wanIssues lists.
  const big = smPayload(Array.from({ length: 40 }, (_, i) => site(i, 30)));

  it("the 130 KB site list is cut by default with the paging marker", async () => {
    expect(JSON.stringify({ data: big }, null, 2).length).toBeGreaterThan(125_000);
    stubFetch(big);
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({
        name: "unifi_sm_list_sites",
        arguments: { includeStatistics: true },
      });
      const [kept, marker] = text(res).split("\n... (truncated");
      expect(Buffer.byteLength(kept!)).toBeLessThanOrEqual(DEFAULT_MAX_RESULT_BYTES);
      expect(marker).toMatch(new RegExp(`UNIFI_MAX_RESULT_BYTES is ${DEFAULT_MAX_RESULT_BYTES}`));
      expect(marker).toMatch(/pageSize and nextToken/);
    } finally {
      await close();
    }
  });

  it("the same list without statistics stays below the default cap and is not cut", async () => {
    stubFetch(big);
    const { client, close } = await connectInProcess();
    try {
      const res = await client.callTool({ name: "unifi_sm_list_sites", arguments: {} });
      const t = text(res);
      expect(t).not.toContain("(truncated");
      expect(JSON.parse(t).data.data).toHaveLength(40);
    } finally {
      await close();
    }
  });

  it("0 disables the cap", async () => {
    stubFetch(big);
    const { client, close } = await connectInProcess({ maxResultBytes: 0 });
    try {
      const res = await client.callTool({
        name: "unifi_sm_list_sites",
        arguments: { includeStatistics: true },
      });
      expect(JSON.parse(text(res)).data).toEqual(big);
    } finally {
      await close();
    }
  });

  it("a positive integer applies", async () => {
    stubFetch(big);
    const { client, close } = await connectInProcess({ maxResultBytes: 2000 });
    try {
      const res = await client.callTool({ name: "unifi_sm_list_sites", arguments: {} });
      const [kept, marker] = text(res).split("\n... (truncated");
      expect(Buffer.byteLength(kept!)).toBeLessThanOrEqual(2000);
      expect(marker).toMatch(/UNIFI_MAX_RESULT_BYTES is 2000/);
    } finally {
      await close();
    }
  });
});
