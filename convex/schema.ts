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
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
