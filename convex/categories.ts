import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getDefaultCategory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const all = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return all.find((c) => c.isDefault) ?? null;
  },
});

export const createCategory = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const isFirst = existing.length === 0;

    return ctx.db.insert("categories", {
      name: args.name.trim(),
      isDefault: isFirst,
      userId,
      createdAt: Date.now(),
    });
  },
});

export const setDefault = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const all = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const cat of all) {
      await ctx.db.patch(cat._id, { isDefault: cat._id === args.id });
    }
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const cat = await ctx.db.get(args.id);
    if (!cat || cat.userId !== userId) throw new Error("Category not found");

    await ctx.db.delete(args.id);
  },
});
