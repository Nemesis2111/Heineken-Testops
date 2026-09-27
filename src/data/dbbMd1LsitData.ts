/**
 * DBB-MD1-LSIT Data Module
 *
 * Source: DBB-MD1-LSIT 2.xlsx  (sheet: DBB-MD1-LSIT)
 *
 * The Excel uses two-level grouped headers. The data below has been
 * normalised into a flat typed object per the specification:
 *
 *   Row groupings (regions) are preserved as a `region` field.
 *   "N/A" text cells are stored as null; missing numerics default to 0.
 *   Percentage values are normalised to 0-100 (some cells arrived as
 *   fractions, others as "100%"-style strings — all stored as numbers).
 */

export interface AppMetrics {
  totalTS: number;
  execution: number;
  pass: number;
  executionPct: number | null;   // null = N/A (no test scripts scoped)
  passPct: number | null;
}

export interface LSITRecord {
  opco: string;
  businessScenario: number | string;
  lsitEndDate: string;
  region: string;

  zycus: AppMetrics;
  ocp: AppMetrics;
  supplierFinance: AppMetrics;
  zycusPosm: AppMetrics;
  ctsPosm: AppMetrics;
  edicom: AppMetrics;

  overallExecutionPct: number | null;
  overallPassPct: number | null;
}

// ---------------------------------------------------------------------------
// Helper to normalise a percentage cell.
// Accepts: number (0-1 fraction OR 0-100), string "95%", "N/A", undefined
// ---------------------------------------------------------------------------
function normPct(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    const t = raw.trim().toUpperCase();
    if (t === "N/A" || t === "" || t === "-") return null;
    const n = parseFloat(t.replace("%", ""));
    if (isNaN(n)) return null;
    return n <= 1 ? Math.round(n * 100) : n;
  }
  if (typeof raw === "number") {
    if (isNaN(raw)) return null;
    return raw <= 1 ? Math.round(raw * 100) : raw;
  }
  return null;
}

function normNum(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "string") {
    const t = raw.trim().toUpperCase();
    if (t === "N/A" || t === "" || t === "-") return 0;
    const n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }
  if (typeof raw === "number") return isNaN(raw) ? 0 : raw;
  return 0;
}

function app(ts: any, ex: any, pass: any, exPct: any, pPct: any): AppMetrics {
  return {
    totalTS: normNum(ts),
    execution: normNum(ex),
    pass: normNum(pass),
    executionPct: normPct(exPct),
    passPct: normPct(pPct),
  };
}

// ---------------------------------------------------------------------------
// Static dataset derived from DBB-MD1-LSIT 2.xlsx
// ---------------------------------------------------------------------------
export const LSIT_DATA: LSITRecord[] = [
  // ── AME ─────────────────────────────────────────────────────────────────
  {
    opco: "Namibia", businessScenario: 69, lsitEndDate: "Completed", region: "AME",
    zycus:          app(30, 30, 30, 100, 100),
    ocp:            app(29, 29, 29, 100, 100),
    supplierFinance:app(5, 5, 5, 100, 100),
    zycusPosm:      app(1, 1, 1, 100, 100),
    ctsPosm:        app(4, 4, 4, 100, 100),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  {
    opco: "Ethiopia", businessScenario: 107, lsitEndDate: "Completed", region: "AME",
    zycus:          app(44, 44, 44, 100, 100),
    ocp:            app(44, 44, 44, 100, 100),
    supplierFinance:app(5, 5, 5, 100, 100),
    zycusPosm:      app(1, 1, 1, 100, 100),
    ctsPosm:        app(4, 4, 4, 100, 100),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  // ── NSA ─────────────────────────────────────────────────────────────────
  {
    opco: "Jamaica", businessScenario: 144, lsitEndDate: "Completed", region: "NSA",
    zycus:          app(72, 72, 72, 100, 100),
    ocp:            app(65, 65, 65, 100, 100),
    supplierFinance:app(5, 5, 5, 100, 100),
    zycusPosm:      app(0, 0, 0, null, null),
    ctsPosm:        app(0, 0, 0, null, null),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  {
    opco: "Ethiopia", businessScenario: 125, lsitEndDate: "Completed", region: "NSA",
    zycus:          app(58, 58, 58, 100, 100),
    ocp:            app(60, 60, 60, 100, 100),
    supplierFinance:app(5, 5, 5, 100, 100),
    zycusPosm:      app(2, 2, 2, 100, 100),
    ctsPosm:        app(0, 0, 0, null, null),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  // ── APAC ─────────────────────────────────────────────────────────────────
  {
    opco: "Malaysia", businessScenario: 127, lsitEndDate: "Completed", region: "APAC",
    zycus:          app(60, 60, 60, 100, 100),
    ocp:            app(58, 58, 58, 100, 100),
    supplierFinance:app(5, 5, 5, 100, 100),
    zycusPosm:      app(1, 1, 1, 100, 100),
    ctsPosm:        app(3, 3, 3, 100, 100),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  {
    opco: "Singapore", businessScenario: 97, lsitEndDate: "Completed", region: "APAC",
    zycus:          app(62, 62, 62, 100, 100),
    ocp:            app(44, 44, 44, 100, 100),
    supplierFinance:app(5, 5, 5, 100, 100),
    zycusPosm:      app(1, 1, 1, 100, 100),
    ctsPosm:        app(3, 3, 3, 100, 100),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  {
    opco: "PNG", businessScenario: 85, lsitEndDate: "Completed", region: "APAC",
    zycus:          app(53, 53, 53, 100, 100),
    ocp:            app(20, 20, 20, 100, 100),
    supplierFinance:app(0, 0, 0, null, null),
    zycusPosm:      app(1, 1, 1, 100, 100),
    ctsPosm:        app(1, 1, 1, 100, 100),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  // ── EUROPE ───────────────────────────────────────────────────────────────
  {
    opco: "Romania", businessScenario: 167, lsitEndDate: "Completed", region: "EUROPE",
    zycus:          app(72, 72, 72, 100, 100),
    ocp:            app(72, 72, 72, 100, 100),
    supplierFinance:app(0, 0, 0, null, null),
    zycusPosm:      app(3, 3, 3, 100, 100),
    ctsPosm:        app(3, 3, 3, 100, 100),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  {
    opco: "Croatia", businessScenario: 88, lsitEndDate: "Completed", region: "EUROPE",
    zycus:          app(42, 42, 42, 100, 100),
    ocp:            app(42, 42, 42, 100, 100),
    supplierFinance:app(0, 0, 0, null, null),
    zycusPosm:      app(0, 0, 0, null, null),
    ctsPosm:        app(0, 0, 0, null, null),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
  {
    opco: "Hungary", businessScenario: 164, lsitEndDate: "Completed", region: "EUROPE",
    zycus:          app(77, 77, 75, 100, 97),
    ocp:            app(77, 77, 75, 100, 97),
    supplierFinance:app(0, 0, 0, null, null),
    zycusPosm:      app(1, 1, 1, 100, 100),
    ctsPosm:        app(3, 3, 3, 100, 100),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 97,
  },
  {
    opco: "HBS B.V", businessScenario: 21, lsitEndDate: "Completed", region: "EUROPE",
    zycus:          app(21, 21, 21, 100, 100),
    ocp:            app(0, 0, 0, null, null),
    supplierFinance:app(0, 0, 0, null, null),
    zycusPosm:      app(0, 0, 0, null, null),
    ctsPosm:        app(0, 0, 0, null, null),
    edicom:         app(0, 0, 0, null, null),
    overallExecutionPct: 100, overallPassPct: 100,
  },
];

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export type AppKey = "zycus" | "ocp" | "supplierFinance" | "zycusPosm" | "ctsPosm" | "edicom";

export const APP_LABELS: Record<AppKey, string> = {
  zycus: "Zycus",
  ocp: "OCP",
  supplierFinance: "Supplier Finance",
  zycusPosm: "ZYCUS-POSM",
  ctsPosm: "CTS-POSM",
  edicom: "EDICOM",
};

export const APP_KEYS: AppKey[] = ["zycus", "ocp", "supplierFinance", "zycusPosm", "ctsPosm", "edicom"];

/** Aggregate all records for a given application. */
export function aggregateApp(data: LSITRecord[], key: AppKey): AppMetrics {
  const totalTS = data.reduce((s, r) => s + r[key].totalTS, 0);
  const execution = data.reduce((s, r) => s + r[key].execution, 0);
  const pass = data.reduce((s, r) => s + r[key].pass, 0);
  const executionPct = totalTS > 0 ? Math.round((execution / totalTS) * 100) : null;
  const passPct = execution > 0 ? Math.round((pass / execution) * 100) : null;
  return { totalTS, execution, pass, executionPct, passPct };
}

/** Overall KPIs across all records. */
export function computeKPIs(data: LSITRecord[]) {
  const totalTS = APP_KEYS.reduce((s, k) => s + data.reduce((a, r) => a + r[k].totalTS, 0), 0);
  const totalExecuted = APP_KEYS.reduce((s, k) => s + data.reduce((a, r) => a + r[k].execution, 0), 0);
  const totalPassed = APP_KEYS.reduce((s, k) => s + data.reduce((a, r) => a + r[k].pass, 0), 0);
  const overallExecPct = totalTS > 0 ? Math.round((totalExecuted / totalTS) * 100) : 0;
  const overallPassPct = totalExecuted > 0 ? Math.round((totalPassed / totalExecuted) * 100) : 0;
  const opcos = [...new Set(data.map((r) => r.opco))];
  const scenarios = data.map((r) => r.businessScenario);
  return { totalTS, totalExecuted, totalPassed, overallExecPct, overallPassPct, opcos, scenarios };
}

/** Health classification. */
export function healthStatus(pct: number | null): { label: string; color: string; bg: string } {
  if (pct === null) return { label: "N/A", color: "#5B6B85", bg: "#F1F3F7" };
  if (pct >= 90) return { label: "Healthy", color: "#006429", bg: "#E4F6EC" };
  if (pct >= 75) return { label: "Attention", color: "#B85400", bg: "#FFF1E5" };
  return { label: "At Risk", color: "#DA1E28", bg: "#FFEAEA" };
}

/** Dark-mode aware health colours. */
export function healthStatusDark(pct: number | null): { label: string; color: string; bg: string } {
  if (pct === null) return { label: "N/A", color: "#52A872", bg: "rgba(82,168,114,0.15)" };
  if (pct >= 90) return { label: "Healthy", color: "#3DD68C", bg: "rgba(61,214,140,0.15)" };
  if (pct >= 75) return { label: "Attention", color: "#F0C060", bg: "rgba(240,192,96,0.15)" };
  return { label: "At Risk", color: "#FF7B7B", bg: "rgba(218,30,40,0.18)" };
}

export function getDateRange(data: LSITRecord[]): { min: string; max: string } {
  const dates = data.map((r) => r.lsitEndDate).filter((d) => d && d !== "Completed" && d !== "-");
  if (!dates.length) return { min: "Completed", max: "Completed" };
  return { min: dates[0], max: dates[dates.length - 1] };
}
