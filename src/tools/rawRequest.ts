import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../server.js";
import { jsonResult, apiErrorResult } from "./helpers.js";
import { withQuery } from "../client/unifiClient.js";
import { runGuarded, confirmShape } from "./destructiveGuard.js";
import { UnifiApiError } from "../client/errors.js";

const methodEnum = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const inputShape = {
  method: methodEnum.describe("HTTP method"),
  path: z
    .string()
    .regex(/^\/(?!\/)/, 'must be a relative path starting with "/"')
    .refine(
      (p) => !/:\/\/|@|\\/.test(p) && !p.toLowerCase().split("%2e").join(".").includes(".."),
      { message: 'absolute URLs, "//", "..", "@" and "\\" are not allowed' },
    )
    .describe(
      'Relative path beginning with "/v1/…" against the configured API base (api.ui.com). Example: "/v1/hosts".',
    ),
  body: z.unknown().optional().describe("JSON body for POST/PUT/PATCH"),
  query: z
    .record(z.string(), z.string())
    .optional()
    .describe("Query parameters as flat string map"),
  ...confirmShape,
};

export function registerRawRequestTool(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    "unifi_raw_request",
    {
      title: "UniFi raw request",
      description:
        "Generic escape hatch: executes ANY HTTP method against api.ui.com{path}. Use when no dedicated tool exists. Auth, retry, error parsing and pagination hints are handled automatically.",
      inputSchema: z.object(inputShape),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const method = args.method;
      const performExecute = async () => {
        try {
          const res = await ctx.client.request(method, args.path, {
            body: args.body,
            query: args.query,
          });
          return jsonResult(res.data, { pagination: res.pagination });
        } catch (err) {
          if (err instanceof UnifiApiError) return apiErrorResult(err);
          throw err;
        }
      };
      if (method === "GET") return performExecute();
      return runGuarded(
        ctx.cfg,
        args,
        {
          toolName: "unifi_raw_request",
          method: method as "POST" | "PUT" | "PATCH" | "DELETE",
          url: withQuery(args.path, args.query),
          body: args.body,
        },
        performExecute,
      );
    },
  );
}
