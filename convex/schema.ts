import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  nfce_links: defineTable({
    url: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    last_run: v.optional(v.number()),
    // New fields for invoice issue date (Emissão)
    emission_ts: v.optional(v.number()), // Unix epoch ms
    emission_str: v.optional(v.string()), // Raw string as found on page
    // Calculated total invoice amount
    total_amount: v.optional(v.number()), // Sum of item totals in BRL
    total_amount_str: v.optional(v.string()), // Formatted string, e.g., "R$ 1.234,56"
    issuer: v.optional(v.string()), // Invoice issuer / store name
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
    userId: v.id("users"),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Canonical product registry for standardized item classification
  canonicalProducts: defineTable({
    baseName: v.string(), // e.g., "Eggs", "Ground Beef"
    unit: v.string(), // KG, LT, UND, UN, CX30
    unitDetail: v.optional(v.string()), // e.g., "Box of 30", "500g tray"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_base_unit", ["baseName", "unit"]),

  // Mapping rules used to classify raw item descriptions into canonical products
  mappingRules: defineTable({
    pattern: v.string(), // rule pattern (token, phrase, or regex)
    matchType: v.union(
      v.literal("exact"),
      v.literal("contains"),
      v.literal("regex")
    ),
    targetProductId: v.id("canonicalProducts"),
    unitSynonyms: v.optional(v.array(v.string())), // e.g., ["L", "Liter"]
    active: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_product", ["targetProductId"])
    .index("by_active", ["active"]),

  // Flattened view of invoice items for classification and price analytics
  invoiceItems: defineTable({
    linkId: v.id("nfce_links"),
    userId: v.id("users"),
    emission_ts: v.optional(v.number()),
    issuer: v.optional(v.string()),

    // Raw scraped fields (kept for traceability)
    name: v.string(),
    quantity: v.string(),
    unit: v.string(),
    unit_price: v.string(),
    total_price: v.string(),

    // Parsed numeric fields (no unit normalization performed)
    numericQuantity: v.optional(v.number()),
    numericUnitPrice: v.optional(v.number()),
    numericTotalPrice: v.optional(v.number()),

    // Classification metadata
    canonicalProductId: v.optional(v.id("canonicalProducts")),
    classificationStatus: v.union(
      v.literal("CLASSIFIED"),
      v.literal("UNCLASSIFIED")
    ),
    classificationDate: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_product", ["canonicalProductId"])
    .index("by_unit", ["unit"])
    .index("by_issuer", ["issuer"])
    .index("by_emission_ts", ["emission_ts"]) 
    .index("by_status", ["classificationStatus"]),

  // Logs for classification attempts that failed, to aid manual rule creation
  classificationLogs: defineTable({
    itemId: v.id("invoiceItems"),
    reason: v.string(), // e.g., "No mapping rule matched"
    snapshot: v.object({
      name: v.string(),
      unit: v.string(),
      quantity: v.string(),
    }),
    createdAt: v.number(),
  }).index("by_item", ["itemId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
