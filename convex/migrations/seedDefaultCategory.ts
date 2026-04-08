import { internalMutation } from "../_generated/server";

/**
 * One-time migration: creates a "Mercado" category (isDefault: true) for every
 * user that has invoices but no categories yet, then assigns all their existing
 * nfce_links to that category.
 *
 * Run with:
 *   npx convex run migrations/seedDefaultCategory:run
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Collect all distinct userIds from nfce_links
    const allInvoices = await ctx.db.query("nfce_links").collect();
    const userIds = [...new Set(allInvoices.map((inv) => inv.userId))];

    let categoriesCreated = 0;
    let invoicesUpdated = 0;

    for (const userId of userIds) {
      // 2. Check if this user already has any categories
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      if (existing) continue; // Already seeded — skip

      // 3. Create "Mercado" as the default category
      const categoryId = await ctx.db.insert("categories", {
        name: "Mercado",
        isDefault: true,
        userId,
        createdAt: Date.now(),
      });
      categoriesCreated++;

      // 4. Assign all invoices for this user to the new category
      const invoices = allInvoices.filter((inv) => inv.userId === userId);
      for (const inv of invoices) {
        await ctx.db.patch(inv._id, { categoryId });
        invoicesUpdated++;
      }
    }

    return { categoriesCreated, invoicesUpdated };
  },
});
