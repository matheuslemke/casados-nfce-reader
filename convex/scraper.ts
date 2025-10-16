"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import axios from "axios";
import * as cheerio from "cheerio";

export const runCrawler = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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

export const scrapeOne = internalAction({
  args: {
    invoiceId: v.id("nfce_links"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.runQuery(internal.nfceInternal.getInvoiceByIdInternal, {
      invoiceId: args.invoiceId,
    });

    if (!invoice) {
      return null;
    }

    await ctx.runMutation(internal.nfce.updateInvoiceStatus, {
      invoiceId: args.invoiceId,
      status: "processing",
    });

    try {
      const response = await axios.get(invoice.url, {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      const items: Array<{
        name: string;
        quantity: string;
        unit: string;
        unit_price: string;
        total_price: string;
      }> = [];

      $("table").each((_, table) => {
        $(table)
          .find("tr")
          .each((_, row) => {
            const cells = $(row).find("td");
            if (cells.length >= 5) {
              const name = $(cells[0]).text().trim();
              const quantity = $(cells[1]).text().trim();
              const unit = $(cells[2]).text().trim();
              const unit_price = $(cells[3]).text().trim();
              const total_price = $(cells[4]).text().trim();

              if (name && quantity && unit_price) {
                items.push({
                  name,
                  quantity,
                  unit,
                  unit_price,
                  total_price,
                });
              }
            }
          });
      });

      if (items.length === 0) {
        await ctx.runMutation(internal.nfce.updateInvoiceStatus, {
          invoiceId: args.invoiceId,
          status: "error",
          error_message: "No items found in the invoice",
        });
      } else {
        await ctx.runMutation(internal.nfce.updateInvoiceStatus, {
          invoiceId: args.invoiceId,
          status: "done",
          extracted_data: items,
        });
      }

      return items;
    } catch (error: any) {
      await ctx.runMutation(internal.nfce.updateInvoiceStatus, {
        invoiceId: args.invoiceId,
        status: "error",
        error_message: error.message || "Unknown error occurred",
      });
      return null;
    }
  },
});
