/**
 * Merlin Intake V5 — Static Data Model
 *
 * Verified cell mapping (Daily Status / COA SIT):
 *   A1  → sitPct           (sheet title / headline text from A1)
 *   B2  → executionPct     (Execution %)
 *   B3  → passPct          (Pass %)
 *   H1  → execPerformance  (Execution Performance numeric)
 *   H2  → passPerformance  (Pass Performance numeric)
 *   A7  → header row (Total# TC Assigned / Pass / Fail / …)
 *   A8  → totalTc          (Total# TC Assigned)
 *   B8  → pass             (Passed)
 *   C8  → fail             (Failed)
 *   D8  → inProgress       (In Progress)
 *   E8  → blocked          (Blocked)
 *   F8  → notExecuted      (Not executed)
 *   G8  → descoped         (Descoped)
 *   H8  → na               (NA)
 *   A10 → Notes header
 *   A11 → notes            (Latest update / notes content)
 *   A13 → testExecutionLink
 *   A15 → defectDashboardLink
 *   A17 → evidencesLink
 *
 * Defects1 sheet (header row 1, data rows 2+):
 *   A → defectId           B → summary           C → assignee
 *   D → reporter           E → priority          F → severityRationale
 *   G → affectedOpco       H → status            I → defectCreatedDate
 *   J → expectedFixDate    K → aging             L → comments
 */

export interface MerlinStatusSheet {
  /** A1 — sheet title / headline (e.g. "Merlin Intake V5 SIT Percentage") */
  sitPct: string;
  /** B2 — Execution % (raw string, may be "100", "67", etc.) */
  executionPct: string;
  /** B3 — Pass % */
  passPct: string;
  /** H1 — Execution Performance */
  execPerformance: string;
  /** H2 — Pass Performance */
  passPerformance: string;
  /** A8 — Total# TC Assigned */
  totalTc: string;
  /** B8 — Passed count */
  pass: string;
  /** C8 — Failed count */
  fail: string;
  /** D8 — In Progress count */
  inProgress: string;
  /** E8 — Blocked count */
  blocked: string;
  /** F8 — Not Executed count */
  notExecuted: string;
  /** G8 — Descoped count */
  descoped: string;
  /** H8 — NA count */
  na: string;
  /** A11 — Notes / Latest update content (fallback "N/A" if empty) */
  notes: string;
  /** A13 — Test Execution URL */
  testExecutionLink: string;
  /** A15 — Defect Dashboard URL */
  defectDashboardLink: string;
  /** A17 — Evidence Repository URL */
  evidencesLink: string;
}

export interface MerlinDefect {
  defectId: string;           // col A
  summary: string;            // col B
  assignee: string;           // col C
  reporter: string;           // col D
  priority: string;           // col E
  severityRationale: string;  // col F
  affectedOpco: string;       // col G
  status: string;             // col H
  defectCreatedDate: string;  // col I
  expectedFixDate: string;    // col J
  aging: string;              // col K  (string — may be "31 Days", "TBD", etc.)
  comments: string;           // col L
}

export interface MerlinWorkbook {
  fileName: string;
  importedAt: string;
  sheetNames: string[];
  dailyStatus: MerlinStatusSheet | null;
  coaSit: MerlinStatusSheet | null;
  defects: MerlinDefect[];
}

// ─── Empty sentinel ───────────────────────────────────────────────────────────
const EMPTY_STATUS: MerlinStatusSheet = {
  sitPct: "", executionPct: "", passPct: "",
  execPerformance: "", passPerformance: "",
  totalTc: "", pass: "", fail: "", inProgress: "", blocked: "",
  notExecuted: "", descoped: "", na: "",
  notes: "",
  testExecutionLink: "", defectDashboardLink: "", evidencesLink: "",
};

export const MERLIN_EMPTY: MerlinWorkbook = {
  fileName: "", importedAt: "", sheetNames: [],
  dailyStatus: null, coaSit: null, defects: [],
};

// ─── Open-defect status set (shared across dashboard + command center) ────────
export const OPEN_DEFECT_STATUSES = new Set([
  "To Do", "In Progress", "Open", "Reopened",
]);

/** Returns true when a defect status indicates the defect is still open/active */
export function isOpenMerlinDefect(status: string): boolean {
  if (!status) return false;
  const sl = status.toLowerCase().trim();
  if (sl === "done" || sl === "closed" || sl === "resolved" || sl === "won't fix" || sl === "wont fix") return false;
  return OPEN_DEFECT_STATUSES.has(status) || (!sl.includes("done") && !sl.includes("closed") && !sl.includes("resolved"));
}

export { EMPTY_STATUS };
