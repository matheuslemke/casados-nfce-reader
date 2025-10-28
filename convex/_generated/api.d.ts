/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as classify from "../classify.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as invoiceItems from "../invoiceItems.js";
import type * as lib_parse from "../lib/parse.js";
import type * as nfce from "../nfce.js";
import type * as nfceInternal from "../nfceInternal.js";
import type * as pricing from "../pricing.js";
import type * as router from "../router.js";
import type * as scraper from "../scraper.js";
import type * as scraperInternal from "../scraperInternal.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  catalog: typeof catalog;
  classify: typeof classify;
  crons: typeof crons;
  http: typeof http;
  invoiceItems: typeof invoiceItems;
  "lib/parse": typeof lib_parse;
  nfce: typeof nfce;
  nfceInternal: typeof nfceInternal;
  pricing: typeof pricing;
  router: typeof router;
  scraper: typeof scraper;
  scraperInternal: typeof scraperInternal;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
