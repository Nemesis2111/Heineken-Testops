/**
 * parseMerlinWorkbook
 * ─────────────────────────────────────────────────────────────
 * Parses the Merlin Intake V5 Excel workbook using STATIC cell-coordinate
 * mapping. No fuzzy header search. No header auto-detection for Merlin.
 * Every field maps to an exact, fixed cell address.
 *
 * Required sheets (exact names):
 *   "Daily Status", "COA SIT", "Defects1"
 *
 * Static cell mapping — Daily Status / COA SIT:
 *   A1  (row 0, col 0) → sitPct            (sheet headline)
 *   B2  (row 1, col 1) → executionPct
 *   B3  (row 2, col 1) → passPct
 *   H1  (row 0, col 7) → execPerformance
 *   H2  (row 1, col 7) → passPerformance
 *   A8  (row 7, col 0) → totalTc           (Total# TC Assigned)
 *   B8  (row 7, col 1) → pass
 *   C8  (row 7, col 2) → fail
 *   D8  (row 7, col 3) → inProgress
 *   E8  (row 7, col 4) → blocked
 *   F8  (row 7, col 5) → notExecuted
 *   G8  (row 7, col 6) → descoped
 *   H8  (row 7, col 7) → na
 *   A13 (row 12, col 0) → testExecutionLink
 *   A15 (row 14, col 0) → defectDashboardLink
 *   A17 (row 16, col 0) → evidencesLink
 *
 * Static column mapping — Defects1 (header row 1, data rows 2+):
 *   A (col 0)  → defectId          B (col 1)  → summary
 *   C (col 2)  → assignee          D (col 3)  → reporter
 *   E (col 4)  → priority          F (col 5)  → severityRationale
 *   G (col 6)  → affectedOpco      H (col 7)  → status
 *   I (col 8)  → defectCreatedDate J (col 9)  → expectedFixDate
 *   K (col 10) → aging             L (col 11) → comments
 *
 * NOTE: The primary parse path runs via xlsxWorker.ts (Web Worker + SheetJS).
 * This module provides a direct (synchronous) fallback and the shared analytics
 * helpers used by MerlinDashboard.
 */

import * as XLSX from "xlsx";
import type { MerlinWorkbook, MerlinStatusSheet, MerlinDefect } from "./merlinTypes";

// ─── Excel serial-date helper ─────────────────────────────────────────────────

/**
 * Converts an Excel date serial number (e.g. 46238.584) to "dd/mm/yyyy".
 * If the value is already a recognisable date string, it is returned as-is
 * formatted to dd/mm/yyyy. Non-date values are returned unchanged.
 */
function excelDateToStr(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const str = String(raw).trim();
  if (!str) return "";

  // Numeric serial — the classic Excel date encoding
  const num = Number(str);
  if (!isNaN(num) && num > 1000) {
    // Excel epoch: 1 = 1 Jan 1900 (with the deliberate 1900 leap-year bug)
    const msFromEpoch = (num - 25569) * 86400 * 1000;
    const d = new Date(msFromEpoch);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  // Already a parseable date string — normalise to dd/mm/yyyy
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return str; // fallback: return as-is
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function cellStr(ws: XLSX.WorkSheet, ref: string): string {
  const c = ws[ref];
  if (!c || c.v === undefined || c.v === null) return "";
  return String(c.v).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function cellNum(ws: XLSX.WorkSheet, ref: string): string {
  const c = ws[ref];
  if (!c || c.v === undefined || c.v === null) return "";
  return String(c.v).trim();
}

// ─── Status sheet parser ──────────────────────────────────────────────────────

function parseStatusSheet(ws: XLSX.WorkSheet): MerlinStatusSheet {
  return {
    sitPct:              cellStr(ws, "A1"),   // A1 — sheet headline
    execPerformance:     cellNum(ws, "H1"),   // H1
    executionPct:        cellNum(ws, "B2"),   // B2
    passPerformance:     cellNum(ws, "H2"),   // H2
    passPct:             cellNum(ws, "B3"),   // B3
    totalTc:             cellNum(ws, "A8"),   // A8 — Total# TC Assigned
    pass:                cellNum(ws, "B8"),   // B8
    fail:                cellNum(ws, "C8"),   // C8
    inProgress:          cellNum(ws, "D8"),   // D8
    blocked:             cellNum(ws, "E8"),   // E8
    notExecuted:         cellNum(ws, "F8"),   // F8
    descoped:            cellNum(ws, "G8"),   // G8
    na:                  cellNum(ws, "H8"),   // H8
    notes:               cellStr(ws, "A11") || "N/A",  // A11 — Notes content
    testExecutionLink:   cellStr(ws, "A13"),  // A13
    defectDashboardLink: cellStr(ws, "A15"),  // A15
    evidencesLink:       cellStr(ws, "A17"),  // A17
  };
}

// ─── Defects1 sheet parser ────────────────────────────────────────────────────

function parseDefectsSheet(ws: XLSX.WorkSheet): MerlinDefect[] {
  // Read all columns, skip header row, blankrows off
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as any[][];

  const result: MerlinDefect[] = [];
  // Row 0 = header (Defect ID, Summary, …). Data starts at row 1.
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const defectId = String(r[0] ?? "").trim();   // A
    const summary  = String(r[1] ?? "").trim();   // B
    // Skip completely blank rows
    if (!defectId && !summary) continue;
    result.push({
      defectId,                                     // A
      summary,                                      // B
      assignee:          String(r[2]  ?? "").trim(), // C
      reporter:          String(r[3]  ?? "").trim(), // D
      priority:          String(r[4]  ?? "").trim(), // E
      severityRationale: String(r[5]  ?? "").trim(), // F
      affectedOpco:      String(r[6]  ?? "").trim(), // G
      status:            String(r[7]  ?? "").trim(), // H
      defectCreatedDate: excelDateToStr(r[8]),        // I
      expectedFixDate:   excelDateToStr(r[9]),        // J
      aging:             String(r[10] ?? "").trim(),  // K
      comments:          String(r[11] ?? "").trim(),  // L
    });
  }
  return result;
}

// ─── Required sheet names ─────────────────────────────────────────────────────

const MERLIN_REQUIRED_SHEETS = ["Daily Status", "COA SIT", "Defects1"] as const;

// ─── Validation error type ───────────────────────────────────────────────────

export interface MerlinValidationError {
  type: "MERLIN_VALIDATION_ERROR";
  missing: string[];
  present: { name: string; found: boolean }[];
  sheetNames: string[];
}

// ─── Main export — direct (non-worker) parse path ────────────────────────────

export async function parseMerlinWorkbook(
  file: File
): Promise<MerlinWorkbook | MerlinValidationError> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array", cellDates: false, dense: false });

  const sheetNames = wb.SheetNames;

  // Validate all required sheets present (exact name, not case-insensitive — same as worker)
  const missing = MERLIN_REQUIRED_SHEETS.filter((s) => !sheetNames.includes(s));
  if (missing.length > 0) {
    return {
      type: "MERLIN_VALIDATION_ERROR",
      missing,
      present: MERLIN_REQUIRED_SHEETS.map((s) => ({
        name: s,
        found: sheetNames.includes(s),
      })),
      sheetNames,
    };
  }

  const dsSheet  = wb.Sheets["Daily Status"];
  const coaSheet = wb.Sheets["COA SIT"];
  const defSheet = wb.Sheets["Defects1"];

  return {
    fileName:    file.name,
    importedAt:  new Date().toISOString(),
    sheetNames,
    dailyStatus: parseStatusSheet(dsSheet),
    coaSit:      parseStatusSheet(coaSheet),
    defects:     parseDefectsSheet(defSheet),
  };
}

// ─── Analytics helpers (used by MerlinDashboard) ─────────────────────────────

/** Parse a raw string value as a number or return null */
export function toNum(s: string): number | null {
  const cleaned = s.replace(/[%,\s]/g, "");
  if (!cleaned || cleaned.toLowerCase() === "n/a" || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Group defects by a string field and count occurrences */
export function groupDefects(
  defects: MerlinDefect[],
  field: keyof MerlinDefect
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const d of defects) {
    const val = (String(d[field] ?? "").trim()) || "Unknown";
    map.set(val, (map.get(val) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Parse a dd/mm/yyyy string to a sortable number (yyyymmdd). Returns 0 for unknown. */
function ddmmyyyyToSort(s: string): number {
  const parts = s.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return Number(yyyy) * 10000 + Number(mm) * 100 + Number(dd);
  }
  // Fallback: ISO or other formats — use locale compare via Date
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Build defect trend from defectCreatedDate (col I) */
export function buildDefectTrend(
  defects: MerlinDefect[]
): { day: string; count: number }[] {
  const map = new Map<string, number>();
  for (const d of defects) {
    const raw = (d.defectCreatedDate || "").split("T")[0];
    if (!raw) continue;
    map.set(raw, (map.get(raw) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => ddmmyyyyToSort(a[0]) - ddmmyyyyToSort(b[0]))
    .map(([day, count]) => ({ day, count }));
}

/** Get unique dates from defectCreatedDate column */
export function getDefectDates(defects: MerlinDefect[]): string[] {
  const dates = new Set<string>();
  for (const d of defects) {
    const raw = (d.defectCreatedDate || "").split("T")[0];
    if (raw) dates.add(raw);
  }
  return Array.from(dates).sort((a, b) => ddmmyyyyToSort(a) - ddmmyyyyToSort(b));
}
