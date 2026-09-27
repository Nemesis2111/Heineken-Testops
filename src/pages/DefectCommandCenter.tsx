import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, Bug, X, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import StatusTag from "../components/StatusTag";
import PriorityTag from "../components/PriorityTag";
import EmptyState from "../components/EmptyState";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { useActiveProject, groupBy, useProjectStore } from "../lib/ProjectStore";
import type { Defect } from "../types";
import { isOpenDefect } from "./MerlinDashboard";
import type { MerlinDefect } from "../lib/merlinTypes";

const DEFECT_COLUMNS = [
  { key: "key",        label: "Key",             mono: true },
  { key: "title",      label: "Title",           mono: false },
  { key: "assignee",   label: "Assignee",        mono: false },
  { key: "reporter",   label: "Reporter",        mono: false },
  { key: "sprint",     label: "Sprint",          mono: false },
  { key: "priority",   label: "Priority",        mono: false },
  { key: "labels",     label: "Labels",          mono: false },
  { key: "components", label: "Components",      mono: false },
  { key: "status",     label: "Status",          mono: false },
  { key: "progress",   label: "Progress %",      mono: false },
  { key: "targetEnd",  label: "Target End Date", mono: true },
  { key: "estimate",   label: "Estimate (d)",    mono: false },
];

const BUCKETS = ["To Do", "In Progress", "Ready for review", "Done"];
const bucketOf = (status: string) => (BUCKETS.includes(status) ? status : "To Do");

// ─── Merlin Open Defect Modal ─────────────────────────────────────────────────

const OPEN_DEF_COLS: { key: keyof MerlinDefect; label: string; mono?: boolean }[] = [
  { key: "defectId",         label: "Defect ID",    mono: true },
  { key: "summary",          label: "Summary" },
  { key: "assignee",         label: "Assignee" },
  { key: "reporter",         label: "Reporter" },
  { key: "priority",         label: "Priority" },
  { key: "affectedOpco",     label: "OpCo" },
  { key: "status",           label: "Status" },
  { key: "defectCreatedDate", label: "Created",     mono: true },
  { key: "expectedFixDate",  label: "Expected Fix", mono: true },
  { key: "aging",            label: "Aging",        mono: true },
  { key: "comments",         label: "Comments" },
];

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
  const STATUS_COLOR: Record<string, string> = {
    "To Do": COLORS.slate, "In Progress": COLORS.blue,
    "Done": COLORS.green, "Blocked": COLORS.danger,
  };
  const c = STATUS_COLOR[s] ?? COLORS.slate;
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${c}18`, color: c }}>
      {s || "—"}
    </span>
  );
}

function MerlinOpenDefectsModal({
  defects, onClose,
}: {
  defects: MerlinDefect[];
  onClose: () => void;
}) {
  const dark   = useDark();
  const ink    = dc(dark, DARK.ink, COLORS.ink);
  const faint  = dc(dark, DARK.faint, COLORS.faint);
  const border = dc(dark, DARK.border, COLORS.border);
  const grid   = dc(dark, DARK.gridLine, "#EEF2F9");
  const cardBg = dc(dark, "rgba(10,24,15,0.97)", "rgba(255,255,255,0.98)");

  const [filterStatus,   setFilterStatus]   = useState("All Open");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterAssignee, setFilterAssignee] = useState("All");

  const openDefects = useMemo(() => defects.filter((d) => isOpenDefect(d.status)), [defects]);
  const statuses   = useMemo(() => ["All Open", ...Array.from(new Set(openDefects.map((d) => d.status).filter(Boolean)))], [openDefects]);
  const priorities = useMemo(() => ["All", ...Array.from(new Set(openDefects.map((d) => d.priority).filter(Boolean)))], [openDefects]);
  const assignees  = useMemo(() => ["All", ...Array.from(new Set(openDefects.map((d) => d.assignee).filter(Boolean)))], [openDefects]);

  const filtered = useMemo(() => {
    return openDefects.filter((d) => {
      if (filterStatus !== "All Open" && d.status !== filterStatus) return false;
      if (filterPriority !== "All" && d.priority !== filterPriority) return false;
      if (filterAssignee !== "All" && d.assignee !== filterAssignee) return false;
      return true;
    });
  }, [openDefects, filterStatus, filterPriority, filterAssignee]);

  const ttStyle = { borderRadius: 10, fontSize: 12, background: dc(dark, DARK.surface, "#fff"), color: dc(dark, DARK.body, COLORS.ink) };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="w-full max-w-5xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden"
        style={{ background: cardBg, border: `1px solid ${border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: COLORS.blue }}>
              MERLIN INTAKE V5
            </div>
            <div className="text-lg font-extrabold" style={{ color: ink }}>Open Defects</div>
            <div className="text-xs mt-0.5" style={{ color: faint }}>{openDefects.length} open · {filtered.length} shown</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:opacity-70" style={{ color: faint }}>
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 px-6 py-3" style={{ borderBottom: `1px solid ${border}` }}>
          {statuses.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all"
              style={{
                background: filterStatus === s ? COLORS.blue : dc(dark, "rgba(15,98,254,0.10)", COLORS.blueSoft),
                color: filterStatus === s ? "#fff" : COLORS.blueDark,
              }}>
              {s}
            </button>
          ))}
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
            className="text-xs px-2.5 py-1 rounded-lg border outline-none ml-auto"
            style={{ borderColor: border, background: dc(dark, "rgba(5,18,10,0.6)", "#fff"), color: ink }}>
            {priorities.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
            className="text-xs px-2.5 py-1 rounded-lg border outline-none"
            style={{ borderColor: border, background: dc(dark, "rgba(5,18,10,0.6)", "#fff"), color: ink }}>
            {assignees.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6 pt-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Bug size={24} style={{ color: faint, opacity: 0.4 }} />
              <div className="text-sm font-semibold" style={{ color: faint }}>No open defects match the current filter.</div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: border }}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ background: COLORS.blueSoft }}>
                    {OPEN_DEF_COLS.map((c) => (
                      <th key={c.key} className="text-left px-2.5 py-2 font-semibold whitespace-nowrap" style={{ color: COLORS.blueDark }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => (
                    <tr key={`${d.defectId}-${i}`} className="border-t row-hover" style={{ borderColor: grid }}>
                      <td className="px-2.5 py-2 htcc-mono font-semibold whitespace-nowrap" style={{ color: COLORS.blue }}>{d.defectId || "—"}</td>
                      <td className="px-2.5 py-2 max-w-[260px]" style={{ color: ink }}>
                        <span className="line-clamp-2" title={d.summary}>{d.summary || "—"}</span>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: ink }}>{d.assignee || "—"}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: ink }}>{d.reporter || "—"}</td>
                      <td className="px-2.5 py-2"><PBadge p={d.priority} /></td>
                      <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: ink }}>{d.affectedOpco || "—"}</td>
                      <td className="px-2.5 py-2"><SBadge s={d.status} /></td>
                      <td className="px-2.5 py-2 htcc-mono whitespace-nowrap" style={{ color: ink }}>{d.defectCreatedDate || "—"}</td>
                      <td className="px-2.5 py-2 htcc-mono whitespace-nowrap" style={{ color: ink }}>{d.expectedFixDate || "—"}</td>
                      <td className="px-2.5 py-2 htcc-mono text-center" style={{ color: ink }}>{d.aging || "—"}</td>
                      <td className="px-2.5 py-2 max-w-[180px]" style={{ color: ink }}>
                        <span className="line-clamp-2" title={d.comments}>{d.comments || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Merlin Open Defects Tile ─────────────────────────────────────────────────

function MerlinOpenDefectsTile({ defects }: { defects: MerlinDefect[] }) {
  const dark   = useDark();
  const ink    = dc(dark, DARK.ink, COLORS.ink);
  const faint  = dc(dark, DARK.faint, COLORS.faint);
  const border = dc(dark, DARK.border, COLORS.border);

  const [modalOpen, setModalOpen] = useState(false);

  const openDefects = useMemo(() => defects.filter((d) => isOpenDefect(d.status)), [defects]);

  // Count by priority and status among open defects
  const critical   = useMemo(() => openDefects.filter((d) => d.priority.toLowerCase().includes("critical") || d.priority.toLowerCase().includes("p2")).length, [openDefects]);
  const major      = useMemo(() => openDefects.filter((d) => d.priority.toLowerCase().includes("major") || d.priority.toLowerCase().includes("p3")).length, [openDefects]);
  const reopened   = useMemo(() => openDefects.filter((d) => d.status.toLowerCase() === "reopened").length, [openDefects]);
  const inProgress = useMemo(() => openDefects.filter((d) => d.status.toLowerCase() === "in progress").length, [openDefects]);

  // If no data at all, show empty state
  if (defects.length === 0) {
    return (
      <GlassCard className="p-5">
        <div className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: COLORS.blue }}>
          MERLIN INTAKE V5
        </div>
        <div className="text-sm font-bold mb-3" style={{ color: ink }}>Open Defects</div>
        <div className="text-xs py-6 text-center" style={{ color: faint }}>
          No Merlin Intake V5 data available.
          <br />Import the Merlin Intake V5 Excel workbook from Excel Import Center.
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard className="p-0 overflow-hidden">
        <div className="p-5 cursor-pointer" onClick={() => setModalOpen(true)}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: COLORS.blue }}>
                MERLIN INTAKE V5
              </div>
              <div className="text-sm font-bold" style={{ color: ink }}>Open Defects</div>
            </div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: COLORS.blueSoft }}>
              <Bug size={15} style={{ color: COLORS.blue }} />
            </div>
          </div>

          {/* Big count */}
          <div className="htcc-display font-extrabold text-4xl mb-4" style={{ color: openDefects.length > 0 ? COLORS.danger : COLORS.green }}>
            {openDefects.length}
          </div>

          {/* Breakdown */}
          {openDefects.length === 0 ? (
            <div className="text-xs py-2 text-center" style={{ color: faint }}>No open defects</div>
          ) : (
            <div className="space-y-1.5 mb-4">
              {[
                { label: "Critical / P2", count: critical,   color: COLORS.danger },
                { label: "Major / P3",    count: major,      color: COLORS.warning },
                { label: "Reopened",      count: reopened,   color: "#8A3FFC" },
                { label: "In Progress",   count: inProgress, color: COLORS.blue },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span style={{ color: faint }}>{label}</span>
                  <span className="font-bold htcc-mono" style={{ color }}>{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="flex items-center gap-1 text-xs font-semibold pt-3"
            style={{ borderTop: `1px solid ${border}`, color: COLORS.blue }}>
            View Open Defects
            <ChevronRight size={13} />
          </div>
        </div>
      </GlassCard>

      <AnimatePresence>
        {modalOpen && (
          <MerlinOpenDefectsModal defects={defects} onClose={() => setModalOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main DefectCommandCenter ─────────────────────────────────────────────────

export default function DefectCommandCenter() {
  const dark = useDark();
  const { meta, store, id } = useActiveProject();
  const { state } = useProjectStore();
  const merlinDefects = state.merlinWorkbook.defects;

  const [localDefects, setLocalDefects] = useState<Defect[]>(store.defects);
  const [view, setView] = useState<"board" | "table" | "analytics">("board");
  const dragKey = useRef<string | null>(null);

  // Sync when active project changes
  React.useEffect(() => { setLocalDefects(store.defects); }, [id, store.defects]);

  const accent      = dc(dark, DARK.blue, COLORS.blue);
  const accentDark  = dc(dark, DARK.blue, COLORS.blueDark);
  const accentSoft  = dc(dark, "rgba(240,192,96,0.12)", COLORS.blueSoft);
  const inkColor    = dc(dark, DARK.ink, COLORS.ink);
  const slateColor  = dc(dark, DARK.slate, COLORS.slate);
  const faintColor  = dc(dark, DARK.faint, COLORS.faint);
  const borderColor = dc(dark, DARK.border, COLORS.border);
  const gridLine    = dc(dark, DARK.gridLine, "#EEF2F9");
  const tooltipStyle = { borderRadius: 12, fontSize: 12, background: dc(dark, DARK.surface, "#fff"), color: dc(dark, DARK.body, COLORS.ink) };
  const boardBg     = dc(dark, "rgba(5,18,10,0.55)", "rgba(255,255,255,0.45)");

  const bucketColors: Record<string, string> = {
    "To Do": COLORS.faint,
    "In Progress": COLORS.blue,
    "Ready for review": COLORS.warning,
    "Done": COLORS.green,
  };

  const onDrop = (bucket: string) => {
    if (!dragKey.current) return;
    setLocalDefects((prev) => prev.map((d) => (d.key === dragKey.current ? { ...d, status: bucket } : d)));
    dragKey.current = null;
  };

  const visibleColumns = useMemo(
    () => DEFECT_COLUMNS.filter((c) => localDefects.some((d: any) => d[c.key] !== undefined && d[c.key] !== "" && d[c.key] !== null)),
    [localDefects]
  );

  const priorityDist = useMemo(() => groupBy(localDefects as unknown as Record<string, unknown>[], "priority"), [localDefects]);
  const statusDist   = BUCKETS.map((s) => ({ name: s, value: localDefects.filter((d) => bucketOf(d.status) === s).length }));
  const sprintDist   = useMemo(() => groupBy(localDefects as unknown as Record<string, unknown>[], "sprint").slice(0, 6), [localDefects]);
  const assigneeDist = useMemo(() => groupBy(localDefects as unknown as Record<string, unknown>[], "assignee").slice(0, 6).map((d) => ({ ...d, name: d.name.split(" ")[0] })), [localDefects]);

  const PIE_COLORS = [accent, COLORS.green, COLORS.warning, COLORS.danger, faintColor];

  // ── Show Merlin tile prominently when no active-project defects exist ─────
  if (localDefects.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <SectionTitle eyebrow={`DEFECT MANAGEMENT · ${meta.name.toUpperCase()}`} title="Defect Command Center" />

        {/* Merlin Intake V5 Open Defects Tile — always shown */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COLORS.blue }}>
            Project Tiles
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MerlinOpenDefectsTile defects={merlinDefects} />
          </div>
        </div>

        <EmptyState
          icon={Bug}
          title="No defects loaded for this project"
          description={`Import a Jira defect export (CSV/XLSX) for ${meta.name} to populate the kanban board, table view, and analytics.`}
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionTitle
        eyebrow={`DEFECT MANAGEMENT · ${meta.name.toUpperCase()}`}
        title="Defect Command Center"
        right={
          <div className="flex gap-2">
            {(["board", "table", "analytics"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize"
                style={view === v
                  ? { background: accent, color: dark ? "#051409" : "white" }
                  : { background: dc(dark, "rgba(5,18,10,0.6)", "rgba(255,255,255,.6)"), color: slateColor, border: `1px solid ${borderColor}` }
                }
              >
                {v}
              </button>
            ))}
          </div>
        }
      />

      {/* ── Merlin Intake V5 Open Defects Tile ───────────────────────────────── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: COLORS.blue }}>
          Project Tiles
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MerlinOpenDefectsTile defects={merlinDefects} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {BUCKETS.map((bucket) => {
          const cnt = localDefects.filter((d) => bucketOf(d.status) === bucket).length;
          return (
            <GlassCard key={bucket} className="p-3">
              <div className="htcc-display text-xl font-extrabold" style={{ color: bucketColors[bucket] }}>{cnt}</div>
              <div className="text-[10px] font-semibold mt-0.5" style={{ color: slateColor }}>{bucket}</div>
            </GlassCard>
          );
        })}
      </div>

      {/* Board view */}
      {view === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {BUCKETS.map((bucket) => {
            const items = localDefects.filter((d) => bucketOf(d.status) === bucket);
            return (
              <div key={bucket} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(bucket)}
                className="rounded-2xl p-3 min-h-[300px]"
                style={{ background: boardBg, border: `1px dashed ${borderColor}` }}>
                <div className="flex items-center justify-between px-1 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: bucketColors[bucket] }}>{bucket}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: accentSoft, color: accentDark }}>{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((d) => (
                    <div key={d.key} draggable onDragStart={() => (dragKey.current = d.key)}
                      className="kanban-card glass-hover glass rounded-xl p-3 cursor-grab">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="htcc-mono text-[10px] font-semibold" style={{ color: accent }}>{d.key}</span>
                        <GripVertical size={12} style={{ color: faintColor }} />
                      </div>
                      <div className="text-xs font-semibold leading-snug mb-2" style={{ color: inkColor }}>{d.title}</div>
                      <div className="flex items-center justify-between">
                        <PriorityTag p={d.priority} />
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: COLORS.greenSoft, color: COLORS.greenDark }}>
                          {d.assignee.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                      </div>
                      <div className="text-[10px] mt-1.5 truncate" style={{ color: faintColor }}>{d.sprint}</div>
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-center py-8 text-[10px]" style={{ color: faintColor }}>Drop cards here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {view === "table" && (
        <GlassCard className="p-4">
          <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: dc(dark, "rgba(0,135,61,0.15)", COLORS.greenSoft) }}>
                  {visibleColumns.map((c) => (
                    <th key={c.key} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: dc(dark, DARK.green, COLORS.greenDark) }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {localDefects.map((d) => (
                  <tr key={d.key} className="row-hover border-t" style={{ borderColor: gridLine }}>
                    {visibleColumns.map((c) => (
                      <td key={c.key} className={`px-3 py-2.5 whitespace-nowrap ${c.mono ? "htcc-mono" : ""}`} style={{ color: dc(dark, DARK.body, "inherit") }}>
                        {c.key === "status" ? (
                          <StatusTag status={d.status === "To Do" ? "Not Run" : d.status === "In Progress" ? "In Progress" : d.status === "Done" ? "Passed" : "Blocked"} />
                        ) : c.key === "priority" ? (
                          <PriorityTag p={d.priority} />
                        ) : c.key === "progress" ? (
                          <div className="flex items-center gap-2 w-24">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: dc(dark, "rgba(0,135,61,0.15)", "#F1F5F9") }}>
                              <div className="h-full rounded-full" style={{ width: `${d.progress}%`, background: accent }} />
                            </div>
                            <span className="text-[10px]" style={{ color: slateColor }}>{d.progress}%</span>
                          </div>
                        ) : (
                          String((d as any)[c.key])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Analytics view */}
      {view === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <GlassCard className="p-5">
            <SectionTitle title="Priority Distribution" />
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={priorityDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {priorityDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: slateColor }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle title="Status Distribution" />
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {statusDist.map((_, i) => <Cell key={i} fill={[COLORS.faint, COLORS.blue, COLORS.warning, COLORS.green][i % 4]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: slateColor }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle title="Defects by Sprint" />
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={sprintDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: faintColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: faintColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={accent} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle title="Defects by Assignee" />
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={assigneeDist} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: faintColor }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: faintColor }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={COLORS.green} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}
    </motion.div>
  );
}
