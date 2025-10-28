import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id, Doc } from "./_generated/dataModel";

// Define the return type for invoice items with details
export type InvoiceItemWithDetails = {
  _id: Id<"invoiceItems">;
  // Invoice item details from schema
  name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  total_price: string;
  numericQuantity?: number;
  numericUnitPrice?: number;
  numericTotalPrice?: number;
  canonicalProductId?: Id<"canonicalProducts">;
  classificationStatus: "CLASSIFIED" | "UNCLASSIFIED";
  classificationDate?: number;
  createdAt: number;
  updatedAt: number;
  
  // Invoice details from nfce_links
  invoiceId: Id<"nfce_links">;
  invoiceDate?: number;
  invoiceDateStr?: string;
  invoiceIssuer?: string;
  invoiceTotalAmount?: number;
  invoiceTotalAmountStr?: string;
  invoiceUrl?: string;
  
  // Canonical product details (properly typed from schema)
  canonicalProduct?: {
    _id: Id<"canonicalProducts">;
    baseName: string;
    unit: string;
    unitDetail?: string;
    createdAt: number;
    updatedAt: number;
  } | null;
};

export const listInvoiceItemsWithDetails = query({
  args: {
    month: v.optional(v.number()), // 1-12 for filtering by month
    year: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<InvoiceItemWithDetails[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get all invoice items for the user
    const invoiceItems = await ctx.db
      .query("invoiceItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by month/year if provided
    let filteredItems = invoiceItems;
    if (args.month !== undefined && args.year !== undefined) {
      filteredItems = invoiceItems.filter((item) => {
        if (!item.emission_ts) return false;
        const date = new Date(item.emission_ts);
        return (
          date.getMonth() + 1 === args.month && date.getFullYear() === args.year
        );
      });
    }

    // Get all unique link IDs to fetch invoice data
    const linkIds = [...new Set(filteredItems.map((item) => item.linkId))];

    // Fetch invoice data for all items
    const invoicesMap = new Map<Id<"nfce_links">, Doc<"nfce_links">>();
    for (const linkId of linkIds) {
      const invoice = await ctx.db.get(linkId);
      if (invoice) {
        invoicesMap.set(linkId, invoice);
      }
    }

    // Get all canonical products to create a lookup map
    const canonicalProducts = await ctx.db.query("canonicalProducts").collect();

    const canonicalProductsMap = new Map<Id<"canonicalProducts">, Doc<"canonicalProducts">>();
    canonicalProducts.forEach((product) => {
      canonicalProductsMap.set(product._id, product);
    });

    // Combine all data with proper typing
    const itemsWithDetails: InvoiceItemWithDetails[] = filteredItems.map((item) => {
      const invoice = invoicesMap.get(item.linkId);
      const canonicalProduct = item.canonicalProductId
        ? canonicalProductsMap.get(item.canonicalProductId)
        : null;

      return {
        _id: item._id,
        // Invoice item details (all from schema)
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        numericQuantity: item.numericQuantity,
        numericUnitPrice: item.numericUnitPrice,
        numericTotalPrice: item.numericTotalPrice,
        canonicalProductId: item.canonicalProductId,
        classificationStatus: item.classificationStatus,
        classificationDate: item.classificationDate,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,

        // Invoice details
        invoiceId: item.linkId,
        invoiceDate: invoice?.emission_ts,
        invoiceDateStr: invoice?.emission_str,
        invoiceIssuer: invoice?.issuer || item.issuer,
        invoiceTotalAmount: invoice?.total_amount,
        invoiceTotalAmountStr: invoice?.total_amount_str,
        invoiceUrl: invoice?.url,

        // Canonical product details (properly typed from schema)
        canonicalProduct: canonicalProduct
          ? {
              _id: canonicalProduct._id,
              baseName: canonicalProduct.baseName,
              unit: canonicalProduct.unit,
              unitDetail: canonicalProduct.unitDetail,
              createdAt: canonicalProduct.createdAt,
              updatedAt: canonicalProduct.updatedAt,
            }
          : null,
      };
    });

    // Sort by invoice date (newest first)
    itemsWithDetails.sort((a, b) => {
      const dateA = a.invoiceDate || 0;
      const dateB = b.invoiceDate || 0;
      return dateB - dateA;
    });

    return itemsWithDetails;
  },
});

export const updateItemCanonicalProduct = mutation({
  args: {
    itemId: v.id("invoiceItems"),
    canonicalProductId: v.optional(v.id("canonicalProducts")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the item to verify ownership
    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found or access denied");
    }

    // If canonicalProductId is provided, verify it exists
    if (args.canonicalProductId) {
      const canonicalProduct = await ctx.db.get(args.canonicalProductId);
      if (!canonicalProduct) {
        throw new Error("Canonical product not found");
      }
    }

    // Update the item
    await ctx.db.patch(args.itemId, {
      canonicalProductId: args.canonicalProductId,
    });

    return { success: true };
  },
});
