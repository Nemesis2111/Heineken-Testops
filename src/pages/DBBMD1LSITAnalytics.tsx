import React, { useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";
import {
  MapPin, Target, ListChecks, CheckCircle2, TrendingUp, Filter,
  ChevronUp, ChevronDown, Upload, X, AlertTriangle, RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import {
  LSIT_DATA, APP_KEYS, APP_LABELS,
  aggregateApp, computeKPIs, healthStatus, healthStatusDark, getDateRange,
} from "../data/dbbMd1LsitData";
import { parseLsitXlsx } from "../lib/parseLsitXlsx";
import type { LSITRecord, AppKey } from "../data/dbbMd1LsitData";

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number | null): string {
  if (n === null) return "N/A";
  return `${n}%`;
}

function HealthBadge({ pct, dark }: { pct: number | null; dark: boolean }) {
  const h = dark ? healthStatusDark(pct) : healthStatus(pct);
  return <span className="tag" style={{ background: h.bg, color: h.color }}>{h.label}</span>;
}

function KpiCard({
  label, value, color, icon: Icon, delay = 0,
}: {
  label: string; value: string | number; color: string;
  icon: React.ElementType; delay?: number;
}) {
  const dark = useDark();
  return (
    <GlassCard className="p-4 relative overflow-hidden">
      <div className="blob w-20 h-20 -top-7 -right-7" style={{ background: color }} />
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 relative"
        style={{ background: `${color}22` }}>
        <Icon size={15} style={{ color }} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.06, duration: 0.4 }}
        className="htcc-display text-2xl font-extrabold relative"
        style={{ color: dc(dark, DARK.ink, COLORS.ink) }}
      >
        {value}
      </motion.div>
      <div className="text-[11px] font-medium mt-0.5 relative"
        style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>
        {label}
      </div>
    </GlassCard>
  );
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────
type UploadStatus = "idle" | "parsing" | "success" | "error";

interface UploadZoneProps {
  onData: (records: LSITRecord[], fileName: string) => void;
  dark: boolean;
  fileName: string | null;
  onReset: () => void;
}

function UploadZone({ onData, dark, fileName, onReset }: UploadZoneProps) {
  const [status, setStatus]   = useState<UploadStatus>("idle");
  const [errMsg, setErrMsg]   = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const inkColor   = dc(dark, DARK.ink,   COLORS.ink);
  const slateColor = dc(dark, DARK.slate, COLORS.slate);
  const faintColor = dc(dark, DARK.faint, COLORS.faint);
  const borderColor= dc(dark, DARK.border, COLORS.border);
  const accentColor= dc(dark, DARK.blue,  COLORS.blue);
  const greenColor = dc(dark, DARK.green, COLORS.green);

  const process = useCallback(async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setStatus("error");
      setErrMsg("Please upload an .xlsx file.");
      return;
    }
    setStatus("parsing");
    setErrMsg("");
    try {
      const records = await parseLsitXlsx(file);
      setStatus("success");     
      onData(records, file.name);
    } catch (e: any) {
      setStatus("error");
      setErrMsg(e?.message ?? "Failed to parse file.");
    }
  }, [onData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) process(file);
  }, [process]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
  }, [process]);

  // Compact success pill when data is loaded
  if (fileName) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
        style={{ background: dark ? "rgba(61,214,140,0.12)" : COLORS.greenSoft,
                 border: `1px solid ${dark ? "rgba(61,214,140,0.3)" : "rgba(0,135,61,0.25)"}` }}>
        <FileSpreadsheet size={14} style={{ color: greenColor }} />
        <span style={{ color: greenColor }} className="flex-1 truncate max-w-[260px]">{fileName}</span>
        <span style={{ color: faintColor }} className="ml-1">loaded</span>
        <button onClick={onReset} className="ml-2 p-0.5 rounded-full hover:opacity-70 transition-opacity"
          title="Reset to static data" style={{ color: faintColor }}>
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all select-none"
        style={{
          border: `1.5px dashed ${dragging ? accentColor : borderColor}`,
          background: dragging
            ? dc(dark, "rgba(240,192,96,0.08)", "rgba(15,98,254,0.05)")
            : "transparent",
        }}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInput} />
        {status === "parsing" ? (
          <RefreshCw size={16} className="animate-spin" style={{ color: accentColor }} />
        ) : (
          <Upload size={16} style={{ color: status === "error" ? COLORS.danger : faintColor }} />
        )}
        <div className="min-w-0">
          <div className="text-xs font-semibold" style={{ color: status === "error" ? COLORS.danger : inkColor }}>
            {status === "parsing" ? "Parsing…" : status === "error" ? "Upload failed" : "Upload DBB-MD1-LSIT Excel"}
          </div>
          {status === "error" ? (
            <div className="text-[10px] mt-0.5" style={{ color: COLORS.danger }}>{errMsg}</div>
          ) : (
            <div className="text-[10px] mt-0.5" style={{ color: faintColor }}>
              Drag & drop or click · .xlsx · two-level headers auto-detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function DBBMD1LSITAnalytics() {
  const dark = useDark();

  // live data state — starts as the static fallback
  const [liveData, setLiveData]     = useState<LSITRecord[] | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const data: LSITRecord[] = liveData ?? LSIT_DATA;

  const handleUploadData = useCallback((records: LSITRecord[], fileName: string) => {
    setLiveData(records);
    setUploadedFile(fileName);
  }, []);

  const handleReset = useCallback(() => {
    setLiveData(null);
    setUploadedFile(null);
  }, []);

  // ── colour tokens ──────────────────────────────────────────────────────────
  const inkColor    = dc(dark, DARK.ink,    COLORS.ink);
  const slateColor  = dc(dark, DARK.slate,  COLORS.slate);
  const faintColor  = dc(dark, DARK.faint,  COLORS.faint);
  const borderColor = dc(dark, DARK.border, COLORS.border);
  const gridStroke  = dc(dark, DARK.gridLine, "#EEF2F9");
  const accentColor = dc(dark, DARK.blue,   COLORS.blue);
  const cardBg      = dc(dark, "rgba(5,18,10,0.88)", "rgba(255,255,255,0.6)");
  const accentSoft  = dc(dark, "rgba(240,192,96,0.10)", COLORS.blueSoft);

  // ── filter state ───────────────────────────────────────────────────────────
  const allOpcos     = useMemo(() => ["All", ...new Set(data.map((r) => r.opco))],     [data]);
  const allRegions   = useMemo(() => ["All", ...new Set(data.map((r) => r.region))],   [data]);
  const allApps      = useMemo(() => ["All", ...APP_KEYS.map((k) => APP_LABELS[k])],   []);
  const allEndDates  = useMemo(() => ["All", ...new Set(data.map((r) => r.lsitEndDate))], [data]);

  const [filterOpco,    setFilterOpco]    = useState("All");
  const [filterRegion,  setFilterRegion]  = useState("All");
  const [filterApp,     setFilterApp]     = useState("All");
  const [filterEndDate, setFilterEndDate] = useState("All");

  // Reset filters when new data is loaded
  const prevDataRef = useRef(data);
  if (prevDataRef.current !== data) {
    prevDataRef.current = data;
    // Queue resets — happens synchronously before render
    if (filterOpco    !== "All") setFilterOpco("All");
    if (filterRegion  !== "All") setFilterRegion("All");
    if (filterEndDate !== "All") setFilterEndDate("All");
  }

  // ── filtered dataset ───────────────────────────────────────────────────────
  const filtered: LSITRecord[] = useMemo(() => {
    return data.filter((r) => {
      if (filterOpco    !== "All" && r.opco       !== filterOpco)    return false;
      if (filterRegion  !== "All" && r.region      !== filterRegion)  return false;
      if (filterEndDate !== "All" && r.lsitEndDate !== filterEndDate) return false;
      return true;
    });
  }, [data, filterOpco, filterRegion, filterEndDate]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis      = useMemo(() => computeKPIs(filtered), [filtered]);
  const dateRange = useMemo(() => getDateRange(filtered), [filtered]);

  // ── application aggregates ────────────────────────────────────────────────
  const appRows = useMemo(() => {
    const base = APP_KEYS.map((k) => ({ key: k, label: APP_LABELS[k], ...aggregateApp(filtered, k) }));
    return filterApp === "All" ? base : base.filter((r) => r.label === filterApp);
  }, [filtered, filterApp]);

  // ── chart data ─────────────────────────────────────────────────────────────
  const appChartData = useMemo(() =>
    appRows.map((r) => ({
      name: r.label,
      "Executed": r.execution,
      "Passed":   r.pass,
      "Total TS": r.totalTS,
    })), [appRows]);

  const pctChartData = useMemo(() =>
    appRows.map((r) => ({
      name: r.label,
      "Exec %": r.executionPct ?? 0,
      "Pass %": r.passPct ?? 0,
    })), [appRows]);

  // ── opco table ─────────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<"opco" | "region" | "overallExecutionPct" | "overallPassPct">("opco");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedOpcos = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: any = a[sortKey], vb: any = b[sortKey];
      if (va === null) va = -1;
      if (vb === null) vb = -1;
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : null;

  // ── opco performance chart ────────────────────────────────────────────────
  const opcoChartData = useMemo(() =>
    sortedOpcos.map((r) => ({
      name: r.opco,
      "Exec %": r.overallExecutionPct ?? 0,
      "Pass %": r.overallPassPct ?? 0,
    })), [sortedOpcos]);

  // ── tooltip style ──────────────────────────────────────────────────────────
  const ttStyle = {
    borderRadius: 12,
    border: `1px solid ${borderColor}`,
    fontSize: 12,
    background: dc(dark, DARK.surface, "#fff"),
    color: dc(dark, DARK.body, COLORS.ink),
  };

  const selectStyle: React.CSSProperties = {
    borderColor, background: cardBg, color: slateColor,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SectionTitle
        eyebrow="DBB-MD1 · LSIT ANALYTICS"
        title="DBB-MD1-LSIT Analytics"
        right={
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs text-right space-y-0.5" style={{ color: faintColor }}>
              <div>OpCos: <strong style={{ color: inkColor }}>{kpis.opcos.length}</strong></div>
              <div>
                End Date:{" "}
                <strong style={{ color: inkColor }}>
                  {dateRange.min === dateRange.max
                    ? dateRange.min
                    : `${dateRange.min} – ${dateRange.max}`}
                </strong>
              </div>
            </div>
            {/* Upload zone — compact pill or drop zone */}
            <UploadZone
              onData={handleUploadData}
              dark={dark}
              fileName={uploadedFile}
              onReset={handleReset}
            />
          </div>
        }
      />

      {/* ── Data source banner ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={uploadedFile ?? "static"}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          <GlassCard className="px-5 py-3" hover={false}>
            <p className="text-sm" style={{ color: slateColor }}>
              {uploadedFile ? (
                <>
                  Loaded from <strong style={{ color: inkColor }}>{uploadedFile}</strong> ·{" "}
                </>
              ) : (
                <>Using built-in static dataset · </>
              )}
              LSIT execution and pass-rate monitoring across OpCos and business scenarios.
              Showing{" "}
              <strong style={{ color: inkColor }}>{filtered.length}</strong> entries,{" "}
              <strong style={{ color: inkColor }}>{kpis.opcos.length}</strong> unique OpCos,{" "}
              <strong style={{ color: inkColor }}>{kpis.scenarios.length}</strong> business scenarios.
              &nbsp;Overall Execution:{" "}
              <strong
                style={{ color: kpis.overallExecPct >= 90 ? COLORS.green : COLORS.warning }}
              >
                {kpis.overallExecPct}%
              </strong>
              &nbsp;· Pass Rate:{" "}
              <strong
                style={{ color: kpis.overallPassPct >= 90 ? COLORS.green : COLORS.warning }}
              >
                {kpis.overallPassPct}%
              </strong>
            </p>
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <GlassCard className="p-4" hover={false}>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} style={{ color: faintColor }} />
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: faintColor }}>
            Filters
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Region",        value: filterRegion,  set: setFilterRegion,  opts: allRegions   },
            { label: "OpCo",          value: filterOpco,    set: setFilterOpco,    opts: allOpcos     },
            { label: "LSIT End Date", value: filterEndDate, set: setFilterEndDate, opts: allEndDates  },
            { label: "Application",   value: filterApp,     set: setFilterApp,     opts: allApps      },
          ].map(({ label, value, set, opts }) => (
            <div key={label} className="flex flex-col gap-1">
              <label
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: faintColor }}
              >
                {label}
              </label>
              <select
                value={value}
                onChange={(e) => set(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs border outline-none min-w-[130px]"
                style={selectStyle}
              >
                {opts.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {[
          { label: "Total OpCos",         value: kpis.opcos.length,         icon: MapPin,       color: COLORS.blue },
          { label: "Business Scenarios",  value: kpis.scenarios.length,     icon: ListChecks,   color: COLORS.blueDark },
          { label: "Total Test Scripts",  value: kpis.totalTS,              icon: Target,       color: COLORS.green },
          { label: "Total Executed",      value: kpis.totalExecuted,        icon: TrendingUp,   color: COLORS.greenDark },
          { label: "Total Passed",        value: kpis.totalPassed,          icon: CheckCircle2, color: COLORS.green },
          { label: "Execution %",         value: `${kpis.overallExecPct}%`, icon: TrendingUp,   color: COLORS.warning },
          { label: "Pass %",              value: `${kpis.overallPassPct}%`, icon: CheckCircle2, color: COLORS.green },
        ].map((k, i) => (
          <KpiCard key={k.label} {...k} delay={i} />
        ))}
      </div>

      {/* ── Application Summary Table ───────────────────────────────────────── */}
      <GlassCard className="p-5">
        <SectionTitle eyebrow="APPLICATION" title="Application / Product Summary" />
        <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: accentSoft }}>
                {["Application", "Total TS", "Executed", "Passed", "Exec %", "Pass %", "Status"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap"
                    style={{ color: dc(dark, DARK.blue, COLORS.blueDark) }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appRows.map((r) => {
                const execH = dark ? healthStatusDark(r.executionPct) : healthStatus(r.executionPct);
                const passH = dark ? healthStatusDark(r.passPct)      : healthStatus(r.passPct);
                return (
                  <tr key={r.key} className="row-hover border-t" style={{ borderColor: gridStroke }}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: inkColor }}>{r.label}</td>
                    <td className="px-3 py-2.5 htcc-mono" style={{ color: inkColor }}>{r.totalTS}</td>
                    <td className="px-3 py-2.5 htcc-mono" style={{ color: inkColor }}>{r.execution}</td>
                    <td className="px-3 py-2.5 htcc-mono" style={{ color: COLORS.green }}>{r.pass}</td>
                    <td className="px-3 py-2.5">
                      <span className="tag" style={{ background: execH.bg, color: execH.color }}>
                        {fmt(r.executionPct)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="tag" style={{ background: passH.bg, color: passH.color }}>
                        {fmt(r.passPct)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <HealthBadge pct={r.passPct} dark={dark} />
                    </td>
                  </tr>
                );
              })}
              {appRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: faintColor }}>
                    No data matches the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* ── Charts row 1: Execution vs Pass + Pct side-by-side ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <GlassCard className="p-5">
          <SectionTitle eyebrow="EXECUTION" title="Execution vs Pass by Application" />
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={appChartData} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: faintColor }} axisLine={false}
                  tickLine={false} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: faintColor }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={ttStyle} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: slateColor }} />
                <Bar dataKey="Total TS"
                  fill={dc(dark, "rgba(240,192,96,0.35)", COLORS.blueSoft)}
                  radius={[0, 0, 0, 0]} />
                <Bar dataKey="Executed" fill={accentColor} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Passed"   fill={COLORS.green} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="PASS RATE" title="Execution % vs Pass % by Application" />
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={pctChartData} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: faintColor }} axisLine={false}
                  tickLine={false} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: faintColor }} axisLine={false} tickLine={false}
                  domain={[0, 105]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={ttStyle} formatter={(v: number) => `${v}%`} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: slateColor }} />
                <Bar dataKey="Exec %" fill={accentColor} radius={[6, 6, 0, 0]} />
                <Bar dataKey="Pass %" fill={COLORS.green} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* ── Charts row 2: Exec % only + Pass % only ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <GlassCard className="p-5">
          <SectionTitle eyebrow="EXECUTION %" title="Application Execution %" />
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={pctChartData} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: faintColor }} axisLine={false}
                  tickLine={false} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: faintColor }} axisLine={false} tickLine={false}
                  domain={[0, 105]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={ttStyle} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="Exec %" fill={accentColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="PASS %" title="Application Pass %" />
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={pctChartData} margin={{ top: 4, right: 8, bottom: 28, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: faintColor }} axisLine={false}
                  tickLine={false} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: faintColor }} axisLine={false} tickLine={false}
                  domain={[0, 105]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={ttStyle} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="Pass %" fill={COLORS.green} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* ── OpCo-wise analytics table ───────────────────────────────────────── */}
      <GlassCard className="p-5">
        <SectionTitle eyebrow="OPCO ANALYTICS" title="OpCo-wise LSIT Status" />
        <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: accentSoft }}>
                {(
                  [
                    ["opco",               "OpCo"],
                    ["region",             "Region"],
                    [null,                 "Business Scenario"],
                    [null,                 "LSIT End Date"],
                    ["overallExecutionPct","Overall Exec %"],
                    ["overallPassPct",     "Overall Pass %"],
                    [null,                 "Health"],
                  ] as [typeof sortKey | null, string][]
                ).map(([k, h]) => (
                  <th
                    key={h}
                    onClick={k ? () => toggleSort(k) : undefined}
                    className={`text-left px-3 py-2.5 font-semibold whitespace-nowrap ${k ? "cursor-pointer select-none" : ""}`}
                    style={{ color: dc(dark, DARK.blue, COLORS.blueDark) }}
                  >
                    <span className="flex items-center gap-1">
                      {h} {k && <SortIcon k={k} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedOpcos.map((r, i) => {
                const execH = dark ? healthStatusDark(r.overallExecutionPct) : healthStatus(r.overallExecutionPct);
                const passH = dark ? healthStatusDark(r.overallPassPct)      : healthStatus(r.overallPassPct);
                return (
                  <tr key={i} className="row-hover border-t" style={{ borderColor: gridStroke }}>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: inkColor }}>{r.opco}</td>
                    <td className="px-3 py-2.5" style={{ color: slateColor }}>{r.region}</td>
                    <td className="px-3 py-2.5 htcc-mono" style={{ color: slateColor }}>{r.businessScenario}</td>
                    <td className="px-3 py-2.5" style={{ color: slateColor }}>{r.lsitEndDate}</td>
                    <td className="px-3 py-2.5">
                      <span className="tag" style={{ background: execH.bg, color: execH.color }}>
                        {fmt(r.overallExecutionPct)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="tag" style={{ background: passH.bg, color: passH.color }}>
                        {fmt(r.overallPassPct)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <HealthBadge pct={r.overallPassPct} dark={dark} />
                    </td>
                  </tr>
                );
              })}
              {sortedOpcos.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: faintColor }}>
                    No OpCo data matches the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* ── OpCo performance chart ──────────────────────────────────────────── */}
      <GlassCard className="p-5">
        <SectionTitle eyebrow="OPCO COMPARISON" title="OpCo Overall Execution % vs Pass %" />
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={opcoChartData} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: faintColor }} axisLine={false}
                tickLine={false} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: faintColor }} axisLine={false} tickLine={false}
                domain={[60, 105]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => `${v}%`} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: slateColor }} />
              <Line type="monotone" dataKey="Exec %" stroke={accentColor} strokeWidth={2.5}
                dot={{ r: 4, fill: accentColor }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Pass %" stroke={COLORS.green} strokeWidth={2.5}
                dot={{ r: 4, fill: COLORS.green }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

    </motion.div>
  );
}
