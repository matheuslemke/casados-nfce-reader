"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const runCrawlerInternal = internalAction({
  args: {},
  handler: async (ctx) => {
    const pending: Array<{ _id: any; url: string; status: string; userId: any }> = await ctx.runQuery(internal.nfceInternal.listAllPendingInternal, {});
    
    if (pending.length === 0) {
      return { message: "No pending invoices to process", count: 0 };
    }

    for (const invoice of pending) {
      await ctx.scheduler.runAfter(0, internal.scraper.scrapeOne, {
        invoiceId: invoice._id,
      });
    }

    return { message: `Started processing ${pending.length} invoices`, count: pending.length };
  },
});
