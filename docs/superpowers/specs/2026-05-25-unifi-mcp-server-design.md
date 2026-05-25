# UniFi MCP Server — Design Spec

**Status:** approved (brainstorming abgeschlossen 2026-05-25)
**Owner:** Manuel Guttmann
**Scope:** lokaler stdio-MCP-Server, der die offizielle UniFi-Cloud-API (Site Manager + Network) zu 100 % als Tools, Resources und Prompts exponiert — lesend UND schreibend.

---

## 1. Ziel

Ein lokaler MCP-Server, der das gesamte UniFi-Netzwerk von überall steuerbar macht — ohne LAN, VPN oder Port-Forwarding. Alle Calls laufen ausschließlich gegen `https://api.ui.com`. Schreib-Operationen (Firewall, Netzwerke, WLANs, Geräte-Aktionen, Vouchers, DNS-Policies, ACL-Regeln, Switching, Traffic-Lists usw.) sind explizit Bestandteil. Out of Scope: Protect-API, eigene UI, Scheduler.

## 2. Stack-Entscheidungen

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Sprache | TypeScript, ES-Module (`module: "NodeNext"`, `strict`, `noUncheckedIndexedAccess`) | Konsistent zu existierendem `action1-mcp` |
| SDK | `@modelcontextprotocol/sdk` (1.x) + `zod` | Standard für MCP |
| Transport | nur `StdioServerTransport` | Brief §6 |
| Runtime | Node ≥ 20 | matches action1-mcp |
| Build | `tsc` → `dist/`, Entry `dist/index.js` (shebang) | Standard |
| Quality | ESLint 9 (flat), Prettier, vitest | wie action1-mcp |
| Verpackung | MCPB-Bundle via `scripts/build-mcpb.sh` | bestätigt |
| VCS | Lokal initialisiert, kein Remote-Push | bestätigt |
| Codegen | Hybrid: handgepflegte Wrapper + automatisch generierte Tools aus RSC-Doku | bestätigt |
| Schreibschutz | Env-Schalter `UNIFI_CONFIRM_WRITES`, default `false`, opt-in Preview | bestätigt |

## 3. Verzeichnis-Layout

```
the-real-unifi-mcp/
├── .env.example
├── .gitignore
├── README.md
├── CHANGELOG.md
├── LICENSE                  (MIT)
├── eslint.config.js
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── mcpb/manifest.json
├── scripts/build-mcpb.sh
├── docs/superpowers/specs/2026-05-25-unifi-mcp-server-design.md  (diese Datei)
├── src/
│   ├── index.ts             # stdio-Bootstrap: .env laden, Logger init, Server starten
│   ├── server.ts            # buildServer() registriert Tools + Resources + Prompts
│   ├── config.ts            # loadConfig() — Zod-validierte env-Variablen
│   ├── constants.ts         # API-Basis, default Headers, Retry-Defaults
│   ├── client/
│   │   ├── unifiClient.ts   # fetch-Wrapper mit Auth, Timeout, JSON-Parse, Pagination-Hints
│   │   ├── discovery.ts     # consoleId + Network-siteId + Site-Manager-siteId Cache
│   │   ├── retry.ts         # 429-/5xx-Backoff inkl. Retry-After-Header
│   │   ├── pagination.ts    # offset/limit + hasMore-Hints
│   │   ├── errors.ts        # UnifiApiError (statusCode, statusName, code, message)
│   │   └── rsc.ts           # RSC-Doku-Fetcher (`RSC: 1` Header)
│   ├── tools/
│   │   ├── helpers.ts       # Auto-Resolve consoleId/siteId aus Discovery
│   │   ├── destructiveGuard.ts  # Preview/Execute-Pattern
│   │   ├── rawRequest.ts    # unifi_raw_request Escape-Hatch
│   │   ├── siteManager.ts   # Hand-Wrapper für 10 Site Manager Endpoints
│   │   ├── network/
│   │   │   ├── info.ts
│   │   │   ├── sites.ts
│   │   │   ├── devices.ts
│   │   │   ├── clients.ts
│   │   │   ├── networks.ts
│   │   │   ├── wifi.ts
│   │   │   ├── firewall.ts
│   │   │   ├── acl.ts
│   │   │   ├── switching.ts
│   │   │   ├── dns.ts
│   │   │   ├── trafficLists.ts
│   │   │   ├── hotspot.ts
│   │   │   └── supporting.ts
│   │   └── generated/       # Codegen-Output (committet) — 100 % Abdeckung
│   ├── codegen/
│   │   ├── generate.ts      # Entry: Katalog → fetch → parse → emit
│   │   ├── catalog.ts       # vollständige Liste aller Doku-Seitennamen
│   │   ├── rscParser.ts     # findet "endpoint":{…}
│   │   ├── schemaFromDoc.ts # Doku-Schema → Zod
│   │   └── emit.ts          # Tool-Datei-Template
│   ├── resources/
│   │   ├── index.ts
│   │   ├── identity.ts      # unifi://identity
│   │   └── hosts.ts         # unifi://hosts, unifi://hosts/{id}
│   ├── prompts/
│   │   ├── index.ts
│   │   ├── auditFirewall.ts
│   │   ├── networkHealth.ts
│   │   └── adoptionStatus.ts
│   └── utils/
│       ├── logger.ts        # stderr-only, Levels, Key-Redaction
│       └── json.ts          # safe-stringify mit Truncation
└── tests/
    ├── unit/                # client, discovery, retry, guard, pagination, codegen (mocked fetch)
    └── integration/         # read-only Smoke gegen Live-Env (skipped ohne Key)
```

## 4. Konfiguration (.env)

```env
UNIFI_API_KEY=                  # required, Site-Manager-Key mit Network-Scope
UNIFI_API_BASE=https://api.ui.com
UNIFI_CONFIRM_WRITES=false      # true → Preview/Confirm für destruktive Tools
UNIFI_TIMEOUT_MS=30000
UNIFI_LOG_LEVEL=info            # debug | info | warn | error
UNIFI_CONSOLE_ID=               # optional: überspringt Discovery
UNIFI_NETWORK_SITE_ID=          # optional
UNIFI_SITE_MANAGER_SITE_ID=     # optional
```

`.env.example` wird ohne Werte ausgeliefert. `.gitignore` umfasst: `.env`, `dist/`, `node_modules/`, `coverage/`, `*.mcpb`, `.DS_Store`, `*.log`.

## 5. HTTP-Client

`UnifiClient`-Klasse mit drei Layern:

```ts
class UnifiClient {
  // Workhorse — beliebiger Pfad gegen api.ui.com
  request<T>(method, path, opts?: { body?; query?; headers?; idempotent?: boolean }): Promise<UnifiResponse<T>>

  // Network-API via Cloud Connector — prefix mit consoleId aus Discovery
  requestNetwork<T>(method, docPath, opts?)

  // Site Manager direkt
  requestSiteManager<T>(method, path, opts?)
}
```

**Verhalten:**
- Auth-Header `X-API-Key` auf jedem Request, niemals geloggt.
- Default Headers: `Accept: application/json`. Bei Body zusätzlich `Content-Type: application/json` + `JSON.stringify(body)`.
- Timeout via `AbortController`, default 30 s.
- Response-Status `204` → `data: null`. JSON content-type → parse, sonst raw Text.
- Pagination-Hint bei `{ data: [], offset, limit, count, totalCount }` und `offset+count < totalCount`.
- Nicht-2xx → `UnifiApiError` mit strukturierten Feldern aus Body (`statusCode, statusName, code, message`).

**Retry-Policy (src/client/retry.ts):**
- **429** → `Retry-After` Header (Sekunden oder HTTP-Date) honorieren, sonst Backoff `[1s, 2s, 4s]`, max 3 Retries.
- **5xx (außer 501)** → Backoff `[1s, 2s, 4s]`, max 2 Retries.
- **Netzwerk-Fehler** → 1 Retry nach 500 ms.
- Schreib-Methoden bei 5xx nur retried, wenn `opts.idempotent: true` gesetzt (verhindert doppelte Voucher etc.). Dieser Client-Flag ist unabhängig vom MCP-Tool-Annotation `idempotentHint` in §7 — letzterer ist reine Client-Metadata für MCP-Hosts, ersterer steuert die Retry-Logik.

## 6. Discovery

```ts
class Discovery {
  consoleId(): Promise<string>          // GET /v1/hosts → type=console & owner=true → id
  networkSiteId(): Promise<string>      // GET .../proxy/network/integration/v1/sites → data[0].id
  siteManagerSiteId(): Promise<string>  // GET /v1/sites → data[0].siteId
  identity(): Promise<UnifiIdentity>    // alle drei + Konsolen-Metadaten
  reset(): void                         // Tests
}
```

- **Caching:** Process-Lifetime, kein TTL. Concurrent Calls werden via gespeicherte Promise dedupliziert.
- **Env-Override:** Wenn `UNIFI_CONSOLE_ID` / `UNIFI_NETWORK_SITE_ID` / `UNIFI_SITE_MANAGER_SITE_ID` gesetzt sind, wird der entsprechende Discovery-Call übersprungen.
- **Auswahl bei mehreren Hosts:** Wenn mehr als ein `type=console & owner=true` Host gefunden wird, Fehler mit Hinweis auf `UNIFI_CONSOLE_ID`-Override.

## 7. Tool-Strategie

Drei Schichten koexistieren ohne Namens-Kollision:

| Schicht | Namens-Schema | Anzahl ca. | Inhalt |
|---|---|---|---|
| Site Manager Hand-Wrapper | `unifi_sm_<verb>_<resource>` | 10 | Direkt gegen `api.ui.com`. Schöne DX, sprechende Param-Namen. |
| Network Hand-Wrapper | `unifi_net_<verb>_<resource>` | ~30 | Komfort-Wrapper für häufige Operationen (Auto-Resolve siteId, Action-Presets wie `reboot_device`, `block_client`). |
| Generierte Tools | `unifi_gen_<docPageName>` | ~140 | Aus RSC-Doku generiert, 100 % API-Abdeckung. |
| Escape-Hatch | `unifi_raw_request` | 1 | Beliebige Methode + Pfad. |

**Tool-Annotations (MCP Hints):**
- Lese-Tools: `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`.
- Schreib-Tools: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint` je nach Methode (PUT/DELETE typischerweise `true`, POST `false`), `openWorldHint: true`.
- Hints sind reine Metadaten, schränken Funktion nicht ein.

## 8. Codegen-Pipeline

1. **Katalog (`src/codegen/catalog.ts`):** Liste aller Doku-Seitennamen aus Brief §4.2 (Site Manager + Network). Zusätzlich Versuch, fehlende Seiten via Sitemap-Diff zu erkennen (loggt, übernimmt nicht stillschweigend).
2. **Fetch (`src/client/rsc.ts`):** GET der Doku-Seite mit Header `RSC: 1`. Response als Text, Unicode-Escapes (`\uXXXX`) dekodieren.
3. **Parse (`src/codegen/rscParser.ts`):** Streaming-Parser findet `"endpoint":{` und liest balanciertes JSON. Felder: `path`, `method`, `parameters[]` (mit `in: query|path`), `requestBody.schema`, `responses{}`.
4. **Schema-Mapping (`src/codegen/schemaFromDoc.ts`):** Doku-Schema → Zod. Primitive, `enum`, `array`, `object`, `oneOf` → `z.union`, `allOf` → object-merge, `$ref` → in-line aufgelöst aus `components`/`definitions`-Block der RSC-Payload (Codegen führt Cache für aufgelöste Refs). Unbekannt → `z.unknown()` mit Warn-Log.
5. **Emit (`src/codegen/emit.ts`):** Pro Endpoint eine `.ts`-Datei in `src/tools/generated/`, exportiert Tool-Definition mit `name`, `description`, `annotations`, `inputSchema`, `handler`. Non-GET-Handler werden automatisch in `guardedExecute` gewickelt.
6. **Build-Integration:** `npm run codegen` separat von `npm run build`. Output ist committet → Builds sind reproduzierbar und offline-fähig.
7. **Doku-Versionen:** Pfade werden bei Codegen-Run gespeichert (z. B. `network/v10.3.58`, `site-manager/v1.0.0`). Versionssprünge sind sichtbar im Diff.

## 9. Schreibschutz — `destructiveGuard`

```ts
async function guardedExecute<T>(
  cfg: Config,
  args: { confirm?: string },
  req: { method: string; url: string; body?: unknown },
  execute: () => Promise<T>,
): Promise<T | { preview: typeof req; hint: string }> {
  if (!cfg.confirmWrites) return execute();              // Default: direkt
  if (args.confirm === "YES") return execute();          // opt-in scharfschalten
  return {
    preview: req,
    hint: 'UNIFI_CONFIRM_WRITES=true is set. Re-run with `confirm: "YES"` to apply this change.',
  };
}
```

- Lese-Tools rufen den Guard nie auf.
- Schreib-Tools (Hand- und generiert) rufen ihn immer auf.
- Preview redacted sensitive Body-Felder (Schlüssel-Match auf `password|key|secret|token`).
- Preview enthält voll aufgelösten URL inkl. consoleId und siteId — leicht reviewbar.

## 10. Resources

| URI | Inhalt | Quelle |
|---|---|---|
| `unifi://identity` | `{ consoleId, networkSiteId, siteManagerSiteId, hostname, hardwareId, firmwareVersion, ipAddress }` | Discovery + `GET /v1/hosts/{id}` |
| `unifi://hosts` | Account-Hosts-Liste | `GET /v1/hosts` |
| `unifi://hosts/{id}` | Host-Details | `GET /v1/hosts/{id}` |

Read-only Context-Surfaces für bequemes Browsing ohne Tool-Call.

## 11. Prompts

- **`unifi-audit-firewall`** (Argument `siteId?` optional) — Firewall-Zonen + Policies laden, nach Zone gruppieren, hervorheben: disabled rules, „allow any-any", Policies ohne Description. Härtungsvorschläge.
- **`unifi-network-health`** (keine Args) — WAN-Status, Geräte (online/offline/uptime), Top-Clients nach Traffic, kritische Auffälligkeiten. Aktionen empfehlen.
- **`unifi-adoption-status`** (keine Args) — Pending adoptions auflisten, Empfehlung adoptieren/entfernen.

Prompts erzeugen nur die Anweisung an das LLM. Tool-Ausführung übernimmt der Client.

## 12. Logging

- `process.stderr.write` only — niemals `console.log` (stdio-safe).
- Levels `debug | info | warn | error`, default `info`, env `UNIFI_LOG_LEVEL`.
- Vor jedem Log-Statement Redaction-Pass über Schlüssel-Werte und Header (`X-API-Key`, `Authorization`).
- Auf `debug` werden Methode + URL + Status + Dauer geloggt; Bodies nur `< 2 KB` und nach Redaction.

## 13. Test-Strategie

| Layer | Tool | Coverage-Ziel |
|---|---|---|
| Unit | vitest + `vi.fn()` für `fetch` | client, discovery, retry, errors, destructiveGuard, pagination, helpers, codegen-modules |
| Codegen-Snapshot | vitest + 3–5 gespeicherte RSC-Fixtures | rscParser, schemaFromDoc, emit |
| Integration (live, read-only) | vitest, `skipIf(!process.env.UNIFI_API_KEY)` | Plausibilitäts-Anker aus Brief §7: 16 Devices, 8 Clients, 3 Networks, 3 WLANs, 6 Firewall-Zonen, 65 Policies, 2 WANs |
| Schreib-Smoke (manuell) | `npm run inspector` | ein reversibler Hotspot-Voucher (create → delete) |
| MCP Inspector | `@modelcontextprotocol/inspector` | manuelle Verifikation |

Keine blinden Schreib-Tests gegen das Produktivnetz.

## 14. MCPB-Bundle

`mcpb/manifest.json` (Kern):
```json
{
  "manifest_version": "0.1",
  "name": "the-real-unifi-mcp",
  "display_name": "UniFi MCP",
  "version": "0.1.0",
  "server": { "type": "node", "entry_point": "dist/index.js" },
  "user_config": [
    { "key": "UNIFI_API_KEY", "title": "Site Manager API Key", "type": "secret", "required": true },
    { "key": "UNIFI_CONFIRM_WRITES", "title": "Require explicit confirm for writes", "type": "boolean", "default": false }
  ]
}
```

`scripts/build-mcpb.sh` analog action1-mcp: `npm run build` → bundle → `the-real-unifi-mcp-<version>.mcpb`.

## 15. Git-Init

Am Schluss der Implementierung:
1. `git init`
2. `.gitignore` enthält `.env`, `dist/`, `node_modules/`, `coverage/`, `*.mcpb`, `.DS_Store`, `*.log`.
3. Pre-Commit-Check: `.env` darf NICHT staged sein.
4. Initial Commit: `chore: initial scaffold — UniFi MCP server with hybrid codegen + hand-wrappers`.
5. Kein Push, keine Remote.

## 16. Definition-of-Done

| §8-Anforderung | Erfüllung |
|---|---|
| Alle Endpoints beider APIs als Tools, Lesen + Schreiben | `tools/generated/` + Hand-Wrapper |
| `unifi_raw_request` Escape-Hatch | `tools/rawRequest.ts` |
| Destructive-Hints + `UNIFI_CONFIRM_WRITES` | `destructiveGuard.ts` + Annotations |
| stdio-MCP, Key aus `.env`, Build grün | `index.ts` + `config.ts` + `tsc` + `prebuild` (lint + typecheck + unit-tests) |
| Lese-Tools live verifiziert | `tests/integration/readonly-smoke.test.ts` |
| Schreib-Tools gegen Doku verifiziert | Codegen-Snapshot-Tests + ein Voucher-Roundtrip |
| README + `.env.example`, `.env` gitignored | beide Files + `.gitignore` |
| 100 % API-Abdeckung, kein Out-of-Scope | Katalog mit Sitemap-Diff |

## 17. Risiken & Mitigations

| Risiko | Mitigation |
|---|---|
| RSC-Doku-Format-Drift | Snapshot-Tests + Escape-Hatch + Codegen ist build-unabhängig |
| Doku-Schema-Gaps | Codegen failt laut bei unparsbaren Schemas; fällt auf thin `z.unknown()`-Wrapper zurück mit Warn |
| Rate-Limits nicht numerisch dokumentiert | Backoff-Default `[1s, 2s, 4s]` + `Retry-After`-Honor; env-tunbar |
| Zwei verschiedene siteIds | Discovery löst automatisch, env-Overrides möglich, beide in `unifi://identity` Resource sichtbar |
| Mehrere Konsolen am Account | Discovery erzwingt eindeutige Auswahl oder verlangt `UNIFI_CONSOLE_ID`-Override |
| API-Key in Chat-Historie geleakt | README empfiehlt Rotation nach Setup |

## 18. Out of Scope (explizit)

- UniFi Protect (Kameras)
- LAN-Direkt-Zugriff (`https://192.168.x.x/proxy/network/integration/...`) — bewusst nicht; nur Cloud
- Eigene UI, Dashboards, CLIs
- Scheduler / Background-Jobs
- HTTP-Transport (nur stdio)
- Multi-Tenant / Mehrere Konsolen pro Server-Instanz (eine Konsole pro Prozess)

## 19. Plausibilitäts-Anker (für Live-Verifikation)

Anchor-Werte aus Brief §7 — Werte können sich ändern, aber dienen als Sanity-Check beim Smoke-Test:
- 16 adopted devices
- 8 connected clients
- 3 networks
- 3 WiFi broadcasts
- 6 firewall zones
- 65 firewall policies
- 2 WAN interfaces („Telekom Glasfaser" + „Internet - Backup - Mobilfunk")
