import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { parseBrNumber, safeLower, nowMs } from "./lib/parse";
import { Id } from "./_generated/dataModel";

// Sync flattened invoice items from nfce_links into invoiceItems table
export const syncInvoiceItemsFromInvoices = mutation({
  args: { reprocessAll: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Collect all invoices for this user
    const invoices = await ctx.db
      .query("nfce_links")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let inserted = 0;
    let deleted = 0;
    for (const inv of invoices) {
      // If reprocessAll or invoice is done, we refresh its items
      if (args.reprocessAll || inv.status === "done") {
        // Delete existing items for this invoice
        const existing = await ctx.db
          .query("invoiceItems")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .filter((q) => q.eq(q.field("linkId"), inv._id))
          .collect();
        for (const ex of existing) {
          await ctx.db.delete(ex._id);
          deleted++;
        }

        const items = inv.extracted_data || [];
        for (const it of items) {
          const createdAt = nowMs();
          await ctx.db.insert("invoiceItems", {
            linkId: inv._id,
            userId,
            emission_ts: inv.emission_ts,
            issuer: inv.issuer,
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            total_price: it.total_price,
            numericQuantity: parseBrNumber(it.quantity),
            numericUnitPrice: parseBrNumber(it.unit_price),
            numericTotalPrice: parseBrNumber(it.total_price),
            canonicalProductId: undefined,
            classificationStatus: "UNCLASSIFIED",
            classificationDate: undefined,
            createdAt,
            updatedAt: createdAt,
          });
          inserted++;
        }
      }
    }
    return { inserted, deleted };
  },
});

type MappingRule = {
  pattern: string;
  matchType: "exact" | "contains" | "regex";
  targetProductId: Id<"canonicalProducts">;
  unitSynonyms?: string[];
  active: boolean;
};

function matchRule(name: string, unit: string, rule: MappingRule): boolean {
  const n = safeLower(name);
  const p = safeLower(rule.pattern);
  const u = (unit || "").trim();
  const unitOk = !rule.unitSynonyms || rule.unitSynonyms.includes(u);
  if (!unitOk) return false;
  switch (rule.matchType) {
    case "exact":
      return n === p;
    case "contains":
      return n.includes(p);
    case "regex":
      try {
        const re = new RegExp(rule.pattern, "i");
        return re.test(name);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// Classify unclassified items in batches by applying mapping rules and exact baseName matches
export const classifyItems = mutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const batchSize = Math.max(1, Math.min(500, args.batchSize ?? 200));

    const rules = (await ctx.db
      .query("mappingRules")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect()) as MappingRule[];
    const products = await ctx.db.query("canonicalProducts").collect();

    // Pull unclassified items for this user
    const unclassified = await ctx.db
      .query("invoiceItems")
      .withIndex("by_status", (q) =>
        q.eq("classificationStatus", "UNCLASSIFIED")
      )
      .filter((q) => q.eq(q.field("userId"), userId))
      .take(batchSize);

    let classified = 0;
    let failed = 0;
    for (const item of unclassified) {
      const name = item.name;
      const unit = item.unit;

      // Try mapping rules first
      let matchedProductId: Id<"canonicalProducts"> | undefined = undefined;
      for (const rule of rules) {
        if (!rule.active) continue;
        if (matchRule(name, unit, rule)) {
          matchedProductId = rule.targetProductId;
          break;
        }
      }

      // Fallback: exact match to canonical baseName (case-insensitive), optional unit check
      if (!matchedProductId) {
        const lowerName = safeLower(name);
        for (const p of products) {
          if (safeLower(p.baseName) === lowerName) {
            matchedProductId = p._id;
            break;
          }
        }
      }

      if (matchedProductId) {
        await ctx.db.patch(item._id, {
          canonicalProductId: matchedProductId,
          classificationStatus: "CLASSIFIED",
          classificationDate: nowMs(),
          updatedAt: nowMs(),
        });
        classified++;
      } else {
        await ctx.db.insert("classificationLogs", {
          itemId: item._id,
          reason: "No mapping rule matched",
          snapshot: {
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
          },
          createdAt: nowMs(),
        });
        failed++;
      }
    }

    return { processed: unclassified.length, classified, failed };
  },
});

// Dashboard helpers
export const getUnclassifiedSummary = query({
  args: { month: v.optional(v.number()), year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId)
      return { count: 0, byIssuer: [], commonUnits: [], commonTokens: [] };

    let items = await ctx.db
      .query("invoiceItems")
      .withIndex("by_status", (q) =>
        q.eq("classificationStatus", "UNCLASSIFIED")
      )
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    // Filter by month and year if provided
    if (args.month && args.year) {
      items = items.filter((item) => {
        if (!item.emission_ts) return false;
        const date = new Date(item.emission_ts);
        return date.getMonth() + 1 === args.month && date.getFullYear() === args.year;
      });
    }

    const byIssuerMap: Record<string, number> = {};
    const unitMap: Record<string, number> = {};
    const tokenMap: Record<string, number> = {};
    for (const it of items) {
      const issuer = (it.issuer || "").trim() || "Unknown";
      byIssuerMap[issuer] = (byIssuerMap[issuer] || 0) + 1;
      const unit = (it.unit || "").trim() || "?";
      unitMap[unit] = (unitMap[unit] || 0) + 1;
      const tokens = safeLower(it.name).split(/\s+/).filter(Boolean);
      for (const t of tokens) tokenMap[t] = (tokenMap[t] || 0) + 1;
    }

    const byIssuer = Object.entries(byIssuerMap)
      .map(([issuer, count]) => ({ issuer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    const commonUnits = Object.entries(unitMap)
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    const commonTokens = Object.entries(tokenMap)
      .map(([token, count]) => ({ token, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    return { count: items.length, byIssuer, commonUnits, commonTokens };
  },
});
