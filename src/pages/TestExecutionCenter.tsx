import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search, SlidersHorizontal, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, ListChecks,
} from "lucide-react";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import StatusTag from "../components/StatusTag";
import EmptyState from "../components/EmptyState";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { useActiveProject, computeKPIs, getPhases } from "../lib/ProjectStore";
import { STATUSES } from "../data/projectsConfig";
import type { TestCase } from "../types";

const ALL_COLUMNS = [
  { key: "directory",           label: "tDirectory",            default: true,  mono: true },
  { key: "id",                  label: "Id",                    default: true,  mono: true },
  { key: "name",                label: "Name",                  default: true,  mono: false },
  { key: "status",              label: "Status",                default: true,  mono: false },
  { key: "testCaseVersion",     label: "Test Case Version",     default: true,  mono: true },
  { key: "assignedTo",          label: "Assigned To",           default: true,  mono: false },
  { key: "execStart",           label: "Executed Start",        default: true,  mono: true },
  { key: "execEnd",             label: "Executed End",          default: true,  mono: true },
  { key: "planStart",           label: "Planned Start Date",    default: false, mono: true },
  { key: "planEnd",             label: "Planned End Date",      default: false, mono: true },
  { key: "defects",             label: "Defects",               default: true,  mono: false },
  { key: "defectIds",           label: "Defect IDs",            default: true,  mono: true },
  { key: "requirements",        label: "Requirements",          default: false, mono: true },
  { key: "testStepNum",         label: "Test Step #",           default: false, mono: true },
  { key: "testStepDescription", label: "Test Step Description", default: false, mono: false },
  { key: "testStep",            label: "Test Step",             default: false, mono: true },
];

export default function TestExecutionCenter() {
  const dark = useDark();
  const { meta, store } = useActiveProject();
  const { executions } = store;

  const phases = useMemo(() => getPhases(executions), [executions]);
  const [phase, setPhase] = useState<string>("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [showCols, setShowCols] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>(ALL_COLUMNS.filter((c) => c.default).map((c) => c.key));
  const pageSize = 10;

  // auto-select first phase when phases change
  const activePhase = phases.includes(phase) ? phase : (phases[0] ?? "");

  const handlePhase = (p: string) => { setPhase(p); setPage(1); };

  const phaseCases = useMemo(
    () => activePhase ? executions.filter((t) => t.phase === activePhase) : executions,
    [executions, activePhase]
  );

  const assignees = useMemo(() => ["All", ...Array.from(new Set(phaseCases.map((t) => t.assignedTo)))], [phaseCases]);

  const stats = useMemo(() => computeKPIs(phaseCases, []), [phaseCases]);

  const filtered = useMemo(() => {
    let rows = phaseCases.filter((t) =>
      (statusFilter === "All" || t.status === statusFilter) &&
      (assigneeFilter === "All" || t.assignedTo === assigneeFilter) &&
      (
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.id.toLowerCase().includes(query.toLowerCase()) ||
        t.directory.toLowerCase().includes(query.toLowerCase()) ||
        (t.defectIds && t.defectIds.toLowerCase().includes(query.toLowerCase()))
      )
    );
    rows = [...rows].sort((a: any, b: any) => {
      const va = String(a[sortKey] ?? ""), vb = String(b[sortKey] ?? "");
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return rows;
  }, [phaseCases, query, statusFilter, assigneeFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const toggleCol = (key: string) =>
    setVisibleCols((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]));

  const handleExport = () => {
    const cols = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key));
    const header = cols.map((c) => c.label).join(",");
    const body = filtered.map((row) =>
      cols.map((c) => {
        const val = (row as any)[c.key] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")
    ).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${meta.name.replace(/\s+/g, "_")}_executions.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const accent      = dc(dark, DARK.blue, COLORS.blue);
  const accentDark  = dc(dark, DARK.blue, COLORS.blueDark);
  const accentSoft  = dc(dark, "rgba(240,192,96,0.12)", COLORS.blueSoft);
  const inkColor    = dc(dark, DARK.ink, COLORS.ink);
  const slateColor  = dc(dark, DARK.slate, COLORS.slate);
  const faintColor  = dc(dark, DARK.faint, COLORS.faint);
  const borderColor = dc(dark, DARK.border, COLORS.border);
  const gridLine    = dc(dark, DARK.gridLine, "#EEF2F9");
  const cardBg      = dc(dark, "rgba(5,18,10,0.88)", "rgba(255,255,255,0.6)");

  if (executions.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <SectionTitle eyebrow={`TEST EXECUTION · ${meta.name.toUpperCase()}`} title="Test Execution Center" />
        <EmptyState
          icon={ListChecks}
          title="No test executions loaded"
          description={`Import a test execution Excel or CSV file for ${meta.name} to view and filter all test cases.`}
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionTitle eyebrow={`TEST EXECUTION · ${meta.name.toUpperCase()}`} title="Test Execution Center" />

      {/* Phase tabs */}
      {phases.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {phases.map((p) => (
            <button
              key={p}
              onClick={() => handlePhase(p)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={
                activePhase === p
                  ? {
                      background: dark
                        ? `linear-gradient(135deg, ${DARK.green}, #00873D)`
                        : `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.blueDark})`,
                      color: dark ? "#051409" : "white",
                      boxShadow: dark
                        ? "0 6px 18px -6px rgba(0,135,61,.55)"
                        : "0 6px 18px -6px rgba(15,98,254,.55)",
                    }
                  : { background: cardBg, color: slateColor, border: `1px solid ${borderColor}` }
              }
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <GlassCard className="p-5 lg:col-span-1 flex flex-col items-center justify-center">
            <CompletionRing
              value={stats.completion}
              color={accent}
              trackColor={dc(dark, DARK.gaugeTrack, "#E8EEF8")}
              subColor={slateColor}
              label={`${activePhase || "All"} Completion`}
            />
          </GlassCard>

          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Cases", val: stats.total,      color: inkColor },
              { label: "Passed",      val: stats.passed,     color: COLORS.green },
              { label: "Failed",      val: stats.failed,     color: COLORS.danger },
              { label: "Blocked",     val: stats.blocked,    color: COLORS.warning },
              { label: "In Progress", val: stats.inProgress, color: accent },
            ].map((s) => (
              <GlassCard key={s.label} className="p-4">
                <div className="htcc-display text-2xl font-extrabold" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[11px] font-medium mt-1" style={{ color: slateColor }}>{s.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* Table card */}
      <GlassCard className="p-4">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: faintColor }} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by ID, name, directory, defect…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border outline-none"
              style={{ borderColor, background: cardBg, color: inkColor }}
            />
            {query && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => { setQuery(""); setPage(1); }}>
                <X size={12} style={{ color: faintColor }} />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm border outline-none"
            style={{ borderColor, background: cardBg, color: slateColor }}
          >
            <option>All</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>

          <select
            value={assigneeFilter}
            onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm border outline-none"
            style={{ borderColor, background: cardBg, color: slateColor }}
          >
            {assignees.map((a) => <option key={a}>{a}</option>)}
          </select>

          <div className="relative">
            <button
              onClick={() => setShowCols(!showCols)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border"
              style={{ borderColor, background: cardBg, color: slateColor }}
            >
              <SlidersHorizontal size={14} /> Columns
            </button>
            {showCols && (
              <div className="absolute right-0 mt-2 w-64 glass rounded-xl p-2 z-20 max-h-80 overflow-y-auto htcc-scroll shadow-xl">
                <div className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 mb-1" style={{ color: faintColor }}>
                  Toggle Columns
                </div>
                {ALL_COLUMNS.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer"
                    style={{ color: slateColor }}
                  >
                    <input type="checkbox" checked={visibleCols.includes(c.key)} onChange={() => toggleCol(c.key)} className="rounded" />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white btn-green">
            <Download size={14} /> Export
          </button>
        </div>

        <div className="text-[11px] mb-2" style={{ color: faintColor }}>
          Showing {filtered.length} of {phaseCases.length} test cases {query || statusFilter !== "All" || assigneeFilter !== "All" ? "· (filtered)" : ""}
        </div>

        <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor, maxHeight: "62vh", overflowY: "auto" }}>
          <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10" style={{ background: dc(dark, DARK.surface, "#F5F8FD") }}>
              <tr style={{ background: accentSoft }}>
                {ALL_COLUMNS.filter((c) => visibleCols.includes(c.key)).map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className="text-left px-3 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap"
                    style={{ color: accentDark, borderBottom: `1px solid ${borderColor}` }}
                  >
                    <span className="flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key ? sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} /> : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="row-hover border-t cursor-pointer" style={{ borderColor: gridLine }}>
                  {ALL_COLUMNS.filter((c) => visibleCols.includes(c.key)).map((c) => (
                    <td key={c.key} className={`px-3 py-2.5 whitespace-nowrap ${c.mono ? "htcc-mono" : ""}`} style={{ color: dc(dark, DARK.body, COLORS.slate) }}>
                      {c.key === "status" ? (
                        <StatusTag status={row.status} />
                      ) : c.key === "defects" && (row.defects ?? 0) > 0 ? (
                        <span className="font-bold text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: `${COLORS.danger}18`, color: COLORS.danger }}>
                          {row.defects}
                        </span>
                      ) : c.key === "defectIds" && row.defectIds && row.defectIds !== "-" ? (
                        <span className="text-[11px] font-semibold" style={{ color: COLORS.blue }}>{row.defectIds}</span>
                      ) : (
                        String((row as any)[c.key] ?? "-")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={visibleCols.length} className="text-center py-12" style={{ color: faintColor }}>
                    <div className="flex flex-col items-center gap-2">
                      <Search size={24} style={{ opacity: 0.3 }} />
                      <span>No test cases match your filters.</span>
                      <button onClick={() => { setQuery(""); setStatusFilter("All"); setAssigneeFilter("All"); }} className="text-xs underline" style={{ color: accent }}>
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-3 text-xs" style={{ color: slateColor }}>
          <span>
            Showing {pageRows.length > 0 ? (page - 1) * pageSize + 1 : 0}–{(page - 1) * pageSize + pageRows.length} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage(1)} className="px-2 py-1 rounded-lg disabled:opacity-30" style={{ color: slateColor }}>«</button>
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: slateColor }}><ChevronLeft size={14} /></button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
              return (
                <button key={pg} onClick={() => setPage(pg)} className="w-7 h-7 rounded-lg text-xs font-medium"
                  style={{ background: pg === page ? (dark ? DARK.blue : COLORS.blue) : "transparent", color: pg === page ? (dark ? "#051409" : "white") : slateColor }}>
                  {pg}
                </button>
              );
            })}
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: slateColor }}><ChevronRight size={14} /></button>
            <button disabled={page === totalPages} onClick={() => setPage(totalPages)} className="px-2 py-1 rounded-lg disabled:opacity-30" style={{ color: slateColor }}>»</button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function CompletionRing({ value, color, trackColor, subColor, label }: { value: number; color: string; trackColor: string; subColor: string; label: string }) {
  const size = 148;
  const cx = size / 2, cy = size / 2;
  const strokeW = size * 0.095;
  const r = (size - strokeW) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, value)) / 100) * circ;
  const valSize = Math.round(size * 0.22);
  const subSize = Math.round(size * 0.10);
  const lblSize = Math.round(size * 0.088);
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeW} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`, transition: "stroke-dasharray 0.6s ease" }} />
        <text x={cx} y={cy - subSize * 0.5} textAnchor="middle" dominantBaseline="middle"
          fontFamily="'Sora', ui-sans-serif" fontWeight={800} fontSize={valSize} fill={color}>{value}%</text>
        <text x={cx} y={cy + valSize * 0.45} textAnchor="middle" dominantBaseline="middle"
          fontFamily="'Inter', ui-sans-serif" fontWeight={500} fontSize={subSize} fill={subColor}>complete</text>
      </svg>
      <span style={{ fontSize: lblSize, fontWeight: 600, color: subColor, textAlign: "center" }}>{label}</span>
    </div>
  );
}
