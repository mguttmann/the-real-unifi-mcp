import { createHash } from "node:crypto";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { Tool } from "@modelcontextprotocol/client";
import { buildServer } from "../../src/server.js";
import type { Config } from "../../src/config.js";

/** Offline config: dummy key, unreachable API base. No tool is called. */
export const OFFLINE_CONFIG: Config = {
  apiKey: "contract-test-dummy-key",
  apiBase: "http://127.0.0.1:1",
  confirmWrites: true,
  timeoutMs: 1000,
  logLevel: "error",
  // Overrides keep discovery offline, so write previews need no network.
  consoleIdOverride: "contract-console",
  networkSiteIdOverride: "contract-net-site",
  siteManagerSiteIdOverride: "contract-sm-site",
};

/** One tool as pinned by the contract snapshot. */
export interface ContractTool {
  name: string;
  /** Hard contract: sorted required param names. */
  required: string[];
  /** Hard contract: sorted property names. */
  properties: string[];
  /** Hard contract: JSON-schema defaults per property (empty when none). */
  defaults: Record<string, unknown>;
  /** Hard contract: tool annotations. */
  annotations: Record<string, unknown>;
  /** Noise (reported, not failed): hash of title + description. */
  textSha256: string;
  /** Noise (reported, not failed): hash of the canonical inputSchema. */
  inputSchemaSha256: string;
}

export interface ContractSnapshot {
  toolCount: number;
  tools: ContractTool[];
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort())
      out[k] = canonical((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

export function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex")
    .slice(0, 16);
}

export function toContractTool(
  tool: Pick<Tool, "name" | "title" | "description" | "inputSchema" | "annotations">,
): ContractTool {
  const props = (tool.inputSchema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const defaults: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) if (v && "default" in v) defaults[k] = v.default;
  return {
    name: tool.name,
    required: [...(tool.inputSchema.required ?? [])].sort(),
    properties: Object.keys(props).sort(),
    defaults,
    annotations: canonical(tool.annotations ?? {}) as Record<string, unknown>,
    textSha256: sha256({ title: tool.title ?? null, description: tool.description ?? null }),
    inputSchemaSha256: sha256(tool.inputSchema),
  };
}

/**
 * Start the real server in-process and connect a client over InMemoryTransport.
 * `cfg` overrides single fields of OFFLINE_CONFIG (the API base stays offline).
 */
export async function connectInProcess(
  cfg: Partial<Config> = {},
): Promise<{ client: Client; close: () => Promise<void> }> {
  const { server } = buildServer({ ...OFFLINE_CONFIG, ...cfg });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "contract-test", version: "0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/** initialize serverInfo version plus the full tools/list. */
export async function listLiveTools(): Promise<{
  serverVersion: string | undefined;
  tools: Tool[];
}> {
  const { client, close } = await connectInProcess();
  try {
    const tools: Tool[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      tools.push(...page.tools);
      cursor = page.nextCursor;
    } while (cursor);
    return { serverVersion: client.getServerVersion()?.version, tools };
  } finally {
    await close();
  }
}
