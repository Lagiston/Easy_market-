import { readFileSync } from "node:fs";
import path from "node:path";

// Static support-policy doc, distinct from the DB-backed KbArticle/FTS system
// (kb-search.ts) that powers the normal agent-reviewed draft flow — this
// feeds only the auto-resolve judgment folded into classifyInquiry's single
// classification call (see inquiry-classification.ts). Read once at module
// load (deploy-time content; a change requires a server restart) and
// resolved via import.meta.dir rather than process.cwd() so it works
// regardless of which directory the server is started from.
export const KNOWLEDGE_BASE = readFileSync(
  path.join(import.meta.dir, "..", "..", "knowledge-base.md"),
  "utf-8",
);
