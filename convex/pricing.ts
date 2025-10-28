import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

type Agg = "avg" | "min" | "max";

function aggValues(values: number[], agg: Agg): number {
  if (values.length === 0) return 0;
  switch (agg) {
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
  }
}

// Historical prices by product, grouped by day
export const getProductPriceTrends = query({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    unit: v.string(),
    fromTs: v.optional(v.number()),
    toTs: v.optional(v.number()),
    agg: v.optional(
      v.union(v.literal("avg"), v.literal("min"), v.literal("max"))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const agg: Agg = (args.agg as Agg) ?? "avg";

    const q = ctx.db
      .query("invoiceItems")
      .withIndex("by_product", (q) =>
        q.eq("canonicalProductId", args.canonicalProductId)
      )
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("unit"), args.unit));

    const items = await q.collect();
    const filtered = items.filter((it) => {
      const ts = it.emission_ts ?? 0;
      if (args.fromTs && ts < args.fromTs) return false;
      if (args.toTs && ts > args.toTs) return false;
      return true;
    });

    const byDay: Record<string, number[]> = {};
    for (const it of filtered) {
      const d = new Date(it.emission_ts ?? 0);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const price = it.numericUnitPrice ?? 0;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(price);
    }

    return Object.entries(byDay)
      .map(([date, values]) => ({ date, value: aggValues(values, agg) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  },
});

// Price differences across stores for a product within a date range
export const compareStorePrices = query({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    unit: v.string(),
    fromTs: v.optional(v.number()),
    toTs: v.optional(v.number()),
    agg: v.optional(
      v.union(v.literal("avg"), v.literal("min"), v.literal("max"))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const agg: Agg = (args.agg as Agg) ?? "avg";

    const q = ctx.db
      .query("invoiceItems")
      .withIndex("by_product", (q) =>
        q.eq("canonicalProductId", args.canonicalProductId)
      )
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("unit"), args.unit));

    const items = await q.collect();
    const filtered = items.filter((it) => {
      const ts = it.emission_ts ?? 0;
      if (args.fromTs && ts < args.fromTs) return false;
      if (args.toTs && ts > args.toTs) return false;
      return true;
    });

    const byIssuer: Record<string, number[]> = {};
    for (const it of filtered) {
      const issuer = (it.issuer || "").trim() || "Unknown";
      const price = it.numericUnitPrice ?? 0;
      if (!byIssuer[issuer]) byIssuer[issuer] = [];
      byIssuer[issuer].push(price);
    }

    return Object.entries(byIssuer)
      .map(([issuer, values]) => ({
        issuer,
        value: aggValues(values, agg),
        sampleSize: values.length,
      }))
      .sort((a, b) => a.value - b.value);
  },
});

// Monthly price fluctuations for a product
export const getMonthlyAverages = query({
  args: {
    canonicalProductId: v.id("canonicalProducts"),
    unit: v.string(),
    monthsBack: v.optional(v.number()),
    agg: v.optional(
      v.union(v.literal("avg"), v.literal("min"), v.literal("max"))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const agg: Agg = (args.agg as Agg) ?? "avg";
    const monthsBack = Math.max(1, Math.min(36, args.monthsBack ?? 12));

    const items = await ctx.db
      .query("invoiceItems")
      .withIndex("by_product", (q) =>
        q.eq("canonicalProductId", args.canonicalProductId)
      )
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("unit"), args.unit))
      .collect();

    // Group by YYYY-MM
    const byMonth: Record<string, number[]> = {};
    for (const it of items) {
      const ts = it.emission_ts ?? 0;
      const d = new Date(ts);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const price = it.numericUnitPrice ?? 0;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(price);
    }

    const entries = Object.entries(byMonth)
      .map(([month, values]) => ({ month, value: aggValues(values, agg) }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));

    // Trim to recent N months if necessary
    const recent = entries.slice(Math.max(0, entries.length - monthsBack));
    return recent;
  },
});
