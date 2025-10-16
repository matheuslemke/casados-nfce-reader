import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run crawler every day at 2 AM
crons.interval(
  "process pending invoices",
  { hours: 24 },
  internal.scraperInternal.runCrawlerInternal,
  {}
);

export default crons;
