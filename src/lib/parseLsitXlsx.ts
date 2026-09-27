/**
 * parseLsitXlsx
 *
 * Parses the DBB-MD1-LSIT Excel file from an ArrayBuffer.
 *
 * Exact column layout (A=0 … AI=34):
 *
 *   A(0)  Opco
 *   B(1)  Business Scenario
 *   C(2)  LSIT End Date
 *   D(3)  Zycus  / Total# TS
 *   E(4)  Zycus  / Execution
 *   F(5)  Zycus  / Pass
 *   G(6)  Zycus  / Execution%
 *   H(7)  Zycus  / Pass%
 *   I(8)  OCP    / Total# TS
 *   J(9)  OCP    / Execution
 *   K(10) OCP    / Pass
 *   L(11) OCP    / Execution%
 *   M(12) OCP    / Pass%
 *   N(13) Supplier Finance / Total# TS
 *   O(14) Supplier Finance / Execution
 *   P(15) Supplier Finance / Pass
 *   Q(16) Supplier Finance / Execution%
 *   R(17) Supplier Finance / Pass%
 *   S(18) ZYCUS-POSM / Total# TS
 *   T(19) ZYCUS-POSM / Execution
 *   U(20) ZYCUS-POSM / Pass
 *   V(21) ZYCUS-POSM / Execution%
 *   W(22) ZYCUS-POSM / Pass%
 *   X(23) CTS-POSM / Total# TS
 *   Y(24) CTS-POSM / Execution
 *   Z(25) CTS-POSM / Pass
 *   AA(26) CTS-POSM / Execution%
 *   AB(27) CTS-POSM / Pass%
 *   AC(28) EDICOM / Total# TS
 *   AD(29) EDICOM / Execution
 *   AE(30) EDICOM / Pass
 *   AF(31) EDICOM / Execution%
 *   AG(32) EDICOM / Pass%
 *   AH(33) Overall Summary / Overall Execution %
 *   AI(34) Overall Summary / Overall Pass%
 *
 * Strategy:
 *   Primary:  Use the hardcoded column positions above (most reliable).
 *   Fallback: Scan the two header rows dynamically in case columns shift.
 */

import type { LSITRecord, AppMetrics } from "../data/dbbMd1LsitData";

// ─── ZIP reader ───────────────────────────────────────────────────────────────

async function readZipEntry(buf: Uint8Array, name: string): Promise<string | null> {
  const needle = new TextEncoder().encode(name);
  for (let i = 0; i < buf.length - 30; i++) {
    if (
      buf[i]     === 0x50 && buf[i + 1] === 0x4b &&
      buf[i + 2] === 0x03 && buf[i + 3] === 0x04
    ) {
      const method    = buf[i + 8]  | (buf[i + 9]  << 8);
      const cSize     = buf[i + 18] | (buf[i + 19] << 8) | (buf[i + 20] << 16) | (buf[i + 21] << 24);
      const fnLen     = buf[i + 26] | (buf[i + 27] << 8);
      const extraLen  = buf[i + 28] | (buf[i + 29] << 8);
      const fnStart   = i + 30;
      const fn        = buf.slice(fnStart, fnStart + fnLen);
      if (fn.length === needle.length && fn.every((b, j) => b === needle[j])) {
        const dataStart = fnStart + fnLen + extraLen;
        const data      = buf.slice(dataStart, dataStart + cSize);
        if (method === 0) return new TextDecoder().decode(data);
        if (method === 8 && typeof DecompressionStream !== "undefined") {
          const ds     = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(data);
          writer.close();
          const chunks: Uint8Array[] = [];
          const reader = ds.readable.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const total = chunks.reduce((n, c) => n + c.length, 0);
          const out   = new Uint8Array(total);
          let off     = 0;
          for (const c of chunks) { out.set(c, off); off += c.length; }
          return new TextDecoder().decode(out);
        }
      }
    }
  }
  return null;
}

// ─── Shared strings ───────────────────────────────────────────────────────────

function parseSharedStrings(xml: string): string[] {
  const result: string[] = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let val = "";
    for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) val += t[1];
    result.push(
      val
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    );
  }
  return result;
}

// ─── Cell grid parser ─────────────────────────────────────────────────────────

/** Convert Excel column letters (A, B, … Z, AA, AB …) to 0-based index */
function colToIdx(letters: string): number {
  return letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

function parseGrid(sheetXml: string, sharedStrings: string[]): string[][] {
  const grid: string[][] = [];
  for (const rowM of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cm of rowM[1].matchAll(/<c ([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attr  = cm[1];
      const inner = cm[2];
      const rM    = attr.match(/r="([A-Z]+)\d+"/);
      if (!rM) continue;
      const colIdx = colToIdx(rM[1]);
      while (cells.length <= colIdx) cells.push("");
      const tM    = attr.match(/t="([^"]+)"/);
      const vM    = inner.match(/<v>([\s\S]*?)<\/v>/);
      let   val   = vM ? vM[1] : "";
      if (tM && tM[1] === "s") val = sharedStrings[parseInt(val)] ?? val;
      cells[colIdx] = val;
    }
    grid.push(cells);
  }
  return grid;
}

// ─── Sheet discovery ──────────────────────────────────────────────────────────

async function findSheetPath(buf: Uint8Array): Promise<string> {
  const wbXml = await readZipEntry(buf, "xl/workbook.xml");
  if (wbXml) {
    // Match either attribute order: name="…" … r:id="…"  OR  r:id="…" … name="…"
    const sheetRe = /<sheet\b[^>]*>/g;
    for (const sm of wbXml.matchAll(sheetRe)) {
      const tag  = sm[0];
      const nameM = tag.match(/\bname="([^"]+)"/);
      const ridM  = tag.match(/\br:id="([^"]+)"/);
      if (!nameM || !ridM) continue;
      const sheetName = nameM[1].trim().toUpperCase();
      if (!sheetName.includes("LSIT") && !sheetName.includes("DBB")) continue;

      const relsXml = await readZipEntry(buf, "xl/_rels/workbook.xml.rels");
      if (relsXml) {
        // Match either attribute order in the relationship tag
        const relRe = new RegExp(`<Relationship[^>]*\\bId="${ridM[1]}"[^>]*>`);
        const relM  = relsXml.match(relRe);
        if (relM) {
          const targetM = relM[0].match(/\bTarget="([^"]+)"/);
          if (targetM) {
            const t = targetM[1];
            return t.startsWith("worksheets/") ? `xl/${t}` : t;
          }
        }
      }
      return "xl/worksheets/sheet1.xml";
    }
  }
  // Try common sheet names in order
  for (const candidate of [
    "xl/worksheets/sheet1.xml",
    "xl/worksheets/sheet2.xml",
    "xl/worksheets/sheet3.xml",
  ]) {
    const xml = await readZipEntry(buf, candidate);
    if (xml) return candidate;
  }
  return "xl/worksheets/sheet1.xml";
}

// ─── Value normalisation ──────────────────────────────────────────────────────

function normNum(raw: string | undefined): number {
  if (!raw) return 0;
  const t = raw.trim().toUpperCase();
  if (t === "" || t === "N/A" || t === "-") return 0;
  const n = parseFloat(t.replace(/[%,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function normPct(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  if (t === "" || t === "N/A" || t === "-") return null;
  const n = parseFloat(t.replace(/[%,\s]/g, ""));
  if (isNaN(n)) return null;
  // Excel may store 1.0 for 100% or 100 for 100%
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function cell(row: string[], idx: number): string {
  return idx >= 0 && idx < row.length ? (row[idx] ?? "").trim() : "";
}

function metrics(
  row: string[],
  tsIdx: number, exIdx: number, passIdx: number, exPctIdx: number, passPctIdx: number,
): AppMetrics {
  return {
    totalTS:      normNum(cell(row, tsIdx)),
    execution:    normNum(cell(row, exIdx)),
    pass:         normNum(cell(row, passIdx)),
    executionPct: normPct(cell(row, exPctIdx)),
    passPct:      normPct(cell(row, passPctIdx)),
  };
}

// ─── Hardcoded column positions (0-based) ─────────────────────────────────────

/** Returns a ColMap using the exact A–AI layout confirmed from the screenshot. */
function hardcodedColMap() {
  return {
    opco:             0,   // A
    businessScenario: 1,   // B
    lsitEndDate:      2,   // C
    // Zycus: D–H  (3–7)
    zycusTsIdx:  3, zycusExIdx:  4, zycusPassIdx:  5, zycusExPctIdx:  6, zycusPassPctIdx:  7,
    // OCP: I–M  (8–12)
    ocpTsIdx:    8, ocpExIdx:    9, ocpPassIdx:   10, ocpExPctIdx:   11, ocpPassPctIdx:   12,
    // Supplier Finance: N–R  (13–17)
    sfTsIdx:    13, sfExIdx:    14, sfPassIdx:    15, sfExPctIdx:    16, sfPassPctIdx:    17,
    // ZYCUS-POSM: S–W  (18–22)
    zpTsIdx:    18, zpExIdx:    19, zpPassIdx:    20, zpExPctIdx:    21, zpPassPctIdx:    22,
    // CTS-POSM: X–AB  (23–27)
    cpTsIdx:    23, cpExIdx:    24, cpPassIdx:    25, cpExPctIdx:    26, cpPassPctIdx:    27,
    // EDICOM: AC–AG  (28–32)
    edTsIdx:    28, edExIdx:    29, edPassIdx:    30, edExPctIdx:    31, edPassPctIdx:    32,
    // Overall Summary: AH–AI  (33–34)
    overallExecPct: 33,  // AH
    overallPassPct: 34,  // AI
  } as const;
}

// ─── Dynamic column detection (fallback) ─────────────────────────────────────

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface DynColMap {
  opco: number;
  businessScenario: number;
  lsitEndDate: number;
  zycus:         [number,number,number,number,number];
  ocp:           [number,number,number,number,number];
  supplierFinance:[number,number,number,number,number];
  zycusPosm:     [number,number,number,number,number];
  ctsPosm:       [number,number,number,number,number];
  edicom:        [number,number,number,number,number];
  overallExecPct: number;
  overallPassPct: number;
}

function buildDynColMap(groupRow: string[], subRow: string[]): DynColMap | null {
  const maxCols = Math.max(groupRow.length, subRow.length);

  // Carry-forward group label — skip columns 0-2 for the carry-forward
  // because Opco/BusinessScenario/LSITEndDate are in the group row too.
  const groupLabels: string[] = new Array(maxCols).fill("");
  let last = "";
  for (let i = 0; i < maxCols; i++) {
    const g = norm(groupRow[i] ?? "");
    // Only carry forward if it looks like an app group (not Opco/scenario/date/overall)
    if (g && !["opco","businessscenario","lsitenddate","overall","overallsummary"].some(x => g.includes(x))) {
      last = g;
    } else if (g.includes("overall")) {
      last = g;
    }
    groupLabels[i] = last;
  }

  const appMap: Record<string, number[]> = {
    zycus: [], ocp: [], supplierfinance: [], zycusposm: [], ctsposm: [], edicom: [],
  };

  // Map group label → internal key
  function groupKey(g: string): string | null {
    // Order matters: check more specific before less specific
    if (g.includes("zycusposm") || g.includes("zycusposm")) return "zycusposm";
    if (g.includes("ctsposm"))    return "ctsposm";
    if (g.includes("supplierfin")) return "supplierfinance";
    if (g.includes("edicom"))      return "edicom";
    if (g.includes("zycus"))       return "zycus";
    if (g.includes("ocp"))         return "ocp";
    return null;
  }

  // Map sub-header cell → 0=totalTS 1=execution 2=pass 3=execPct 4=passPct
  function subIdx(s: string): number | null {
    const n = norm(s);
    if (n.includes("total") || n === "ts" || n.includes("totalts") || n.includes("total#")) return 0;
    // Check percent variants BEFORE plain "execution"/"pass"
    if (n === "execution" || n === "executionno" || (n.includes("execution") && !n.includes("pct") && !n.includes("percent") && !n.includes("%"))) {
      // Only match plain "Execution" (no %)
      if (!n.includes("pct") && !n.includes("percent") && n.endsWith("execution")) return 1;
      if (n === "execution") return 1;
    }
    if (n.includes("execution") && (n.includes("pct") || n.includes("percent") || n.includes("%"))) return 3;
    if (n.includes("execution")) return 1; // plain execution
    if (n.includes("pass") && (n.includes("pct") || n.includes("percent") || n.includes("%"))) return 4;
    if (n === "pass") return 2;
    if (n.includes("pass") && !n.includes("pct") && !n.includes("percent")) return 2;
    return null;
  }

  let opcoIdx = -1, bsIdx = -1, dateIdx = -1, oExIdx = -1, oPassIdx = -1;

  for (let i = 0; i < maxCols; i++) {
    const g   = norm(groupRow[i] ?? "");
    const sub = norm(subRow[i]   ?? "");
    const gl  = groupLabels[i];

    // First three general columns
    if (g === "opco" || sub === "opco")                        { opcoIdx = i; continue; }
    if (g.includes("business") || sub.includes("business"))    { bsIdx   = i; continue; }
    if ((g.includes("lsit") && g.includes("end")) ||
        (sub.includes("lsit") && sub.includes("end")))         { dateIdx = i; continue; }

    // Overall Summary columns (AH, AI)
    if (g.includes("overall") || gl.includes("overall")) {
      const combined = g + sub;
      if (combined.includes("exec") && !combined.includes("pass")) { oExIdx   = i; continue; }
      if (combined.includes("pass"))                                { oPassIdx = i; continue; }
    }

    // Application columns
    const key = groupKey(gl);
    if (key) {
      const si = subIdx(subRow[i] ?? "");
      if (si !== null) appMap[key][si] = i;
    }
  }

  // Require at minimum: opco + at least zycus total
  if (opcoIdx === -1) return null;
  if (appMap.zycus[0] === undefined) return null;

  const toTuple = (a: number[]): [number,number,number,number,number] =>
    [a[0] ?? -1, a[1] ?? -1, a[2] ?? -1, a[3] ?? -1, a[4] ?? -1];

  return {
    opco:             opcoIdx,
    businessScenario: bsIdx,
    lsitEndDate:      dateIdx,
    zycus:            toTuple(appMap.zycus),
    ocp:              toTuple(appMap.ocp),
    supplierFinance:  toTuple(appMap.supplierfinance),
    zycusPosm:        toTuple(appMap.zycusposm),
    ctsPosm:          toTuple(appMap.ctsposm),
    edicom:           toTuple(appMap.edicom),
    overallExecPct:   oExIdx,
    overallPassPct:   oPassIdx,
  };
}

// ─── Region / blank detection ─────────────────────────────────────────────────

const KNOWN_REGIONS = new Set(["AME", "NSA", "APAC", "EUROPE", "LATAM", "APME", "NAZ", "EEMEA"]);

function detectRegion(row: string[]): string | null {
  for (const c of row) {
    const t = c.trim().toUpperCase();
    if (KNOWN_REGIONS.has(t)) return c.trim();
  }
  return null;
}

function isSkippable(row: string[]): boolean {
  const vals = row.filter((c) => c.trim() !== "");
  if (vals.length === 0) return true;
  const first = vals[0].trim().toLowerCase();
  return first === "total" || first === "grand total" || first === "summary";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function parseLsitXlsx(file: File): Promise<LSITRecord[]> {
  if (!file.name.match(/\.xlsx?$/i)) {
    throw new Error("Please upload an .xlsx file.");
  }

  const ab  = await file.arrayBuffer();
  const buf = new Uint8Array(ab);

  // 1. Locate the correct sheet
  const sheetPath = await findSheetPath(buf);
  const sharedXml = await readZipEntry(buf, "xl/sharedStrings.xml");
  const sheetXml  = await readZipEntry(buf, sheetPath);

  if (!sheetXml) {
    throw new Error(
      `Could not read sheet data (tried "${sheetPath}"). ` +
      "Make sure the file is the original DBB-MD1-LSIT 2.xlsx.",
    );
  }

  const sharedStrings = sharedXml ? parseSharedStrings(sharedXml) : [];
  const grid          = parseGrid(sheetXml, sharedStrings);

  // 2. Find the group-header row (contains "Opco" in col A or anywhere in first 5 cols)
  let groupRowIdx = -1;
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = grid[r];
    // "Opco" should be in column A (index 0) or first few columns
    for (let c = 0; c < Math.min(row.length, 5); c++) {
      if (norm(row[c]) === "opco") { groupRowIdx = r; break; }
    }
    if (groupRowIdx !== -1) break;
  }

  if (groupRowIdx === -1) {
    throw new Error(
      'Could not locate the "Opco" header. ' +
      "Ensure you are uploading the DBB-MD1-LSIT sheet and not a different workbook.",
    );
  }

  const groupRow   = grid[groupRowIdx];
  const subRow     = grid[groupRowIdx + 1] ?? [];
  const dataStart  = groupRowIdx + 2;

  // 3. Build column map
  //
  // Use the hardcoded A–AI layout when Opco is in column 0 (the confirmed layout).
  // Only fall back to dynamic detection if Opco ended up in a different column,
  // which would indicate a structurally different file.
  const hm = hardcodedColMap();
  const opcoIsAtColZero = norm(groupRow[0] ?? "") === "opco";

  let records: LSITRecord[];

  if (opcoIsAtColZero) {
    // Primary path: exact column positions A(0)–AI(34) confirmed from file
    records = parseWithHardcoded(grid, dataStart, hm);
  } else {
    // Fallback: dynamic header detection for structurally different files
    const dynMap = buildDynColMap(groupRow, subRow);
    if (!dynMap) {
      throw new Error(
        "Could not map LSIT columns. The header structure may differ from the expected format. " +
        "Expected: A=Opco, B=Business Scenario, C=LSIT End Date, D–H=Zycus, I–M=OCP, " +
        "N–R=Supplier Finance, S–W=ZYCUS-POSM, X–AB=CTS-POSM, AC–AG=EDICOM, AH–AI=Overall Summary.",
      );
    }
    records = parseWithDynamic(grid, dataStart, dynMap);
  }

  if (records.length === 0) {
    throw new Error(
      "Parsed 0 data rows. Check that the file contains OpCo entries below the header rows.",
    );
  }

  return records;
}

// ─── Row parsers ──────────────────────────────────────────────────────────────

function parseWithHardcoded(
  grid: string[][],
  dataStart: number,
  m: ReturnType<typeof hardcodedColMap>,
): LSITRecord[] {
  const records: LSITRecord[] = [];
  let region = "";

  for (let i = dataStart; i < grid.length; i++) {
    const row = grid[i];
    const r   = detectRegion(row);
    if (r) { region = r; continue; }
    if (isSkippable(row)) continue;

    const opco = cell(row, m.opco);
    if (!opco) continue;

    records.push({
      opco,
      businessScenario: cell(row, m.businessScenario) || "-",
      lsitEndDate:      cell(row, m.lsitEndDate)      || "-",
      region,

      zycus:          metrics(row, m.zycusTsIdx,  m.zycusExIdx,  m.zycusPassIdx,  m.zycusExPctIdx,  m.zycusPassPctIdx),
      ocp:            metrics(row, m.ocpTsIdx,    m.ocpExIdx,    m.ocpPassIdx,    m.ocpExPctIdx,    m.ocpPassPctIdx),
      supplierFinance:metrics(row, m.sfTsIdx,     m.sfExIdx,     m.sfPassIdx,     m.sfExPctIdx,     m.sfPassPctIdx),
      zycusPosm:      metrics(row, m.zpTsIdx,     m.zpExIdx,     m.zpPassIdx,     m.zpExPctIdx,     m.zpPassPctIdx),
      ctsPosm:        metrics(row, m.cpTsIdx,     m.cpExIdx,     m.cpPassIdx,     m.cpExPctIdx,     m.cpPassPctIdx),
      edicom:         metrics(row, m.edTsIdx,     m.edExIdx,     m.edPassIdx,     m.edExPctIdx,     m.edPassPctIdx),

      overallExecutionPct: normPct(cell(row, m.overallExecPct)),
      overallPassPct:      normPct(cell(row, m.overallPassPct)),
    });
  }
  return records;
}

function parseWithDynamic(
  grid: string[][],
  dataStart: number,
  m: DynColMap,
): LSITRecord[] {
  const records: LSITRecord[] = [];
  let region = "";

  const appMetrics = (row: string[], idxs: [number,number,number,number,number]): AppMetrics =>
    metrics(row, idxs[0], idxs[1], idxs[2], idxs[3], idxs[4]);

  for (let i = dataStart; i < grid.length; i++) {
    const row = grid[i];
    const r   = detectRegion(row);
    if (r) { region = r; continue; }
    if (isSkippable(row)) continue;

    const opco = cell(row, m.opco);
    if (!opco) continue;

    records.push({
      opco,
      businessScenario: cell(row, m.businessScenario) || "-",
      lsitEndDate:      cell(row, m.lsitEndDate)      || "-",
      region,

      zycus:           appMetrics(row, m.zycus),
      ocp:             appMetrics(row, m.ocp),
      supplierFinance: appMetrics(row, m.supplierFinance),
      zycusPosm:       appMetrics(row, m.zycusPosm),
      ctsPosm:         appMetrics(row, m.ctsPosm),
      edicom:          appMetrics(row, m.edicom),

      overallExecutionPct: normPct(cell(row, m.overallExecPct)),
      overallPassPct:      normPct(cell(row, m.overallPassPct)),
    });
  }
  return records;
}
