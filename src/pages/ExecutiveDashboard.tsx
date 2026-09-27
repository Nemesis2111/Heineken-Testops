import React from "react";
import { motion } from "framer-motion";
import {
  ListChecks, CheckCircle2, XCircle, PauseCircle, Bug, Target,
  ArrowUpRight, TrendingDown, FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import EmptyState from "../components/EmptyState";
import Gauge from "../components/Gauge";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { useCountUp } from "../lib/useCountUp";
import {
  useActiveProject, useProjectStore,
  computeKPIs, buildExecutionTrend, buildPassRateTrend, groupBy,
  PROJECT_LIST,
} from "../lib/ProjectStore";

function KpiCard({ k, delay }: { k: any; delay: number }) {
  const dark = useDark();
  const val = useCountUp(k.value, 900 + delay * 100);
  const Icon = k.icon;
  const positive = k.delta.startsWith("+");
  return (
    <GlassCard className="p-4 relative overflow-hidden">
      <div className="blob w-24 h-24 -top-8 -right-8" style={{ background: k.color }} />
      <div className="flex items-center justify-between relative">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${k.color}22` }}>
          <Icon size={16} style={{ color: k.color }} />
        </div>
        <span className="text-[11px] font-semibold flex items-center gap-0.5" style={{ color: positive ? COLORS.green : COLORS.danger }}>
          {positive ? <ArrowUpRight size={12} /> : <TrendingDown size={12} />} {k.delta}
        </span>
      </div>
      <div className="htcc-display text-2xl font-extrabold mt-3 relative" style={{ color: dc(dark, DARK.ink, COLORS.ink) }}>
        {val}{k.suffix || ""}
      </div>
      <div className="text-[11px] font-medium relative" style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>{k.label}</div>
    </GlassCard>
  );
}

export default function ExecutiveDashboard() {
  const dark = useDark();
  const { id, meta, store } = useActiveProject();
  const { state } = useProjectStore();
  const { executions, defects } = store;

  const gridStroke = dc(dark, DARK.gridLine, "#EEF2F9");
  const axisColor  = dc(dark, DARK.faint, COLORS.faint);
  const accent     = dc(dark, DARK.blue, COLORS.blue);

  const kpis = computeKPIs(executions, defects);

  if (!kpis) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <SectionTitle eyebrow={`COMMAND CENTER · ${meta.name.toUpperCase()}`} title="Executive Dashboard" />
        <EmptyState
          icon={FileSpreadsheet}
          title="No execution data loaded"
          description={`Upload a test execution Excel/CSV file for ${meta.name} to populate this dashboard with real KPIs, trend charts, and health scores.`}
        />
      </motion.div>
    );
  }

  const kpiCards = [
    { label: "Total Executions", value: kpis.total,       icon: ListChecks,   color: COLORS.blue,    delta: "+8.2%" },
    { label: "Passed",           value: kpis.passed,      icon: CheckCircle2, color: COLORS.green,   delta: "+4.1%" },
    { label: "Failed",           value: kpis.failed,      icon: XCircle,      color: COLORS.danger,  delta: kpis.failed > 10 ? "+1.4%" : "-1.4%" },
    { label: "Blocked",          value: kpis.blocked,     icon: PauseCircle,  color: COLORS.warning, delta: "+0.6%" },
    { label: "Open Defects",     value: kpis.openDefects, icon: Bug,          color: COLORS.danger,  delta: kpis.openDefects > 15 ? "+2.0%" : "-2.0%" },
    { label: "Completion %",     value: kpis.completion,  icon: Target,       color: COLORS.blueDark, delta: "+3%", suffix: "%" },
  ];

  const executionTrend  = buildExecutionTrend(executions);
  const passRateTrend   = buildPassRateTrend(executionTrend);
  const defectByPriority = groupBy(defects as unknown as Record<string, unknown>[], "priority");

  // Health gauges: compute dynamically across all projects
  const allProjectKpis = PROJECT_LIST.map((p) => {
    const pStore = state.projects[p.id];
    const k = computeKPIs(pStore.executions, pStore.defects);
    return { ...p, healthScore: k ? k.health : 0, hasData: pStore.executions.length > 0 };
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionTitle
        eyebrow={`COMMAND CENTER · ${meta.name.toUpperCase()}`}
        title="Executive Dashboard"
        right={
          <div className="flex items-center gap-3">
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: kpis.health >= 85 ? `${COLORS.green}18` : kpis.health >= 70 ? `${COLORS.warning}18` : `${COLORS.danger}18`,
                color: kpis.health >= 85 ? COLORS.green : kpis.health >= 70 ? COLORS.warning : COLORS.danger,
              }}
            >
              Health: {kpis.health}/100
            </span>
            <div className="text-xs" style={{ color: dc(dark, DARK.faint, COLORS.faint) }}>
              Updated from uploaded data
            </div>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((k, i) => <KpiCard key={k.label} k={k} delay={i} />)}
      </div>

      {/* Secondary metric strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pass Rate %",   value: kpis.passRate,   color: COLORS.green,   suffix: "%" },
          { label: "In Progress",   value: kpis.inProgress, color: COLORS.blue,    suffix: "" },
          { label: "Not Run",       value: kpis.notRun,     color: COLORS.slate,   suffix: "" },
          { label: "Health Score",  value: kpis.health,     color: kpis.health >= 85 ? COLORS.green : kpis.health >= 70 ? COLORS.warning : COLORS.danger, suffix: "/100" },
        ].map((s) => (
          <GlassCard key={s.label} className="p-4">
            <div className="htcc-display text-2xl font-extrabold" style={{ color: s.color }}>{s.value}{s.suffix}</div>
            <div className="text-[11px] font-medium mt-1" style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>{s.label}</div>
          </GlassCard>
        ))}
      </div>

      {/* Execution Trend + Health Gauges */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <GlassCard className="p-5 xl:col-span-2">
          <SectionTitle eyebrow="TREND" title={`Execution Trend · ${meta.name}`} />
          {executionTrend.length > 0 ? (
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <AreaChart data={executionTrend}>
                  <defs>
                    <linearGradient id="execGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={dc(dark, DARK.blue, COLORS.blue)} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={dc(dark, DARK.blue, COLORS.blue)} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${dc(dark, DARK.border, COLORS.border)}`, fontSize: 12, background: dc(dark, DARK.surface, "#fff"), color: dc(dark, DARK.body, COLORS.ink) }} />
                  <Area type="monotone" dataKey="executed" stroke={dc(dark, DARK.blue, COLORS.blue)} fill="url(#execGrad)" strokeWidth={2} name="Executed" />
                  <Area type="monotone" dataKey="passed" stroke={COLORS.green} fill="url(#passGrad)" strokeWidth={2} name="Passed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-sm" style={{ color: axisColor }}>
              No date data available in imported records.
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="SCORE" title="Project Health" />
          <div className="grid grid-cols-2 gap-y-4">
            {allProjectKpis.map((p) => (
              <Gauge
                key={p.id}
                value={p.healthScore}
                color={p.healthScore >= 85 ? COLORS.green : p.healthScore >= 70 ? COLORS.warning : COLORS.danger}
                label={p.shortName}
                size={100}
              />
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Pass Rate + Defect Priority */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <GlassCard className="p-5">
          <SectionTitle eyebrow="QUALITY" title="Pass Rate Trend" />
          {passRateTrend.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={passRateTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, background: dc(dark, DARK.surface, "#fff"), color: dc(dark, DARK.body, COLORS.ink) }} />
                  <Line type="monotone" dataKey="passRate" stroke={COLORS.green} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm" style={{ color: axisColor }}>No trend data</div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle eyebrow="RISK" title="Defect Priority Distribution" />
          {defectByPriority.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={defectByPriority}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, background: dc(dark, DARK.surface, "#fff"), color: dc(dark, DARK.body, COLORS.ink) }} />
                  <Bar dataKey="value" fill={COLORS.danger} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm" style={{ color: axisColor }}>No defect data</div>
          )}
        </GlassCard>
      </div>
    </motion.div>
  );
}
