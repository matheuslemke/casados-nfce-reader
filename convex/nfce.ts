import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const addInvoiceLink = mutation({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate URL format
    if (!args.url.includes("nfce") && !args.url.includes("sefaz")) {
      throw new Error("Invalid NFC-e URL format");
    }

    const invoiceId = await ctx.db.insert("nfce_links", {
      url: args.url,
      status: "pending",
      userId,
    });

    return invoiceId;
  },
});

export const listInvoices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const invoices = await ctx.db
      .query("nfce_links")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return invoices;
  },
});

export const getInvoiceById = query({
  args: {
    invoiceId: v.id("nfce_links"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== userId) {
      throw new Error("Invoice not found");
    }

    return invoice;
  },
});

export const deleteInvoice = mutation({
  args: {
    invoiceId: v.id("nfce_links"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== userId) {
      throw new Error("Invoice not found");
    }

    await ctx.db.delete(args.invoiceId);
    return null;
  },
});

export const updateInvoiceStatus = internalMutation({
  args: {
    invoiceId: v.id("nfce_links"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    emission_ts: v.optional(v.number()),
    emission_str: v.optional(v.string()),
    total_amount: v.optional(v.number()),
    total_amount_str: v.optional(v.string()),
    issuer: v.optional(v.string()),
    extracted_data: v.optional(
      v.array(
        v.object({
          name: v.string(),
          quantity: v.string(),
          unit: v.string(),
          unit_price: v.string(),
          total_price: v.string(),
        })
      )
    ),
    error_message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      status: args.status,
      last_run: Date.now(),
      emission_ts: args.emission_ts,
      emission_str: args.emission_str,
      total_amount: args.total_amount,
      total_amount_str: args.total_amount_str,
      issuer: args.issuer,
      extracted_data: args.extracted_data,
      error_message: args.error_message,
    });
    return null;
  },
});

export const getPendingInvoices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const pending = await ctx.db
      .query("nfce_links")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return pending.filter((invoice) => invoice.userId === userId);
  },
});
