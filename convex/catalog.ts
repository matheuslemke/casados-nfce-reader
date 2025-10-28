import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { nowMs } from "./lib/parse";

// Canonical Products CRUD
export const createCanonicalProduct = mutation({
  args: {
    baseName: v.string(),
    unit: v.string(),
    unitDetail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const createdAt = nowMs();
    const baseName = args.baseName.trim();
    const existing = await ctx.db
      .query("canonicalProducts")
      .withIndex("by_base_unit", (q) =>
        q.eq("baseName", baseName).eq("unit", args.unit)
      )
      .collect();
    if (existing.length > 0) {
      throw new Error(
        "Canonical product with same baseName and unit already exists"
      );
    }
    const id = await ctx.db.insert("canonicalProducts", {
      baseName,
      unit: args.unit,
      unitDetail: args.unitDetail?.trim(),
      createdAt,
      updatedAt: createdAt,
    });
    return id;
  },
});

export const updateCanonicalProduct = mutation({
  args: {
    productId: v.id("canonicalProducts"),
    baseName: v.optional(v.string()),
    unit: v.optional(
      v.union(
        v.literal("KG"),
        v.literal("UNIT"),
        v.literal("BOX"),
        v.literal("PACK")
      )
    ),
    unitDetail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const patch: Partial<{
      baseName: string;
      unit: string;
      unitDetail: string;
      updatedAt: number;
    }> = { updatedAt: nowMs() };
    if (args.baseName !== undefined) patch.baseName = args.baseName.trim();
    if (args.unit !== undefined) patch.unit = args.unit;
    if (args.unitDetail !== undefined)
      patch.unitDetail = args.unitDetail?.trim();
    await ctx.db.patch(args.productId, patch);
    return null;
  },
});

export const listCanonicalProducts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const products = await ctx.db
      .query("canonicalProducts")
      .order("asc")
      .collect();
    return products;
  },
});

// Mapping Rules CRUD
export const addMappingRule = mutation({
  args: {
    pattern: v.string(),
    matchType: v.union(
      v.literal("exact"),
      v.literal("contains"),
      v.literal("regex")
    ),
    targetProductId: v.id("canonicalProducts"),
    unitSynonyms: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const createdAt = nowMs();
    const id = await ctx.db.insert("mappingRules", {
      pattern: args.pattern.trim(),
      matchType: args.matchType,
      targetProductId: args.targetProductId,
      unitSynonyms: args.unitSynonyms?.map((u) => u.trim()),
      active: true,
      notes: args.notes?.trim(),
      createdAt,
      updatedAt: createdAt,
    });
    return id;
  },
});

export const updateMappingRule = mutation({
  args: {
    ruleId: v.id("mappingRules"),
    pattern: v.optional(v.string()),
    matchType: v.optional(
      v.union(v.literal("exact"), v.literal("contains"), v.literal("regex"))
    ),
    targetProductId: v.optional(v.id("canonicalProducts")),
    unitSynonyms: v.optional(v.array(v.string())),
    active: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const patch: Partial<{
      pattern: string;
      matchType: "exact" | "contains" | "regex";
      targetProductId: import("./_generated/dataModel").Id<"canonicalProducts">;
      unitSynonyms: string[];
      active: boolean;
      notes: string;
      updatedAt: number;
    }> = { updatedAt: nowMs() };
    if (args.pattern !== undefined) patch.pattern = args.pattern.trim();
    if (args.matchType !== undefined) patch.matchType = args.matchType;
    if (args.targetProductId !== undefined)
      patch.targetProductId = args.targetProductId;
    if (args.unitSynonyms !== undefined)
      patch.unitSynonyms = args.unitSynonyms.map((u) => u.trim());
    if (args.active !== undefined) patch.active = args.active;
    if (args.notes !== undefined) patch.notes = args.notes?.trim();
    await ctx.db.patch(args.ruleId, patch);
    return null;
  },
});

export const deleteMappingRule = mutation({
  args: { ruleId: v.id("mappingRules") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ctx.db.delete(args.ruleId);
    return null;
  },
});

export const listMappingRules = query({
  args: { onlyActive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const q = ctx.db.query("mappingRules").order("asc");
    const rules = await q.collect();
    return args.onlyActive ? rules.filter((r) => r.active) : rules;
  },
});
