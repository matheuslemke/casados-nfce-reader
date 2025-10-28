import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";

const crons = cronJobs();

// Run crawler every day at 2 AM
crons.interval(
  "process pending invoices",
  { hours: 24 },
  internal.scraperInternal.runCrawlerInternal,
  {}
);

// Run item sync and classification every 6 hours
crons.interval(
  "sync and classify invoice items",
  { hours: 6 },
  api.classify.syncInvoiceItemsFromInvoices,
  { reprocessAll: false }
);
crons.interval(
  "classify unclassified items",
  { hours: 6 },
  api.classify.classifyItems,
  { batchSize: 500 }
);

export default crons;
