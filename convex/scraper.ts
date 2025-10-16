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

      // Prefer the known NFC-e items table by id
      const itemsTable = $("#tabResult");
      if (itemsTable.length > 0) {
        // Target item rows with id starting with "Item" (e.g., Item1, Item2)
        const itemRows = itemsTable.find('tr[id^="Item"]');

        if (itemRows.length > 0) {
          itemRows.each((_, row) => {
            // Extract nested spans with specific classes
            const name = $(row).find('.txtTit2').text().trim();
            // const code = $(row).find('.RCod').text().trim(); // parsed but not stored
            const quantity = $(row).find('.Rqtd').text().trim();
            const unit = $(row).find('.RUN').text().trim();
            const unit_price = $(row).find('.RvlUnit').text().trim();
            const total_price = $(row).find('.valor').text().trim();

            // Fallbacks if some fields are inside td text without spans
            const fallbackCells = $(row).find('td');
            const fallbackName = name || fallbackCells.eq(0).text().trim();
            const fallbackQuantity = quantity || fallbackCells.eq(1).text().trim();
            const fallbackUnit = unit || fallbackCells.eq(2).text().trim();
            const fallbackUnitPrice = unit_price || fallbackCells.eq(3).text().trim();
            const fallbackTotalPrice = total_price || fallbackCells.eq(4).text().trim();

            if (fallbackName && fallbackQuantity && fallbackUnitPrice) {
              items.push({
                name: fallbackName,
                quantity: fallbackQuantity,
                unit: fallbackUnit,
                unit_price: fallbackUnitPrice,
                total_price: fallbackTotalPrice,
              });
            }
          });
        } else {
          // Some pages may render under <tbody> without ids; fall back to tbody/tr
          const rows = itemsTable.find('tbody tr').length
            ? itemsTable.find('tbody tr')
            : itemsTable.find('tr');
          rows.each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 5) {
              const name = $(cells[0]).find('.txtTit2').text().trim() || $(cells[0]).text().trim();
              const quantity = $(cells[1]).find('.Rqtd').text().trim() || $(cells[1]).text().trim();
              const unit = $(cells[2]).find('.RUN').text().trim() || $(cells[2]).text().trim();
              const unit_price = $(cells[3]).find('.RvlUnit').text().trim() || $(cells[3]).text().trim();
              const total_price = $(cells[4]).find('.valor').text().trim() || $(cells[4]).text().trim();

              if (name && quantity && unit_price) {
                items.push({ name, quantity, unit, unit_price, total_price });
              }
            }
          });
        }
      } else {
        // Fallback: scan all tables if #tabResult is not found
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
                  items.push({ name, quantity, unit, unit_price, total_price });
                }
              }
            });
        });
      }

      if (items.length === 0) {
        const hasTabResult = itemsTable.length > 0;
        const itemRowsCount = hasTabResult ? itemsTable.find('tr[id^="Item"]').length : 0;
        const fallbackRowsCount = hasTabResult ? (itemsTable.find('tbody tr').length || itemsTable.find('tr').length) : 0;
        const rowCount = Math.max(itemRowsCount, fallbackRowsCount);
        const hint = hasTabResult && itemRowsCount > 0
          ? 'Found Item rows but spans (.txtTit2, .Rqtd, .RUN, .RvlUnit, .valor) were missing or empty.'
          : 'Rows present but not matching expected structure.';
        await ctx.runMutation(internal.nfce.updateInvoiceStatus, {
          invoiceId: args.invoiceId,
          status: "error",
          error_message: hasTabResult
            ? `No items parsed from #tabResult (rows=${rowCount}). ${hint} Check dynamic JS/AJAX or differing column layout.`
            : "Items table '#tabResult' not found on page.",
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
