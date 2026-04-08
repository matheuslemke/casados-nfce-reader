import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const addInvoiceLink = mutation({
  args: {
    url: v.string(),
    categoryId: v.optional(v.id("categories")),
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
      categoryId: args.categoryId,
    });

    return invoiceId;
  },
});

export const addInvoiceLinksBulk = mutation({
  args: {
    urls: v.array(v.string()),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const seen = new Set<string>();
    const results: Array<
      | { url: string; ok: true; id: import("./_generated/dataModel").Id<"nfce_links"> }
      | { url: string; ok: false; error: string }
    > = [];

    for (const raw of args.urls) {
      const url = (raw || "").trim();
      if (!url) {
        results.push({ url, ok: false, error: "Empty URL" });
        continue;
      }
      if (seen.has(url)) {
        results.push({ url, ok: false, error: "Duplicate URL in batch" });
        continue;
      }
      seen.add(url);

      if (!url.includes("nfce") && !url.includes("sefaz")) {
        results.push({ url, ok: false, error: "Invalid NFC-e URL format" });
        continue;
      }

      const id = await ctx.db.insert("nfce_links", {
        url,
        status: "pending",
        userId,
        categoryId: args.categoryId,
      });
      results.push({ url, ok: true, id });
    }

    const successCount = results.filter((r) => r.ok).length;
    const errorCount = results.length - successCount;

    return { successCount, errorCount, results };
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

    // First, get all invoice items for this invoice
    const invoiceItems = await ctx.db
      .query("invoiceItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("linkId"), args.invoiceId))
      .collect();

    // Delete classification logs for each invoice item
    for (const item of invoiceItems) {
      const classificationLogs = await ctx.db
        .query("classificationLogs")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect();
      
      for (const log of classificationLogs) {
        await ctx.db.delete(log._id);
      }
    }

    // Delete all invoice items for this invoice
    for (const item of invoiceItems) {
      await ctx.db.delete(item._id);
    }

    // Finally, delete the invoice itself
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
    discount: v.optional(v.number()),
    discount_str: v.optional(v.string()),
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
      discount: args.discount,
      discount_str: args.discount_str,
      issuer: args.issuer,
      extracted_data: args.extracted_data,
      error_message: args.error_message,
    });
    return null;
  },
});

export const setMonthOverride = mutation({
  args: {
    invoiceId: v.id("nfce_links"),
    override_month: v.optional(v.number()),
    override_year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== userId) {
      throw new Error("Invoice not found");
    }

    const hasMonth = args.override_month !== undefined;
    const hasYear = args.override_year !== undefined;
    if (hasMonth !== hasYear) {
      throw new Error("override_month and override_year must be set together");
    }
    if (hasMonth && (args.override_month! < 1 || args.override_month! > 12)) {
      throw new Error("override_month must be between 1 and 12");
    }

    await ctx.db.patch(args.invoiceId, {
      override_month: args.override_month,
      override_year: args.override_year,
    });

    // Propagate to all existing invoiceItems for this invoice
    const items = await ctx.db
      .query("invoiceItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("linkId"), args.invoiceId))
      .collect();

    for (const item of items) {
      await ctx.db.patch(item._id, {
        override_month: args.override_month,
        override_year: args.override_year,
      });
    }

    return { updated: items.length };
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
