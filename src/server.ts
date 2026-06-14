import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnifiClient } from "./client/unifiClient.js";
import { Discovery } from "./client/discovery.js";
import { loadConfig, type Config } from "./config.js";
import { createLogger, registerSecretValue, type Logger } from "./utils/logger.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerGeneratedTools } from "./tools/generated/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { registerRawRequestTool } from "./tools/rawRequest.js";
import { registerSiteManagerTools } from "./tools/siteManager.js";
import { registerInfoTools } from "./tools/network/info.js";
import { registerSitesTools } from "./tools/network/sites.js";
import { registerDeviceTools } from "./tools/network/devices.js";
import { registerClientTools } from "./tools/network/clients.js";
import { registerNetworkTools } from "./tools/network/networks.js";
import { registerWifiTools } from "./tools/network/wifi.js";
import { registerFirewallTools } from "./tools/network/firewall.js";
import { registerAclTools } from "./tools/network/acl.js";
import { registerDnsTools } from "./tools/network/dns.js";
import { registerTrafficListTools } from "./tools/network/trafficLists.js";
import { registerHotspotTools } from "./tools/network/hotspot.js";
import { registerSwitchingTools } from "./tools/network/switching.js";
import { registerSupportingTools } from "./tools/network/supporting.js";

export interface ServerContext {
  cfg: Config;
  logger: Logger;
  client: UnifiClient;
  discovery: Discovery;
}

export function buildServer(overrideCfg?: Config): { server: McpServer; ctx: ServerContext } {
  const cfg = overrideCfg ?? loadConfig();
  // Register the live API key so redactSecrets() scrubs it from ALL log output
  // by exact match, regardless of surrounding format (closes residual H-1 / O-6).
  registerSecretValue(cfg.apiKey);
  const logger = createLogger(cfg.logLevel);
  const client = new UnifiClient(cfg, logger);
  const discovery = new Discovery(client, {
    consoleIdOverride: cfg.consoleIdOverride,
    networkSiteIdOverride: cfg.networkSiteIdOverride,
    siteManagerSiteIdOverride: cfg.siteManagerSiteIdOverride,
  });
  const ctx: ServerContext = { cfg, logger, client, discovery };

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: [
        "## UniFi MCP",
        "Cloud-only access to UniFi Site Manager + Network APIs via api.ui.com.",
        "Three tool layers (all callable):",
        "- `unifi_sm_*` — Site Manager hand-wrappers (account-level: hosts, sites, devices, ISP metrics, SD-WAN).",
        "- `unifi_net_*` — Network hand-wrappers (per-console: devices, clients, networks, WLANs, firewall, ACL, DNS, hotspot).",
        "- `unifi_gen_*` — auto-generated tools (100% API coverage; use when no hand-wrapper exists).",
        "- `unifi_raw_request` — escape hatch for any path/method.",
        "## Write safety",
        "- Tools that modify state are marked `destructiveHint: true`.",
        "- If `UNIFI_CONFIRM_WRITES=true` is set, destructive tools return a preview unless called with `confirm: \"YES\"`.",
        "## IDs",
        "- consoleId, network siteId, site-manager siteId are auto-resolved on first use. Browse `unifi://identity` to see them.",
        "- Override via UNIFI_CONSOLE_ID / UNIFI_NETWORK_SITE_ID / UNIFI_SITE_MANAGER_SITE_ID env vars.",
      ].join("\n"),
    },
  );

  registerRawRequestTool(server, ctx);
  registerSiteManagerTools(server, ctx);
  registerInfoTools(server, ctx);
  registerSitesTools(server, ctx);
  registerDeviceTools(server, ctx);
  registerClientTools(server, ctx);
  registerNetworkTools(server, ctx);
  registerWifiTools(server, ctx);
  registerFirewallTools(server, ctx);
  registerAclTools(server, ctx);
  registerDnsTools(server, ctx);
  registerTrafficListTools(server, ctx);
  registerHotspotTools(server, ctx);
  registerSwitchingTools(server, ctx);
  registerSupportingTools(server, ctx);
  registerGeneratedTools(server, ctx);
  registerResources(server, ctx);
  registerPrompts(server);
  return { server, ctx };
}
