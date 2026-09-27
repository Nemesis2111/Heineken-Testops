/**
 * MerlinDashboard.tsx
 * ─────────────────────────────────────────────────────────────
 * Merlin Intake V5 Dashboard — static cell-to-UI mapping.
 *
 * All fields are sourced directly from the parsed MerlinWorkbook.
 * No fabricated historical data. Charts are built from real values only.
 *
 * Static cell mapping (per spec):
 *   A1  → sitPct (sheet headline)
 *   B2  → executionPct   B3  → passPct
 *   H1  → execPerformance   H2  → passPerformance
 *   A8  → totalTc       B8  → pass           C8  → fail
 *   D8  → inProgress    E8  → blocked        F8  → notExecuted
 *   G8  → descoped      H8  → na
 *   A13 → testExecutionLink
 *   A15 → defectDashboardLink
 *   A17 → evidencesLink
 *
 * Page layout:
 *  1. SIT Executive Summary  (Daily Status sheet)
 *  2. Merlin Defect List     (full table)
 *  3. COA SIT Summary        (COA SIT sheet)
 *  4. SIT vs COA SIT Comparison bar chart + table
 *  5. Test Execution Analytics (bar + pie SIT, bar + pie COA SIT)
 *  6. Defect Analytics (6 charts from Defects columns)
 *  7. Day-wise Progress
 */

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
  AreaChart, Area,
} from "recharts";
import {
  FileSpreadsheet, ExternalLink, Calendar as CalendarIcon,
  Search, Download, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, Bug,
  List,
} from "lucide-react";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import EmptyState from "../components/EmptyState";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { useCountUp } from "../lib/useCountUp";
import { useProjectStore } from "../lib/ProjectStore";
import {
  toNum, groupDefects, buildDefectTrend, getDefectDates,
} from "../lib/parseMerlinWorkbook";
import type { MerlinDefect } from "../lib/merlinTypes";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  COLORS.green, COLORS.blue, COLORS.warning, COLORS.danger,
  "#8A3FFC", "#00B8D9", "#F1620A", "#6FDC8C",
];

const PRIORITY_COLOR: Record<string, string> = {
  Critical: COLORS.danger,
  Blocker:  COLORS.danger,
  Major:    COLORS.warning,
  Minor:    COLORS.blue,
  Trivial:  COLORS.slate,
};

const STATUS_COLOR: Record<string, string> = {
  "To Do":            COLORS.slate,
  "In Progress":      COLORS.blue,
  "Done":             COLORS.green,
  "Blocked":          COLORS.danger,
  "Ready for Review": COLORS.warning,
};

// Open-defect statuses — statuses that indicate active/open work
const OPEN_STATUSES = new Set(["To Do", "In Progress", "Blocked", "Open", "Reopened", "In Review"]);

export function isOpenDefect(status: string): boolean {
  if (!status) return false;
  const sl = status.toLowerCase().trim();
  // Exclude closed/resolved/done statuses
  if (sl === "done" || sl === "closed" || sl === "resolved" || sl === "won't fix" || sl === "wont fix") return false;
  // Include anything that matches an open status (or is not explicitly closed)
  return OPEN_STATUSES.has(status) || (!sl.includes("done") && !sl.includes("closed") && !sl.includes("resolved"));
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function Val({ v, suffix = "" }: { v: string; suffix?: string }) {
  const dark  = useDark();
  const n     = toNum(v);
  const count = useCountUp(n ?? 0, 700);
  const ink   = dc(dark, DARK.ink, COLORS.ink);
  const faint = dc(dark, DARK.faint, COLORS.faint);
  if (!v || v === "") return <span style={{ color: faint }}>N/A</span>;
  if (n !== null) return <span style={{ color: ink }}>{count}{suffix}</span>;
  return <span style={{ color: ink }}>{v}</span>;
}

function KpiCard({
  label, raw, color, suffix = "", icon: Icon,
}: {
  label: string; raw: string; color: string; suffix?: string; icon?: React.ElementType;
}) {
  const dark = useDark();
  return (
    <GlassCard className="p-4 relative overflow-hidden">
      <div className="blob w-20 h-20 -top-6 -right-6 absolute" style={{ background: color, opacity: 0.15 }} />
      {Icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 relative" style={{ background: `${color}22` }}>
          <Icon size={14} style={{ color }} />
        </div>
      )}
      <div className="htcc-display font-extrabold text-2xl relative">
        <Val v={raw} suffix={suffix} />
      </div>
      <div className="text-[10px] font-medium mt-0.5 relative" style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>
        {label}
      </div>
    </GlassCard>
  );
}

/** Compact KPI card — smaller padding + font, used in the side-by-side SIT grid */
function KpiCardSm({
  label, raw, color, suffix = "", icon: Icon,
}: {
  label: string; raw: string; color: string; suffix?: string; icon?: React.ElementType;
}) {
  const dark = useDark();
  return (
    <GlassCard className="p-2.5 relative overflow-hidden">
      <div className="blob w-12 h-12 -top-3 -right-3 absolute" style={{ background: color, opacity: 0.13 }} />
      {Icon && (
        <div className="w-6 h-6 rounded-md flex items-center justify-center mb-1 relative" style={{ background: `${color}22` }}>
          <Icon size={11} style={{ color }} />
        </div>
      )}
      <div className="htcc-display font-extrabold text-lg relative">
        <Val v={raw} suffix={suffix} />
      </div>
      <div className="text-[9px] font-medium mt-0.5 relative leading-tight" style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>
        {label}
      </div>
    </GlassCard>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  if (!href || !href.startsWith("http")) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
      style={{ background: COLORS.blueSoft, color: COLORS.blueDark }}>
      <ExternalLink size={11} />
      {label}
    </a>
  );
}

function NoData({ msg = "No data available." }: { msg?: string }) {
  const dark = useDark();
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <FileSpreadsheet size={22} style={{ color: dc(dark, DARK.faint, COLORS.faint), opacity: 0.45 }} />
      <span className="text-xs text-center" style={{ color: dc(dark, DARK.faint, COLORS.faint) }}>{msg}</span>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  const dark = useDark();
  return (
    <GlassCard className="p-5">
      <div className="text-sm font-bold mb-4" style={{ color: dc(dark, DARK.ink, COLORS.ink) }}>{title}</div>
      {children}
    </GlassCard>
  );
}

// ─── Tooltip style ────────────────────────────────────────────────────────────
function useTtStyle() {
  const dark = useDark();
  return { borderRadius: 10, fontSize: 12, background: dc(dark, DARK.surface, "#fff"), color: dc(dark, DARK.body, COLORS.ink) };
}

// ─── Defect priority badge ────────────────────────────────────────────────────
function PBadge({ p }: { p: string }) {
  const pl = p.toLowerCase();
  const c = pl.includes("critical") || pl.includes("blocker") ? COLORS.danger
    : pl.includes("major") ? COLORS.warning
    : pl.includes("minor") ? COLORS.blue
    : COLORS.slate;
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${c}18`, color: c }}>
      {p || "—"}
    </span>
  );
}
function SBadge({ s }: { s: string }) {
  const c = STATUS_COLOR[s] ?? COLORS.slate;
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${c}18`, color: c }}>
      {s || "—"}
    </span>
  );
}

// ─── Status section builder (full) ────────────────────────────────────────────
function StatusOverview({
  title, sheet, accent,
}: {
  title: string;
  sheet: NonNullable<ReturnType<typeof useProjectStore>["state"]["merlinWorkbook"]["dailyStatus"]>;
  accent: string;
}) {
  const dark = useDark();
  const border = dc(dark, DARK.border, COLORS.border);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: accent }}>
            {title}
          </div>
          <div className="htcc-display font-bold text-lg" style={{ color: dc(dark, DARK.ink, COLORS.ink) }}>
            {sheet.sitPct || "N/A"}
          </div>
          <div className="text-xs mt-0.5" style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>Overall Percentage</div>
        </div>
      </div>

      {/* Execution % & Pass % */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KpiCard label="Execution %" raw={sheet.executionPct} color={accent} suffix="%" />
        <KpiCard label="Pass %"      raw={sheet.passPct}      color={COLORS.green} suffix="%" />
      </div>

      {/* Count grid — Total TC first, then status breakdown */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
        <KpiCard label="Total Test Cases" raw={sheet.totalTc}     color={accent}         icon={List} />
        <KpiCard label="Passed"           raw={sheet.pass}        color={COLORS.green}   icon={CheckCircle2} />
        <KpiCard label="Failed"           raw={sheet.fail}        color={COLORS.danger}  icon={AlertTriangle} />
        <KpiCard label="In Progress"      raw={sheet.inProgress}  color={COLORS.blue}    icon={Clock} />
        <KpiCard label="Blocked"          raw={sheet.blocked}     color={COLORS.warning} icon={Bug} />
        <KpiCard label="Not Executed"     raw={sheet.notExecuted} color={COLORS.slate}   />
        <KpiCard label="Descoped"         raw={sheet.descoped}    color={COLORS.faint}   />
        {sheet.na && <KpiCard label="NA"  raw={sheet.na}          color={COLORS.faint}   />}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-2 mt-2 pt-3" style={{ borderTop: `1px solid ${border}` }}>
        <LinkButton href={sheet.testExecutionLink}   label="Open Test Execution" />
        <LinkButton href={sheet.defectDashboardLink} label="Open Defect Dashboard" />
        <LinkButton href={sheet.evidencesLink}       label="Open Evidence Repository" />
      </div>
    </GlassCard>
  );
}

// ─── Status section builder (compact — for side-by-side layout) ───────────────
function StatusOverviewCompact({
  title, sheet, accent, heading,
}: {
  title: string;
  sheet: NonNullable<ReturnType<typeof useProjectStore>["state"]["merlinWorkbook"]["dailyStatus"]>;
  accent: string;
  heading?: string;
}) {
  const dark = useDark();
  const border = dc(dark, DARK.border, COLORS.border);
  const slate  = dc(dark, DARK.slate, COLORS.slate);
  const ink    = dc(dark, DARK.ink, COLORS.ink);

  return (
    <GlassCard className="p-4 h-full flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
        <div>
          <div className="text-[9px] font-bold tracking-widest uppercase mb-0.5" style={{ color: accent }}>{title}</div>
          <div className="htcc-display font-bold text-lg" style={{ color: ink }}>{heading ?? sheet.sitPct ?? "N/A"}</div>
          <div className="text-[10px]" style={{ color: slate }}>Overall Percentage</div>
        </div>
      </div>

      {/* Exec % + Pass % */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <KpiCardSm label="Execution %" raw={sheet.executionPct} color={accent}       suffix="%" />
        <KpiCardSm label="Pass %"      raw={sheet.passPct}      color={COLORS.green} suffix="%" />
      </div>

      {/* Count grid — compact 4-col */}
      <div className="grid grid-cols-4 gap-1.5 mb-3 flex-1">
        <KpiCardSm label="Total TC"    raw={sheet.totalTc}     color={accent}         icon={List} />
        <KpiCardSm label="Passed"      raw={sheet.pass}        color={COLORS.green}   icon={CheckCircle2} />
        <KpiCardSm label="Failed"      raw={sheet.fail}        color={COLORS.danger}  icon={AlertTriangle} />
        <KpiCardSm label="In Progress" raw={sheet.inProgress}  color={COLORS.blue}    icon={Clock} />
        <KpiCardSm label="Blocked"     raw={sheet.blocked}     color={COLORS.warning} icon={Bug} />
        <KpiCardSm label="Not Executed" raw={sheet.notExecuted} color={COLORS.slate}  />
        <KpiCardSm label="Descoped"    raw={sheet.descoped}    color={COLORS.faint}   />
        {sheet.na && <KpiCardSm label="NA" raw={sheet.na}      color={COLORS.faint}   />}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-1.5 pt-2.5" style={{ borderTop: `1px solid ${border}` }}>
        <LinkButton href={sheet.testExecutionLink}   label="Open Test Execution" />
        <LinkButton href={sheet.defectDashboardLink} label="Open Defect Dashboard" />
        <LinkButton href={sheet.evidencesLink}       label="Open Evidence Repository" />
      </div>
    </GlassCard>
  );
}

// ─── Defect table (paginated, filterable) ─────────────────────────────────────
const PAGE_SIZE = 20;
const DEF_COLS: { key: keyof MerlinDefect; label: string; mono?: boolean; w?: string }[] = [
  { key: "defectId",          label: "Defect ID",      mono: true, w: "100px" },
  { key: "summary",           label: "Summary",        w: "260px" },
  { key: "assignee",          label: "Assignee",       w: "130px" },
  { key: "reporter",          label: "Reporter",       w: "130px" },
  { key: "priority",          label: "Priority",       w: "100px" },
  { key: "severityRationale", label: "Sev. Rationale", w: "120px" },
  { key: "affectedOpco",      label: "Affected OpCo",  w: "110px" },
  { key: "status",            label: "Status",         w: "110px" },
  { key: "defectCreatedDate", label: "Created",        mono: true, w: "90px" },
  { key: "expectedFixDate",   label: "Expected Fix",   mono: true, w: "90px" },
  { key: "aging",             label: "Aging",          mono: true, w: "80px" },
  { key: "comments",          label: "Comments",       w: "200px" },
];

function DefectTable({ defects, openOnly = false }: { defects: MerlinDefect[]; openOnly?: boolean }) {
  const dark = useDark();
  const [q, setQ]         = useState("");
  const [statusF, setS]   = useState("All");
  const [priorityF, setP] = useState("All");
  const [assigneeF, setA] = useState("All");
  const [page, setPage]   = useState(1);

  const border = dc(dark, DARK.border, COLORS.border);
  const grid   = dc(dark, DARK.gridLine, "#EEF2F9");
  const ink    = dc(dark, DARK.ink, COLORS.ink);
  const faint  = dc(dark, DARK.faint, COLORS.faint);
  const cardBg = dc(dark, "rgba(5,18,10,0.55)", "rgba(255,255,255,0.55)");

  // If openOnly, pre-filter to open defects
  const sourceDefects = useMemo(
    () => openOnly ? defects.filter((d) => isOpenDefect(d.status)) : defects,
    [defects, openOnly]
  );

  const statuses   = useMemo(() => ["All", ...Array.from(new Set(sourceDefects.map((d) => d.status).filter(Boolean)))], [sourceDefects]);
  const priorities = useMemo(() => ["All", ...Array.from(new Set(sourceDefects.map((d) => d.priority).filter(Boolean)))], [sourceDefects]);
  const assignees  = useMemo(() => ["All", ...Array.from(new Set(sourceDefects.map((d) => d.assignee).filter(Boolean)))], [sourceDefects]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return sourceDefects.filter((d) => {
      if (statusF   !== "All" && d.status   !== statusF)   return false;
      if (priorityF !== "All" && d.priority !== priorityF) return false;
      if (assigneeF !== "All" && d.assignee !== assigneeF) return false;
      if (ql && !Object.values(d).some((v) => String(v).toLowerCase().includes(ql))) return false;
      return true;
    });
  }, [sourceDefects, q, statusF, priorityF, assigneeF]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // CSV export
  function exportCsv() {
    const head = DEF_COLS.map((c) => c.label).join(",");
    const rows = filtered.map((d) => DEF_COLS.map((c) => `"${String(d[c.key]).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([head + "\n" + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "merlin_defects.csv"; a.click();
  }

  if (sourceDefects.length === 0) {
    return openOnly
      ? <NoData msg="No open defects. All defects are resolved or closed." />
      : <NoData msg="No defects available. Upload the Merlin workbook to populate this table." />;
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search defects…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none"
            style={{ borderColor: border, background: cardBg, color: ink }}
          />
        </div>
        <select value={statusF} onChange={(e) => { setS(e.target.value); setPage(1); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: border, background: cardBg, color: ink }}>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={priorityF} onChange={(e) => { setP(e.target.value); setPage(1); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: border, background: cardBg, color: ink }}>
          {priorities.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={assigneeF} onChange={(e) => { setA(e.target.value); setPage(1); }}
          className="text-xs px-2.5 py-1.5 rounded-lg border outline-none"
          style={{ borderColor: border, background: cardBg, color: ink }}>
          {assignees.map((a) => <option key={a}>{a}</option>)}
        </select>
        <button onClick={exportCsv}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: COLORS.blueSoft, color: COLORS.blueDark }}>
          <Download size={11} /> Export CSV
        </button>
      </div>
      <div className="text-[10px]" style={{ color: faint }}>{filtered.length} defects found</div>

      {/* Table */}
      <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor: border }}>
        <table className="w-full text-[11px]" style={{ minWidth: 960 }}>
          <thead>
            <tr style={{ background: COLORS.blueSoft }}>
              {DEF_COLS.map((c) => (
                <th key={c.key} className="text-left px-2.5 py-2 font-semibold whitespace-nowrap"
                  style={{ color: COLORS.blueDark, minWidth: c.w }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={DEF_COLS.length} className="px-3 py-6 text-center text-xs" style={{ color: faint }}>No matching defects.</td></tr>
            ) : paged.map((d, i) => (
              <tr key={`${d.defectId}-${i}`} className="border-t row-hover" style={{ borderColor: grid }}>
                <td className="px-2.5 py-2 htcc-mono font-semibold whitespace-nowrap" style={{ color: COLORS.blue }}>{d.defectId || "—"}</td>
                <td className="px-2.5 py-2 max-w-[260px]" style={{ color: ink }}>
                  <span className="line-clamp-2" title={d.summary}>{d.summary || "—"}</span>
                </td>
                <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: ink }}>{d.assignee || "—"}</td>
                <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: ink }}>{d.reporter || "—"}</td>
                <td className="px-2.5 py-2"><PBadge p={d.priority} /></td>
                <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: ink }}>{d.severityRationale || "—"}</td>
                <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: ink }}>{d.affectedOpco || "—"}</td>
                <td className="px-2.5 py-2"><SBadge s={d.status} /></td>
                <td className="px-2.5 py-2 htcc-mono whitespace-nowrap" style={{ color: ink }}>{d.defectCreatedDate || "—"}</td>
                <td className="px-2.5 py-2 htcc-mono whitespace-nowrap" style={{ color: ink }}>{d.expectedFixDate || "—"}</td>
                <td className="px-2.5 py-2 htcc-mono text-center" style={{ color: ink }}>{d.aging || "—"}</td>
                <td className="px-2.5 py-2 max-w-[200px]" style={{ color: ink }}>
                  <span className="line-clamp-2" title={d.comments}>{d.comments || "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: faint }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs" style={{ color: faint }}>Page {page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: faint }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Day-wise progress section ────────────────────────────────────────────────
function DaywiseProgress({ defects }: { defects: MerlinDefect[] }) {
  const dark   = useDark();
  const faint  = dc(dark, DARK.faint, COLORS.faint);
  const ink    = dc(dark, DARK.ink, COLORS.ink);
  const border = dc(dark, DARK.border, COLORS.border);
  const grid   = dc(dark, DARK.gridLine, "#EEF2F9");
  const tt     = useTtStyle();

  const dates  = useMemo(() => getDefectDates(defects), [defects]);
  const trend  = useMemo(() => buildDefectTrend(defects), [defects]);

  const [selectedDate, setSelectedDate] = useState<string>("");

  const dailyDefects = useMemo(
    () => selectedDate ? defects.filter((d) => (d.defectCreatedDate || "").split("T")[0] === selectedDate) : [],
    [defects, selectedDate]
  );

  if (defects.length === 0) {
    return <NoData msg="No dated defect records available. Upload the Merlin workbook to view day-wise progress." />;
  }

  return (
    <div className="space-y-5">
      {/* Defects raised by day — area chart */}
      <ChartCard title="Defects Raised by Day (from Defects1!I — Created Date)">
        {trend.length === 0 ? <NoData msg="No dated defect records." /> : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="defTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={COLORS.blue} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={dc(dark, "#2A3A2A", "#EEF2F9")} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: faint }} />
              <YAxis tick={{ fontSize: 10, fill: faint }} allowDecimals={false} />
              <Tooltip contentStyle={tt} />
              <Area type="monotone" dataKey="count" name="Defects" stroke={COLORS.blue} fill="url(#defTrend)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Daily table — Date | Defects Raised | Critical | Major | In Progress | To Do */}
      <ChartCard title="Day-wise Defect Summary (from Defects1!I — Created Date)">
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: border }}>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ background: COLORS.blueSoft }}>
                {["Date", "Defects Raised", "Critical / P2", "Major / P3", "In Progress", "Reopened"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold" style={{ color: COLORS.blueDark }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((r) => {
                const dayDefs = defects.filter((d) => (d.defectCreatedDate || "").split("T")[0] === r.day);
                const critical  = dayDefs.filter((d) => d.priority.toLowerCase().includes("critical") || d.priority.toLowerCase().includes("p2")).length;
                const major     = dayDefs.filter((d) => d.priority.toLowerCase().includes("major") || d.priority.toLowerCase().includes("p3")).length;
                const inProg    = dayDefs.filter((d) => d.status.toLowerCase() === "in progress").length;
                const reopened  = dayDefs.filter((d) => d.status.toLowerCase() === "reopened").length;
                return (
                  <tr key={r.day} className="border-t row-hover" style={{ borderColor: grid }}>
                    <td className="px-3 py-1.5 htcc-mono" style={{ color: ink }}>{r.day}</td>
                    <td className="px-3 py-1.5 font-bold" style={{ color: COLORS.blue }}>{r.count}</td>
                    <td className="px-3 py-1.5 font-semibold" style={{ color: COLORS.danger }}>{critical || "—"}</td>
                    <td className="px-3 py-1.5 font-semibold" style={{ color: COLORS.warning }}>{major || "—"}</td>
                    <td className="px-3 py-1.5 font-semibold" style={{ color: COLORS.blue }}>{inProg || "—"}</td>
                    <td className="px-3 py-1.5 font-semibold" style={{ color: "#8A3FFC" }}>{reopened || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Date selector */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon size={15} style={{ color: COLORS.blue }} />
          <span className="text-sm font-bold" style={{ color: ink }}>Daily Date Selector</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {dates.map((d) => (
            <button key={d} onClick={() => setSelectedDate(d === selectedDate ? "" : d)}
              className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all"
              style={{
                background: d === selectedDate ? COLORS.blue : COLORS.blueSoft,
                color:       d === selectedDate ? "#fff" : COLORS.blueDark,
              }}>
              {d}
            </button>
          ))}
        </div>

        {selectedDate && (
          <div className="space-y-3">
            <div className="text-sm font-semibold" style={{ color: ink }}>
              Daily Defect Summary — <span style={{ color: COLORS.blue }}>{selectedDate}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl" style={{ background: COLORS.blueSoft }}>
                <div className="text-xs" style={{ color: COLORS.slate }}>Defects Raised</div>
                <div className="font-extrabold text-xl" style={{ color: COLORS.blueDark }}>{dailyDefects.length}</div>
              </div>
              {["Critical","Major","Minor"].map((p) => (
                <div key={p} className="p-3 rounded-xl" style={{ background: COLORS.blueSoft }}>
                  <div className="text-xs" style={{ color: COLORS.slate }}>{p}</div>
                  <div className="font-extrabold text-xl" style={{ color: PRIORITY_COLOR[p] ?? COLORS.slate }}>
                    {dailyDefects.filter((d) => d.priority.toLowerCase().includes(p.toLowerCase())).length}
                  </div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: border }}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ background: COLORS.blueSoft }}>
                    {["Issue Key","Summary","Assignee","Priority","Status"].map((h) => (
                      <th key={h} className="text-left px-2.5 py-1.5 font-semibold" style={{ color: COLORS.blueDark }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyDefects.map((d, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: grid }}>
                      <td className="px-2.5 py-1.5 htcc-mono font-semibold" style={{ color: COLORS.blue }}>{d.defectId}</td>
                      <td className="px-2.5 py-1.5 max-w-[220px] truncate" style={{ color: ink }}>{d.summary}</td>
                      <td className="px-2.5 py-1.5" style={{ color: ink }}>{d.assignee}</td>
                      <td className="px-2.5 py-1.5"><PBadge p={d.priority} /></td>
                      <td className="px-2.5 py-1.5"><SBadge s={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </GlassCard>

      {/* No historical execution trend disclaimer */}
      <GlassCard className="p-4 flex items-start gap-3">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: COLORS.warning }} />
        <div className="text-xs" style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>
          <strong>Historical Daily Execution Trend:</strong> The Daily Status and COA SIT sheets contain
          summary totals only — not a day-by-day execution log. Daily data above reflects defect creation
          dates (Defects!H). No artificial historical execution values are generated.
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function MerlinDashboard({ onImport, onNavigate }: { onImport?: () => void; onNavigate?: (page: string) => void }) {
  const dark  = useDark();
  const { state } = useProjectStore();
  const wb    = state.merlinWorkbook;
  const tt    = useTtStyle();

  const ink   = dc(dark, DARK.ink, COLORS.ink);
  const faint = dc(dark, DARK.faint, COLORS.faint);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!wb.fileName) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <SectionTitle eyebrow="MERLIN INTAKE V5 · GSIT" title="Merlin Intake V5 Dashboard" />
        <GlassCard className="p-0 overflow-hidden">
          <EmptyState
            icon={FileSpreadsheet}
            title="No Merlin Intake V5 Data Available"
            description="Import the Merlin Intake V5 Excel workbook from Excel Import Center to populate this dashboard."
            action={onImport ? { label: "Go to Excel Import Center", onClick: onImport } : undefined}
          />
        </GlassCard>
      </motion.div>
    );
  }

  const ds   = wb.dailyStatus;
  const coa  = wb.coaSit;
  const defs = wb.defects;

  // ── Build execution bar/pie data from Daily Status (C8:I8) ──────────────────
  const execBarData = ds ? [
    { name: "Passed",       value: toNum(ds.pass)        ?? 0, fill: COLORS.green   },
    { name: "Failed",       value: toNum(ds.fail)        ?? 0, fill: COLORS.danger  },
    { name: "In Progress",  value: toNum(ds.inProgress)  ?? 0, fill: COLORS.blue    },
    { name: "Blocked",      value: toNum(ds.blocked)     ?? 0, fill: COLORS.warning },
    { name: "Not Executed", value: toNum(ds.notExecuted) ?? 0, fill: COLORS.slate   },
    { name: "Descoped",     value: toNum(ds.descoped)    ?? 0, fill: "#8A3FFC"      },
    { name: "NA",           value: toNum(ds.na)          ?? 0, fill: COLORS.faint   },
  ].filter((d) => d.value > 0) : [];

  // ── COA SIT execution bar/pie data (COA SIT C8:I8) ──────────────────────────
  const coaBarData = coa ? [
    { name: "Passed",       value: toNum(coa.pass)        ?? 0, fill: COLORS.green   },
    { name: "Failed",       value: toNum(coa.fail)        ?? 0, fill: COLORS.danger  },
    { name: "In Progress",  value: toNum(coa.inProgress)  ?? 0, fill: COLORS.blue    },
    { name: "Blocked",      value: toNum(coa.blocked)     ?? 0, fill: COLORS.warning },
    { name: "Not Executed", value: toNum(coa.notExecuted) ?? 0, fill: COLORS.slate   },
    { name: "Descoped",     value: toNum(coa.descoped)    ?? 0, fill: "#8A3FFC"      },
    { name: "NA",           value: toNum(coa.na)          ?? 0, fill: COLORS.faint   },
  ].filter((d) => d.value > 0) : [];

  // ── Defect analytics ─────────────────────────────────────────────────────────
  const byPriority = useMemo(() => groupDefects(defs, "priority"),    [defs]);
  const byStatus   = useMemo(() => groupDefects(defs, "status"),      [defs]);
  const byAssignee = useMemo(() => groupDefects(defs, "assignee"),    [defs]);
  const byOpco     = useMemo(() => groupDefects(defs, "affectedOpco"),[defs]);

  // ── Defect in current release KPIs ───────────────────────────────────────────
  const totalDefs   = defs.length;
  const resolvedDefs = useMemo(() =>
    defs.filter((d) => {
      const s = d.status.toLowerCase();
      return s === "done" || s === "closed" || s === "resolved";
    }).length, [defs]);
  const openDefs = useMemo(() =>
    defs.filter((d) => isOpenDefect(d.status)).length, [defs]);
  const reopenedDefs = useMemo(() =>
    defs.filter((d) => d.status.toLowerCase() === "reopened").length, [defs]);
  const inProgressDefs = useMemo(() =>
    defs.filter((d) => d.status.toLowerCase() === "in progress").length, [defs]);
  const todoDefs = useMemo(() =>
    defs.filter((d) => d.status.toLowerCase() === "to do").length, [defs]);

  // ── Per-assignee breakdown: status columns ────────────────────────────────────
  type AssigneeRow = { assignee: string; open: number; inProgress: number; done: number; total: number };
  const byAssigneeBreakdown = useMemo((): AssigneeRow[] => {
    const map = new Map<string, AssigneeRow>();
    for (const d of defs) {
      const a = d.assignee || "Unassigned";
      if (!map.has(a)) map.set(a, { assignee: a, open: 0, inProgress: 0, done: 0, total: 0 });
      const row = map.get(a)!;
      row.total++;
      const s = d.status.toLowerCase();
      if (s === "done" || s === "closed" || s === "resolved") row.done++;
      else if (s === "in progress") row.inProgress++;
      else row.open++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [defs]);

  // ── Per-priority breakdown for the summary table ──────────────────────────────
  type PriorityRow = { priority: string; open: number; inProgress: number; done: number; total: number };
  const byPriorityBreakdown = useMemo((): PriorityRow[] => {
    const order = ["Critical", "Blocker", "Major", "Minor", "Trivial"];
    const map = new Map<string, PriorityRow>();
    for (const d of defs) {
      const p = d.priority || "Unknown";
      if (!map.has(p)) map.set(p, { priority: p, open: 0, inProgress: 0, done: 0, total: 0 });
      const row = map.get(p)!;
      row.total++;
      const s = d.status.toLowerCase();
      if (s === "done" || s === "closed" || s === "resolved") row.done++;
      else if (s === "in progress") row.inProgress++;
      else row.open++;
    }
    return Array.from(map.values()).sort((a, b) => {
      const ai = order.findIndex((o) => a.priority.toLowerCase().includes(o.toLowerCase()));
      const bi = order.findIndex((o) => b.priority.toLowerCase().includes(o.toLowerCase()));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [defs]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <SectionTitle
        eyebrow="MERLIN INTAKE V5 · GSIT"
        title="Merlin Intake V5 Dashboard"
        right={
          <div className="flex items-center gap-2 text-[10px]" style={{ color: faint }}>
            <span className="font-semibold">Merlin Intake Status Update</span>
            <span>·</span>
            <span>{defs.length} defects</span>
            <span>·</span>
            <span>Imported {new Date(wb.importedAt).toLocaleString()}</span>
          </div>
        }
      />

      {/* ── Key Highlights card ──────────────────────────────────────────────── */}
      {ds?.notes && (
        <GlassCard className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-sm font-bold tracking-widest uppercase mb-2" style={{ color: COLORS.blue }}>
                Key Highlights
              </div>
              <div className="text-sm leading-relaxed" style={{ color: ink }}>
                {ds.notes}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ── 1. SIT Summary + Defect Summary side by side ─────────────────────── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COLORS.green }}>
          SIT Executive Summary — Daily Status Sheet
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">

          {/* Left: compact SIT grid */}
          {ds ? (
            <StatusOverviewCompact title="SIT" sheet={ds} accent={COLORS.green} />
          ) : (
            <GlassCard className="p-4">
              <div className="text-sm" style={{ color: faint }}>Daily Status sheet not found.</div>
            </GlassCard>
          )}

          {/* Right: defect summary (KPI strip + Defects in Release + Priority donut) */}
          {defs.length > 0 ? (
            <div
              className="space-y-3 h-full rounded-2xl transition-all duration-200"
              onClick={() => onNavigate?.("defects")}
              title="Click to open Defect Command Center"
              style={{
                cursor: onNavigate ? "pointer" : "default",
                outline: `2px solid transparent`,
              }}
              onMouseEnter={(e) => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.outline = `2px solid ${COLORS.blue}`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.outline = "2px solid transparent"; }}
            >
              {/* Navigate hint */}
              {onNavigate && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: COLORS.blue }}>Defect Summary</span>
                  <span className="text-[9px] font-semibold flex items-center gap-1" style={{ color: COLORS.blue }}>
                    View in Defect Command Center →
                  </span>
                </div>
              )}
              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Total Defects", val: totalDefs,      color: COLORS.blue    },
                  { label: "Open",          val: openDefs,        color: COLORS.danger  },
                  { label: "In Progress",   val: inProgressDefs,  color: COLORS.blue    },
                  { label: "To Do",         val: todoDefs,        color: COLORS.warning },
                  { label: "Resolved",      val: resolvedDefs,    color: COLORS.green   },
                  { label: "Reopened",      val: reopenedDefs,    color: "#8A3FFC"      },
                ].map(({ label, val, color }) => (
                  <GlassCard key={label} className="p-2.5 text-center relative overflow-hidden">
                    <div className="blob w-12 h-12 -top-3 -right-3 absolute" style={{ background: color, opacity: 0.12 }} />
                    <div className="htcc-display font-extrabold text-xl relative" style={{ color }}>{val}</div>
                    <div className="text-[9px] font-semibold mt-0.5 relative leading-tight" style={{ color: faint }}>{label}</div>
                  </GlassCard>
                ))}
              </div>

              {/* Defects in Release + Priority donut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Defects in Current Release */}
                <GlassCard className="p-4">
                  <div className="text-[9px] font-bold tracking-widest uppercase mb-3" style={{ color: COLORS.blue }}>
                    Defects in Current Release
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: "Total Defects", val: totalDefs,    color: COLORS.blue   },
                      { label: "Resolved",      val: resolvedDefs, color: COLORS.green  },
                      { label: "Open",          val: openDefs,     color: COLORS.danger },
                      { label: "Reopened",      val: reopenedDefs, color: "#8A3FFC"     },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="p-2 rounded-xl border" style={{ borderColor: dc(dark, DARK.border, COLORS.border) }}>
                        <div className="text-[9px]" style={{ color: faint }}>{label}</div>
                        <div className="htcc-display font-extrabold text-lg" style={{ color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-semibold" style={{ color: faint }}>
                      <span>Resolution Progress</span>
                      <span style={{ color: COLORS.green }}>{totalDefs > 0 ? Math.round((resolvedDefs / totalDefs) * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dc(dark, "rgba(255,255,255,0.08)", "#F1F5F9") }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${totalDefs > 0 ? (resolvedDefs / totalDefs) * 100 : 0}%`, background: `linear-gradient(90deg, ${COLORS.green}, #00C97A)` }} />
                    </div>
                    <div className="flex justify-between text-[9px]" style={{ color: faint }}>
                      <span>Open: <strong style={{ color: COLORS.danger }}>{openDefs}</strong></span>
                      <span>In Prog: <strong style={{ color: COLORS.blue }}>{inProgressDefs}</strong></span>
                      <span>Resolved: <strong style={{ color: COLORS.green }}>{resolvedDefs}</strong></span>
                    </div>
                  </div>
                </GlassCard>

                {/* Priority donut */}
                <GlassCard className="p-4">
                  <div className="text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: COLORS.blue }}>
                    Priority Distribution
                  </div>
                  {byPriority.length === 0 ? <NoData /> : (
                    <div className="flex items-center gap-2">
                      <ResponsiveContainer width="55%" height={150}>
                        <PieChart>
                          <Pie data={byPriority} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" outerRadius={60} innerRadius={34} paddingAngle={3}>
                            {byPriority.map((e, i) => (
                              <Cell key={i} fill={PRIORITY_COLOR[e.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tt} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-1">
                        {byPriority.map((e, i) => {
                          const c = PRIORITY_COLOR[e.name] ?? CHART_COLORS[i % CHART_COLORS.length];
                          const pct = totalDefs > 0 ? Math.round((e.value / totalDefs) * 100) : 0;
                          return (
                            <div key={e.name} className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                                <span className="text-[9px] truncate" style={{ color: faint }}>{e.name}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] font-bold htcc-mono" style={{ color: c }}>{e.value}</span>
                                <span className="text-[8px]" style={{ color: faint }}>{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>
            </div>
          ) : (
            <GlassCard className="p-4">
              <NoData msg="No defects available. Upload the Merlin workbook to view defect summary." />
            </GlassCard>
          )}
        </div>
      </div>

      {/* ── 2. Merlin Defect List ─────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ink }}>
          Merlin Defect List
        </div>
        <GlassCard className="p-5">
          <div className="text-sm font-bold mb-4" style={{ color: ink }}>
            All Defects — {defs.length} records
          </div>
          <DefectTable defects={defs} />
        </GlassCard>
      </div>

      {/* ── 3. COA SIT Summary ───────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COLORS.blue }}>
          COA SIT Summary — COA SIT Sheet
        </div>
        {coa ? (
          <StatusOverviewCompact title="COA SIT" sheet={coa} accent={COLORS.blue} heading="COA-Agent SIT Testing" />
        ) : (
          <GlassCard className="p-4">
            <div className="text-sm" style={{ color: faint }}>COA SIT sheet not found in workbook.</div>
          </GlassCard>
        )}
      </div>

      {/* ── 4. Test Execution Analytics ──────────────────────────────────────── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ink }}>
          Testing Analytics
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* SIT execution bar */}
          <ChartCard title="SIT Execution Status">
            {execBarData.length === 0 ? <NoData msg="No SIT execution data." /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={execBarData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dc(dark, "#2A3A2A", "#EEF2F9")} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: faint }} />
                  <YAxis tick={{ fontSize: 10, fill: faint }} allowDecimals={false} />
                  <Tooltip contentStyle={tt} />
                  <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                    {execBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* SIT pie */}
          <ChartCard title="Merlin SIT Test Execution Distribution">
            {execBarData.length === 0 ? <NoData msg="No SIT execution data." /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={execBarData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={80} innerRadius={40} paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {execBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tt} formatter={(v: number, n: string) => [`${v}`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* COA SIT execution bar */}
          <ChartCard title="COA SIT Execution Status">
            {coaBarData.length === 0 ? <NoData msg="No COA SIT execution data." /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={coaBarData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dc(dark, "#2A3A2A", "#EEF2F9")} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: faint }} />
                  <YAxis tick={{ fontSize: 10, fill: faint }} allowDecimals={false} />
                  <Tooltip contentStyle={tt} />
                  <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                    {coaBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* COA SIT pie */}
          <ChartCard title="Merlin COA SIT Execution Distribution">
            {coaBarData.length === 0 ? <NoData msg="No COA SIT execution data." /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={coaBarData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={80} innerRadius={40} paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {coaBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tt} formatter={(v: number, n: string) => [`${v}`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* ── 5. Defect Analytics ──────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ink }}>
          Defect Analytics — Current Release
        </div>
        {defs.length === 0 ? (
          <GlassCard className="p-4">
            <NoData msg="No defects available. Upload the Merlin workbook to view defect analytics." />
          </GlassCard>
        ) : (
          <div className="space-y-5">

            {/* ── Row 1: KPI tiles ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Defects",  val: totalDefs,       color: COLORS.blue,    bg: COLORS.blueSoft    },
                { label: "Open",           val: openDefs,        color: COLORS.danger,  bg: "rgba(218,30,40,0.07)"  },
                { label: "In Progress",    val: inProgressDefs,  color: COLORS.blue,    bg: COLORS.blueSoft    },
                { label: "To Do",          val: todoDefs,        color: COLORS.warning, bg: "rgba(240,192,96,0.10)" },
                { label: "Resolved",       val: resolvedDefs,    color: COLORS.green,   bg: COLORS.greenSoft   },
                { label: "Reopened",       val: reopenedDefs,    color: "#8A3FFC",      bg: "rgba(138,63,252,0.08)" },
              ].map(({ label, val, color, bg }) => (
                <GlassCard key={label} className="p-4 text-center relative overflow-hidden">
                  <div className="blob w-16 h-16 -top-4 -right-4 absolute" style={{ background: color, opacity: 0.12 }} />
                  <div className="htcc-display font-extrabold text-2xl relative" style={{ color }}>{val}</div>
                  <div className="text-[10px] font-semibold mt-0.5 relative" style={{ color: faint }}>{label}</div>
                </GlassCard>
              ))}
            </div>

            {/* ── Row 2: Defects in Current Release (right) + Priority donut (left) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Defects in Current Release — KPI 2x2 + open bar */}
              <GlassCard className="p-5">
                <div className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: COLORS.blue }}>
                  Defects in Current Release
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Total Defects", val: totalDefs,    color: COLORS.blue    },
                    { label: "Resolved",      val: resolvedDefs, color: COLORS.green   },
                    { label: "Open",          val: openDefs,     color: COLORS.danger  },
                    { label: "Reopened",      val: reopenedDefs, color: "#8A3FFC"      },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="p-3 rounded-xl border" style={{ borderColor: dc(dark, DARK.border, COLORS.border) }}>
                      <div className="text-[10px]" style={{ color: faint }}>{label}</div>
                      <div className="htcc-display font-extrabold text-xl" style={{ color }}>{val}</div>
                    </div>
                  ))}
                </div>
                {/* Resolution progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-semibold" style={{ color: faint }}>
                    <span>Resolution Progress</span>
                    <span style={{ color: COLORS.green }}>{totalDefs > 0 ? Math.round((resolvedDefs / totalDefs) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: dc(dark, "rgba(255,255,255,0.08)", "#F1F5F9") }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${totalDefs > 0 ? (resolvedDefs / totalDefs) * 100 : 0}%`, background: `linear-gradient(90deg, ${COLORS.green}, #00C97A)` }} />
                  </div>
                  <div className="flex justify-between text-[10px]" style={{ color: faint }}>
                    <span>Open: <strong style={{ color: COLORS.danger }}>{openDefs}</strong></span>
                    <span>In Progress: <strong style={{ color: COLORS.blue }}>{inProgressDefs}</strong></span>
                    <span>Resolved: <strong style={{ color: COLORS.green }}>{resolvedDefs}</strong></span>
                  </div>
                </div>
              </GlassCard>

              {/* Priority distribution donut */}
              <GlassCard className="p-5">
                <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: COLORS.blue }}>
                  Priority Distribution
                </div>
                {byPriority.length === 0 ? <NoData /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={180}>
                      <PieChart>
                        <Pie data={byPriority} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" outerRadius={75} innerRadius={42} paddingAngle={3}>
                          {byPriority.map((e, i) => (
                            <Cell key={i} fill={PRIORITY_COLOR[e.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tt} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {byPriority.map((e, i) => {
                        const c = PRIORITY_COLOR[e.name] ?? CHART_COLORS[i % CHART_COLORS.length];
                        const pct = totalDefs > 0 ? Math.round((e.value / totalDefs) * 100) : 0;
                        return (
                          <div key={e.name} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
                              <span className="text-[10px] truncate" style={{ color: faint }}>{e.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] font-bold htcc-mono" style={{ color: c }}>{e.value}</span>
                              <span className="text-[9px]" style={{ color: faint }}>{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>

            {/* ── Row 3: Defects per Assignee breakdown table ──────────────── */}
            <GlassCard className="p-5">
              <div className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: COLORS.blue }}>
                Current Defects per Assignee
              </div>
              <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor: dc(dark, DARK.border, COLORS.border) }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: COLORS.blueSoft }}>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: COLORS.blueDark }}>Assignee</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: COLORS.danger   }}>OPEN</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: COLORS.blue     }}>IN PROGRESS</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: COLORS.green    }}>DONE</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: COLORS.blueDark }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byAssigneeBreakdown.map((row) => (
                      <tr key={row.assignee} className="border-t row-hover" style={{ borderColor: dc(dark, DARK.gridLine, "#EEF2F9") }}>
                        <td className="px-3 py-2 font-medium" style={{ color: dc(dark, DARK.ink, COLORS.ink) }}>{row.assignee}</td>
                        <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: row.open > 0 ? COLORS.danger : faint }}>{row.open || "—"}</td>
                        <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: row.inProgress > 0 ? COLORS.blue : faint }}>{row.inProgress || "—"}</td>
                        <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: row.done > 0 ? COLORS.green : faint }}>{row.done || "—"}</td>
                        <td className="px-3 py-2 text-center font-extrabold htcc-mono" style={{ color: dc(dark, DARK.ink, COLORS.ink) }}>{row.total}</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="border-t" style={{ borderColor: COLORS.blue, background: COLORS.blueSoft }}>
                      <td className="px-3 py-2 font-bold" style={{ color: COLORS.blueDark }}>Total Unique Issues</td>
                      <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: COLORS.danger }}>{openDefs}</td>
                      <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: COLORS.blue }}>{inProgressDefs}</td>
                      <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: COLORS.green }}>{resolvedDefs}</td>
                      <td className="px-3 py-2 text-center font-extrabold htcc-mono" style={{ color: COLORS.blueDark }}>{totalDefs}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-[10px]" style={{ color: faint }}>
                Grouped by: Assignee &nbsp;·&nbsp; Showing {byAssigneeBreakdown.length} of {byAssigneeBreakdown.length} assignees
              </div>
            </GlassCard>

            {/* ── Row 4: Defects per Priority breakdown table ──────────────── */}
            <GlassCard className="p-5">
              <div className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: COLORS.blue }}>
                Current Defects per Priority
              </div>
              <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor: dc(dark, DARK.border, COLORS.border) }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: COLORS.blueSoft }}>
                      <th className="text-left px-3 py-2 font-semibold" style={{ color: COLORS.blueDark }}>Priority</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: COLORS.danger   }}>OPEN</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: COLORS.blue     }}>IN PROGRESS</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: COLORS.green    }}>DONE</th>
                      <th className="text-center px-3 py-2 font-semibold" style={{ color: COLORS.blueDark }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPriorityBreakdown.map((row) => {
                      const c = PRIORITY_COLOR[row.priority] ?? COLORS.slate;
                      return (
                        <tr key={row.priority} className="border-t row-hover" style={{ borderColor: dc(dark, DARK.gridLine, "#EEF2F9") }}>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${c}18`, color: c }}>
                              {row.priority}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: row.open > 0 ? COLORS.danger : faint }}>{row.open || "—"}</td>
                          <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: row.inProgress > 0 ? COLORS.blue : faint }}>{row.inProgress || "—"}</td>
                          <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: row.done > 0 ? COLORS.green : faint }}>{row.done || "—"}</td>
                          <td className="px-3 py-2 text-center font-extrabold htcc-mono" style={{ color: dc(dark, DARK.ink, COLORS.ink) }}>{row.total}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t" style={{ borderColor: COLORS.blue, background: COLORS.blueSoft }}>
                      <td className="px-3 py-2 font-bold" style={{ color: COLORS.blueDark }}>Total</td>
                      <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: COLORS.danger }}>{openDefs}</td>
                      <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: COLORS.blue }}>{inProgressDefs}</td>
                      <td className="px-3 py-2 text-center font-bold htcc-mono" style={{ color: COLORS.green }}>{resolvedDefs}</td>
                      <td className="px-3 py-2 text-center font-extrabold htcc-mono" style={{ color: COLORS.blueDark }}>{totalDefs}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* ── Row 5: Status bar + Assignee horizontal bar ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="Defects by Status">
                {byStatus.length === 0 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byStatus} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dc(dark, "#2A3A2A", "#EEF2F9")} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: faint }} />
                      <YAxis tick={{ fontSize: 9, fill: faint }} allowDecimals={false} />
                      <Tooltip contentStyle={tt} />
                      <Bar dataKey="value" name="Count" radius={[3, 3, 0, 0]}>
                        {byStatus.map((e, i) => (
                          <Cell key={i} fill={STATUS_COLOR[e.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Open Defects per Assignee">
                {byAssignee.length === 0 ? <NoData /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={byAssigneeBreakdown.filter((r) => r.open > 0).map((r) => ({ name: r.assignee, value: r.open }))}
                      layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dc(dark, "#2A3A2A", "#EEF2F9")} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: faint }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: faint }} width={100} />
                      <Tooltip contentStyle={tt} />
                      <Bar dataKey="value" name="Open" fill={COLORS.danger} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* ── Row 6: Affected OpCo distribution bar ───────────────────── */}
            {byOpco.length > 0 && (
              <ChartCard title="Defects by Affected OpCo">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byOpco} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dc(dark, "#2A3A2A", "#EEF2F9")} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: faint }} />
                    <YAxis tick={{ fontSize: 9, fill: faint }} allowDecimals={false} />
                    <Tooltip contentStyle={tt} />
                    <Bar dataKey="value" name="Defects" fill={COLORS.blue} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

          </div>
        )}
      </div>

      {/* ── 6. Day-wise Progress ──────────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ink }}>
          Day-wise Progress
        </div>
        <DaywiseProgress defects={defs} />
      </div>

    </motion.div>
  );
}

// ─── Export helpers used by DefectCommandCenter ───────────────────────────────
export { isOpenDefect as merlinIsOpenDefect };
export type { MerlinDefect };
