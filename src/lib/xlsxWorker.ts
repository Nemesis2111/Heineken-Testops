/**
 * xlsxWorker.ts
 * ─────────────────────────────────────────────────────────────
 * Web Worker that parses XLSX/XLS files off the main thread using SheetJS.
 *
 * Message types sent TO the worker:
 *   { type: "PARSE_MERLIN",       buffer: ArrayBuffer, fileName: string }
 *   { type: "PARSE_SINGLE_SHEET", buffer: ArrayBuffer }
 *
 * Messages sent FROM the worker:
 *   { type: "PROGRESS",          pct: number }
 *   { type: "MERLIN_DONE",       result: MerlinWorkbook }
 *   { type: "VALIDATION_ERROR",  missing: string[], present: {name,found}[], sheetNames: string[] }
 *   { type: "SHEET_DONE",        result: Record<string,string>[] }
 *   { type: "ERROR",             message: string }
 *
 * Merlin static cell mapping — Daily Status / COA SIT:
 *   A1  → title (sheet headline)
 *   B2  → executionPct
 *   B3  → passPct
 *   H1  → execPerformance
 *   H2  → passPerformance
 *   A8  → totalTc
 *   B8  → pass
 *   C8  → fail
 *   D8  → inProgress
 *   E8  → blocked
 *   F8  → notExecuted
 *   G8  → descoped
 *   H8  → na
 *   A13 → testExecutionLink
 *   A15 → defectDashboardLink
 *   A17 → evidencesLink
 *
 * Merlin Defects1 column mapping (header row 1, data from row 2):
 *   A (col 0)  → defectId          B (col 1)  → summary
 *   C (col 2)  → assignee          D (col 3)  → reporter
 *   E (col 4)  → priority          F (col 5)  → severityRationale
 *   G (col 6)  → affectedOpco      H (col 7)  → status
 *   I (col 8)  → defectCreatedDate J (col 9)  → expectedFixDate
 *   K (col 10) → aging             L (col 11) → comments
 */

import * as XLSX from "xlsx";

// ─── Required sheet names ─────────────────────────────────────────────────────
const REQUIRED_SHEETS = ["Daily Status", "COA SIT", "Defects1"] as const;

// ─── Excel serial-date helper ─────────────────────────────────────────────────

function excelDateToStr(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const str = String(raw).trim();
  if (!str) return "";
  const num = Number(str);
  if (!isNaN(num) && num > 1000) {
    const msFromEpoch = (num - 25569) * 86400 * 1000;
    const d = new Date(msFromEpoch);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return str;
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

function parseStatusSheet(ws: XLSX.WorkSheet) {
  return {
    sitPct:              cellStr(ws, "A1"),   // Sheet headline
    execPerformance:     cellNum(ws, "H1"),   // H1
    executionPct:        cellNum(ws, "B2"),   // B2
    passPerformance:     cellNum(ws, "H2"),   // H2
    passPct:             cellNum(ws, "B3"),   // B3
    totalTc:             cellNum(ws, "A8"),   // A8
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

function parseDefectsSheet(ws: XLSX.WorkSheet) {
  // Read all columns A–L, skip header row, blankrows off
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as any[][];

  const defects = [];
  // row 0 = header (Defect ID, Summary, …), data starts at row 1
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const defectId = String(r[0] ?? "").trim();  // A
    const summary  = String(r[1] ?? "").trim();  // B
    if (!defectId && !summary) continue;  // skip truly blank rows
    defects.push({
      defectId,                                              // A
      summary,                                               // B
      assignee:          String(r[2]  ?? "").trim(),         // C
      reporter:          String(r[3]  ?? "").trim(),         // D
      priority:          String(r[4]  ?? "").trim(),         // E
      severityRationale: String(r[5]  ?? "").trim(),         // F
      affectedOpco:      String(r[6]  ?? "").trim(),         // G
      status:            String(r[7]  ?? "").trim(),         // H
      defectCreatedDate: excelDateToStr(r[8]),               // I
      expectedFixDate:   excelDateToStr(r[9]),               // J
      aging:             String(r[10] ?? "").trim(),         // K
      comments:          String(r[11] ?? "").trim(),         // L
    });
  }
  return defects;
}

// ─── Merlin parser ────────────────────────────────────────────────────────────

function parseMerlin(ab: ArrayBuffer, fileName: string) {
  self.postMessage({ type: "PROGRESS", pct: 20 });

  const wb = XLSX.read(ab, { type: "array", cellDates: false, dense: false });

  self.postMessage({ type: "PROGRESS", pct: 50 });

  const sheetNames = wb.SheetNames;

  // Validate all three required sheets exist (exact name)
  const missing = REQUIRED_SHEETS.filter((s) => !sheetNames.includes(s));
  if (missing.length > 0) {
    const present = REQUIRED_SHEETS.map((s) => ({ name: s, found: sheetNames.includes(s) }));
    self.postMessage({ type: "VALIDATION_ERROR", missing, present, sheetNames });
    return;
  }

  self.postMessage({ type: "PROGRESS", pct: 70 });

  const dsSheet  = wb.Sheets["Daily Status"];
  const coaSheet = wb.Sheets["COA SIT"];
  const defSheet = wb.Sheets["Defects1"];

  self.postMessage({ type: "PROGRESS", pct: 85 });

  const result = {
    fileName,
    importedAt: new Date().toISOString(),
    sheetNames,
    dailyStatus: parseStatusSheet(dsSheet),
    coaSit:      parseStatusSheet(coaSheet),
    defects:     parseDefectsSheet(defSheet),
  };

  self.postMessage({ type: "PROGRESS", pct: 98 });
  self.postMessage({ type: "MERLIN_DONE", result });
}

// ─── Generic single-sheet parser (non-Merlin xlsx/xls) ───────────────────────

function parseSingleSheet(ab: ArrayBuffer) {
  self.postMessage({ type: "PROGRESS", pct: 20 });

  const wb = XLSX.read(ab, { type: "array", cellDates: false, dense: false });

  self.postMessage({ type: "PROGRESS", pct: 60 });

  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    self.postMessage({ type: "SHEET_DONE", result: [] });
    return;
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

  self.postMessage({ type: "PROGRESS", pct: 90 });
  self.postMessage({ type: "SHEET_DONE", result: rows });
}

// ─── Worker message handler ───────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  const { type, buffer, fileName } = e.data;
  try {
    if (type === "PARSE_MERLIN") {
      parseMerlin(buffer as ArrayBuffer, fileName ?? "");
    } else if (type === "PARSE_SINGLE_SHEET") {
      parseSingleSheet(buffer as ArrayBuffer);
    }
  } catch (err: any) {
    self.postMessage({ type: "ERROR", message: err?.message ?? "Parse failed" });
  }
};
