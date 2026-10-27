export type Surface = "siteManager" | "network";

/** Vendor doc version each surface is generated from (N-38). */
export const SPEC_VERSIONS: Record<Surface, string> = {
  siteManager: "v1.0.0",
  network: "v11.0.97",
};

const DOC_DIR: Record<Surface, string> = { siteManager: "site-manager", network: "network" };

/** Public vendor OpenAPI document of one surface version. */
export function specUrl(surface: Surface, version: string): string {
  return `https://developer.ui.com/${DOC_DIR[surface]}/${version}/openapi.json`;
}

/** File name of that document in tests/fixtures/openapi/. */
export function specFixtureName(surface: Surface, version: string): string {
  return `${DOC_DIR[surface]}_${version}.json`;
}

/**
 * Vendor operations that deliberately get no generated tool (lowercased
 * operationIds). The connector catch-alls proxy any console path; they are
 * covered by unifi_raw_request, which checks the path.
 */
export const EXCLUDED_OPERATIONS: Record<Surface, string[]> = {
  siteManager: [
    "connectordelete",
    "connectorget",
    "connectorpatch",
    "connectorpost",
    "connectorput",
  ],
  network: [],
};

export interface CatalogEntry {
  surface: Surface;
  /** Lowercased vendor operationId, also the tool name suffix. */
  slug: string;
  /** Vendor doc version the tool is generated from. */
  specVersion: string;
  /** Path appended to https://developer.ui.com/ in the tool description. */
  docPath: string;
  toolName: string; // e.g. unifi_gen_createfirewallpolicy
  /**
   * Set when the vendor dropped the operation: the last doc version that has
   * it. The tool stays registered, generated from that version's document
   * (keep its file in tests/fixtures/openapi/), says so in its description
   * and answers a 404 with a REMOVED_UPSTREAM error.
   */
  removedUpstream?: string;
}

/**
 * Operations the vendor removed. Never delete a generated tool: pin it here to
 * the last doc version that has it, e.g. `network: { someslug: "v10.3.58" }`.
 */
const REMOVED_UPSTREAM: Record<Surface, Record<string, string>> = {
  siteManager: {},
  network: {},
};

const SITE_MANAGER_PAGES = [
  "listhosts",
  "gethostbyid",
  "listsites",
  "listdevices",
  "getispmetrics",
  "queryispmetrics",
  "listsdwanconfigs",
  "getsdwanconfigbyid",
  "getsdwanconfigstatus",
];

const NETWORK_PAGES = [
  // Application Info
  "getinfo",
  // Sites
  "getsiteoverviewpage",
  // UniFi Devices
  "getadopteddeviceoverviewpage",
  "getadopteddevicedetails",
  "getadopteddevicelateststatistics",
  "getpendingdevicepage",
  "adoptdevice",
  "executeportaction",
  "executeadopteddeviceaction",
  "removedevice",
  // Clients
  "getconnectedclientoverviewpage",
  "getconnectedclientdetails",
  "executeconnectedclientaction",
  // Networks
  "getnetworksoverviewpage",
  "getnetworkdetails",
  "getnetworkreferences",
  "createnetwork",
  "updatenetwork",
  "deletenetwork",
  // WiFi Broadcasts
  "getwifibroadcastpage",
  "getwifibroadcastdetails",
  "createwifibroadcast",
  "updatewifibroadcast",
  "deletewifibroadcast",
  // Hotspot
  "getvouchers",
  "getvoucher",
  "createvouchers",
  "deletevouchers",
  "deletevoucher",
  // Firewall
  "getfirewallzones",
  "getfirewallzone",
  "createfirewallzone",
  "updatefirewallzone",
  "deletefirewallzone",
  "getfirewallpolicies",
  "getfirewallpolicy",
  "createfirewallpolicy",
  "updatefirewallpolicy",
  "patchfirewallpolicy",
  "deletefirewallpolicy",
  "getfirewallpolicyordering",
  "updatefirewallpolicyordering",
  // ACL Rules
  "getaclrulepage",
  "getaclrule",
  "createaclrule",
  "updateaclrule",
  "deleteaclrule",
  "getaclruleordering",
  "updateaclruleordering",
  // Switching
  "getswitchstackpage",
  "getswitchstack",
  "getmclagdomainpage",
  "getmclagdomain",
  "getlagpage",
  "getlag",
  // DNS Policies
  "getdnspolicypage",
  "getdnspolicy",
  "creatednspolicy",
  "updatednspolicy",
  "deletednspolicy",
  // Traffic Matching Lists
  "gettrafficmatchinglists",
  "gettrafficmatchinglist",
  "createtrafficmatchinglist",
  "updatetrafficmatchinglist",
  "deletetrafficmatchinglist",
  // Supporting
  "getwansoverviewpage",
  "getsitetositevpntunnelpage",
  "getvpnserverpage",
  "getradiusprofileoverviewpage",
  "getdevicetagpage",
  "getdpiapplicationcategories",
  "getdpiapplications",
  "getcountries",
];

function entry(surface: Surface, slug: string): CatalogEntry {
  const removed = REMOVED_UPSTREAM[surface][slug];
  const specVersion = removed ?? SPEC_VERSIONS[surface];
  const e: CatalogEntry = {
    surface,
    slug,
    specVersion,
    docPath: `${DOC_DIR[surface]}/${specVersion}/${slug}`,
    toolName: `unifi_gen_${slug}`,
  };
  if (removed) e.removedUpstream = removed;
  return e;
}

/** The generated tools: one per entry, never renamed or dropped (consumer contract). */
export const CATALOG: CatalogEntry[] = [
  ...SITE_MANAGER_PAGES.map((p) => entry("siteManager", p)),
  ...NETWORK_PAGES.map((p) => entry("network", p)),
];
