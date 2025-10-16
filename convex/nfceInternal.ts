import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getInvoiceByIdInternal = internalQuery({
  args: {
    invoiceId: v.id("nfce_links"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    return invoice;
  },
});

export const listAllPendingInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("nfce_links")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending;
  },
});
