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

      // Helper to clean numeric strings by removing labels and non-numeric symbols
      const cleanNumeric = (s: string): string => {
        let t = s.replace(/\u00A0/g, " ") // NBSP to space
          .replace(/R\$\s*/gi, "") // remove currency symbol
          .trim();

        // Prefer Brazilian format: 1.234,56 or 0,42 (optionally with leading minus)
        const brMatches = t.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g);
        if (brMatches && brMatches.length) {
          return brMatches[brMatches.length - 1];
        }

        // Fallback: generic digits with optional decimal separator
        const genericMatches = t.match(/-?\d+(?:[.,]\d+)?/g);
        if (genericMatches && genericMatches.length) {
          return genericMatches[genericMatches.length - 1];
        }

        // Last resort: strip non-numeric, then trim leading/trailing punctuation
        t = t
          .replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, "")
          .replace(/[^0-9,.-]+/g, "")
          .trim()
          .replace(/^[.,]+/, "")
          .replace(/[.,]+$/, "");
        return t;
      };

      // Helper to clean unit labels like "UN: UN" -> "UN"
      const cleanUnit = (s: string): string => {
        const t = s.replace(/\u00A0/g, " ").trim();
        return t.replace(/^[^:]*:\s*/, "").trim();
      };

      // Parse a Brazilian-formatted number string (e.g., "1.234,56") to a JS number
      const parseBrNumber = (s: string): number => {
        const nstr = cleanNumeric(s);
        if (!nstr) return 0;
        // Remove thousands separators and replace comma with dot
        const normalized = nstr.replace(/\./g, "").replace(/,/g, ".");
        const n = parseFloat(normalized);
        return isNaN(n) ? 0 : n;
      };

      // Format a JS number as Brazilian currency string (e.g., "R$ 1.234,56")
      const formatBrCurrency = (n: number): string => {
        const fixed = (Math.round(n * 100) / 100).toFixed(2); // ensure two decimals
        const [intPart, decPart] = fixed.split(".");
        const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return `R$ ${intFmt},${decPart}`;
      };

      // Helper to parse Brazilian datetime strings like "02/10/2025 20:42:38"
      const parseBrDateTime = (s: string): number | null => {
        const m = s
          .replace(/\u00A0/g, " ") // non-breaking space to normal space
          .trim()
          .match(/(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
        if (!m) return null;
        const dd = parseInt(m[1], 10);
        const MM = parseInt(m[2], 10);
        const yyyy = parseInt(m[3], 10);
        const hh = m[4] ? parseInt(m[4], 10) : 0;
        const mm = m[5] ? parseInt(m[5], 10) : 0;
        const ss = m[6] ? parseInt(m[6], 10) : 0;
        const date = new Date(yyyy, MM - 1, dd, hh, mm, ss);
        return isNaN(date.getTime()) ? null : date.getTime();
      };

      // Try to locate the Emissão value near its label; fallback to page text scan
      let emissionStr: string | null = null;
      let emissionTs: number | null = null;
      // Look for elements containing the label 'Emissão'
      const labelCandidates = $("body :contains('Emissão'), body :contains('Emissao')");
      labelCandidates.each((_, el) => {
        const txt = $(el).text();
        const m = txt.match(/Emiss[ãa]o\s*:?\s*(.*)/i);
        if (m && m[1]) {
          const candidate = m[1].trim();
          const ts = parseBrDateTime(candidate);
          if (ts) {
            emissionStr = candidate;
            emissionTs = ts;
            return false; // break out of .each
          }
        }
      });
      if (!emissionTs) {
        const allText = $("body").text();
        const m = allText.match(/Emiss[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)/i);
        if (m && m[1]) {
          emissionStr = m[1].trim();
          emissionTs = parseBrDateTime(emissionStr);
        }
      }
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
            const quantityRaw = $(row).find('.Rqtd').text().trim();
            const unitRaw = $(row).find('.RUN').text().trim();
            const unit = cleanUnit(unitRaw);
            const unitPriceRaw = $(row).find('.RvlUnit').text().trim();
            const total_price = $(row).find('.valor').text().trim();
            const quantity = cleanNumeric(quantityRaw);
            const unit_price = cleanNumeric(unitPriceRaw);

            // Fallbacks if some fields are inside td text without spans
            const fallbackCells = $(row).find('td');
            const fallbackName = name || fallbackCells.eq(0).text().trim();
            const fallbackQuantity = quantity || cleanNumeric(fallbackCells.eq(1).text().trim());
            const fallbackUnit = unit || cleanUnit(fallbackCells.eq(2).text().trim());
            const fallbackUnitPrice = unit_price || cleanNumeric(fallbackCells.eq(3).text().trim());
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
              const quantity = cleanNumeric($(cells[1]).find('.Rqtd').text().trim() || $(cells[1]).text().trim());
              const unit = cleanUnit($(cells[2]).find('.RUN').text().trim() || $(cells[2]).text().trim());
              const unit_price = cleanNumeric($(cells[3]).find('.RvlUnit').text().trim() || $(cells[3]).text().trim());
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
                const quantity = cleanNumeric($(cells[1]).text().trim());
                const unit = cleanUnit($(cells[2]).text().trim());
                const unit_price = cleanNumeric($(cells[3]).text().trim());
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
          emission_ts: emissionTs ?? undefined,
          emission_str: emissionStr ?? undefined,
          error_message: hasTabResult
            ? `No items parsed from #tabResult (rows=${rowCount}). ${hint} Check dynamic JS/AJAX or differing column layout.`
            : "Items table '#tabResult' not found on page.",
        });
      } else {
        // Calculate total invoice amount by summing item total_price
        const totalAmount = items.reduce((acc, it) => acc + parseBrNumber(it.total_price), 0);
        const totalAmountStr = formatBrCurrency(totalAmount);

        await ctx.runMutation(internal.nfce.updateInvoiceStatus, {
          invoiceId: args.invoiceId,
          status: "done",
          emission_ts: emissionTs ?? undefined,
          emission_str: emissionStr ?? undefined,
          total_amount: totalAmount,
          total_amount_str: totalAmountStr,
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
