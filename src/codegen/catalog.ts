export type Surface = "siteManager" | "network";

export interface CatalogEntry {
  surface: Surface;
  docPath: string;       // path appended to https://developer.ui.com/
  toolName: string;      // e.g. unifi_gen_createfirewallpolicy
}

const SITE_MANAGER_VERSION = "site-manager/v1.0.0";
const NETWORK_VERSION = "network/v10.3.58";

// gethost and getsdwanconfig may not have parseable RSC docs at any given moment;
// they are also covered by hand-wrappers (unifi_sm_get_host, unifi_sm_get_sdwan_config).
// NOTE: connector catch-alls (connectorget/post/put/delete/patch) have no
// dedicated doc pages. They are functionally accessible via unifi_raw_request.
const SITE_MANAGER_PAGES = [
  "listhosts", "gethost", "listsites", "listdevices",
  "getispmetrics", "queryispmetrics",
  "listsdwanconfigs", "getsdwanconfig", "getsdwanconfigstatus",
];

const NETWORK_PAGES = [
  // Application Info
  "getinfo",
  // Sites
  "getsiteoverviewpage",
  // UniFi Devices
  "getadopteddeviceoverviewpage", "getadopteddevicedetails", "getadopteddevicelateststatistics",
  "getpendingdevicepage", "adoptdevice", "executeportaction", "executeadopteddeviceaction",
  "removedevice",
  // Clients
  "getconnectedclientoverviewpage", "getconnectedclientdetails", "executeconnectedclientaction",
  // Networks
  "getnetworksoverviewpage", "getnetworkdetails", "getnetworkreferences",
  "createnetwork", "updatenetwork", "deletenetwork",
  // WiFi Broadcasts
  "getwifibroadcastpage", "getwifibroadcastdetails",
  "createwifibroadcast", "updatewifibroadcast", "deletewifibroadcast",
  // Hotspot
  "getvouchers", "getvoucher", "createvouchers", "deletevouchers", "deletevoucher",
  // Firewall
  "getfirewallzones", "getfirewallzone", "createfirewallzone", "updatefirewallzone", "deletefirewallzone",
  "getfirewallpolicies", "getfirewallpolicy", "createfirewallpolicy", "updatefirewallpolicy",
  "patchfirewallpolicy", "deletefirewallpolicy", "getfirewallpolicyordering", "updatefirewallpolicyordering",
  // ACL Rules
  "getaclrulepage", "getaclrule", "createaclrule", "updateaclrule", "deleteaclrule",
  "getaclruleordering", "updateaclruleordering",
  // Switching
  "getswitchstackpage", "getswitchstack", "getmclagdomainpage", "getmclagdomain",
  "getlagpage", "getlag",
  // DNS Policies
  "getdnspolicypage", "getdnspolicy", "creatednspolicy", "updatednspolicy", "deletednspolicy",
  // Traffic Matching Lists
  "gettrafficmatchinglists", "gettrafficmatchinglist", "createtrafficmatchinglist",
  "updatetrafficmatchinglist", "deletetrafficmatchinglist",
  // Supporting
  "getwansoverviewpage", "getsitetositevpntunnelpage", "getvpnserverpage",
  "getradiusprofileoverviewpage", "getdevicetagpage",
  "getdpiapplicationcategories", "getdpiapplications", "getcountries",
];

export const CATALOG: CatalogEntry[] = [
  ...SITE_MANAGER_PAGES.map((p) => ({
    surface: "siteManager" as Surface,
    docPath: `${SITE_MANAGER_VERSION}/${p}`,
    toolName: `unifi_gen_${p}`,
  })),
  ...NETWORK_PAGES.map((p) => ({
    surface: "network" as Surface,
    docPath: `${NETWORK_VERSION}/${p}`,
    toolName: `unifi_gen_${p}`,
  })),
];

export const SITE_MANAGER_BASE = `https://developer.ui.com/${SITE_MANAGER_VERSION}`;
export const NETWORK_BASE = `https://developer.ui.com/${NETWORK_VERSION}`;
