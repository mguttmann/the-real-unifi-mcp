import type { UnifiClient } from "./unifiClient.js";

/**
 * The id lookups are cached and shared by concurrent tool calls, so one
 * caller's cancellation must not fail the others: no caller signal.
 */
const SHARED = { signal: null };

interface DiscoveryDeps {
  consoleIdOverride?: string;
  networkSiteIdOverride?: string;
  siteManagerSiteIdOverride?: string;
}

interface Host {
  id: string;
  type?: string;
  owner?: boolean;
  reportedState?: { hostname?: string; ip?: string };
  hardwareId?: string;
}

export interface UnifiIdentity {
  consoleId: string;
  networkSiteId: string;
  siteManagerSiteId: string;
  console?: Host;
}

export class Discovery {
  private consoleIdP?: Promise<string>;
  private networkSiteIdP?: Promise<string>;
  private siteManagerSiteIdP?: Promise<string>;

  constructor(
    private client: UnifiClient,
    private cfg: DiscoveryDeps,
  ) {}

  async consoleId(): Promise<string> {
    if (this.cfg.consoleIdOverride) return this.cfg.consoleIdOverride;
    if (!this.consoleIdP) {
      this.consoleIdP = this.resolveConsoleId().catch((e) => {
        this.consoleIdP = undefined;
        throw e;
      });
    }
    return this.consoleIdP;
  }

  async networkSiteId(): Promise<string> {
    if (this.cfg.networkSiteIdOverride) return this.cfg.networkSiteIdOverride;
    if (!this.networkSiteIdP) {
      this.networkSiteIdP = this.resolveNetworkSiteId().catch((e) => {
        this.networkSiteIdP = undefined;
        throw e;
      });
    }
    return this.networkSiteIdP;
  }

  async siteManagerSiteId(): Promise<string> {
    if (this.cfg.siteManagerSiteIdOverride) return this.cfg.siteManagerSiteIdOverride;
    if (!this.siteManagerSiteIdP) {
      this.siteManagerSiteIdP = this.resolveSiteManagerSiteId().catch((e) => {
        this.siteManagerSiteIdP = undefined;
        throw e;
      });
    }
    return this.siteManagerSiteIdP;
  }

  async identity(): Promise<UnifiIdentity> {
    const [c, n, s] = await Promise.all([
      this.consoleId(),
      this.networkSiteId(),
      this.siteManagerSiteId(),
    ]);
    let console: Host | undefined;
    try {
      const res = await this.client.request<{ data?: Host }>(
        "GET",
        `/v1/hosts/${encodeURIComponent(c)}`,
      );
      console = res.data?.data ?? (res.data as Host);
    } catch {
      // ignore
    }
    return { consoleId: c, networkSiteId: n, siteManagerSiteId: s, console };
  }

  private async resolveConsoleId(): Promise<string> {
    const res = await this.client.request<{ data: Host[] }>("GET", "/v1/hosts", SHARED);
    const hosts = res.data?.data ?? [];
    // Owned consoles first; only when there is none, an owned UniFi OS Server
    // (type "ucore", as in the vendor example) is used (audit N-42).
    const owned = (type: string) => hosts.filter((h) => h.type === type && h.owner === true);
    const consoles = owned("console");
    const matches = consoles.length > 0 ? consoles : owned("ucore");
    if (matches.length === 0) {
      throw new Error(
        "Discovery: no console found (need type=console or ucore, owner=true). Check API key scope or set UNIFI_CONSOLE_ID.",
      );
    }
    if (matches.length > 1) {
      const ids = matches.map((m) => m.id).join(", ");
      throw new Error(
        `Discovery: multiple consoles match (${ids}). Set UNIFI_CONSOLE_ID env var to pin one.`,
      );
    }
    return matches[0]!.id;
  }

  private async resolveNetworkSiteId(): Promise<string> {
    const c = await this.consoleId();
    const res = await this.client.requestNetwork<{ data: { id: string }[] }>(
      "GET",
      c,
      "/v1/sites",
      SHARED,
    );
    const sites = res.data?.data ?? [];
    if (sites.length === 0) throw new Error("Discovery: Network API returned zero sites.");
    if (sites.length > 1) {
      const ids = sites.map((s) => s.id).join(", ");
      throw new Error(
        `Discovery: multiple Network sites (${ids}). Set UNIFI_NETWORK_SITE_ID env var.`,
      );
    }
    return sites[0]!.id;
  }

  private async resolveSiteManagerSiteId(): Promise<string> {
    const res = await this.client.request<{ data: { siteId: string }[] }>(
      "GET",
      "/v1/sites",
      SHARED,
    );
    const sites = res.data?.data ?? [];
    if (sites.length === 0) throw new Error("Discovery: Site Manager returned zero sites.");
    if (sites.length > 1) {
      const ids = sites.map((s) => s.siteId).join(", ");
      throw new Error(
        `Discovery: multiple Site Manager sites (${ids}). Set UNIFI_SITE_MANAGER_SITE_ID env var.`,
      );
    }
    return sites[0]!.siteId;
  }
}
