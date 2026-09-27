import React from "react";
import { motion } from "framer-motion";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import Gauge from "../components/Gauge";
import EmptyState from "../components/EmptyState";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { useProjectStore, useActiveProject, computeKPIs, PROJECT_LIST } from "../lib/ProjectStore";
import { HeartPulse } from "lucide-react";

export default function ProjectHealthDashboard() {
  const dark = useDark();
  const { state } = useProjectStore();
  const { id: activeProjectId } = useActiveProject();

  const accent      = dc(dark, DARK.blue, COLORS.blue);
  const inkColor    = dc(dark, DARK.ink, COLORS.ink);
  const slateColor  = dc(dark, DARK.slate, COLORS.slate);
  const cellBg      = dc(dark, "rgba(0,135,61,0.10)", "#F8FAFC");

  // Check if any project has data
  const anyHasData = PROJECT_LIST.some((p) => state.projects[p.id].executions.length > 0);

  if (!anyHasData) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <SectionTitle eyebrow="PORTFOLIO VIEW" title="Project Health Dashboard" />
        <EmptyState
          icon={HeartPulse}
          title="No project data loaded"
          description="Import test execution data for any project to see health scores, KPIs, and execution progress across your portfolio."
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionTitle eyebrow="PORTFOLIO VIEW" title="Project Health Dashboard" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PROJECT_LIST.map((p) => {
          const pStore = state.projects[p.id];
          const kpis = computeKPIs(pStore.executions, pStore.defects);
          const isActive = p.id === activeProjectId;
          const hasData = pStore.executions.length > 0;

          return (
            <GlassCard
              key={p.id}
              className="p-5"
              style={{ border: isActive ? `1.5px solid ${p.color}44` : undefined }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${p.color}18` }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: p.color }} />
                </div>
                <div className="flex-1">
                  <div className="htcc-display font-bold text-sm flex items-center gap-2" style={{ color: inkColor }}>
                    {p.name}
                    {isActive && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ background: `${p.color}18`, color: p.color }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: slateColor }}>{p.description}</div>
                </div>
                {hasData && kpis ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: kpis.health >= 85 ? `${COLORS.green}18` : kpis.health >= 70 ? `${COLORS.warning}18` : `${COLORS.danger}18`,
                      color: kpis.health >= 85 ? COLORS.green : kpis.health >= 70 ? COLORS.warning : COLORS.danger,
                    }}>
                    {kpis.health >= 85 ? "Healthy" : kpis.health >= 70 ? "On Track" : "At Risk"}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: cellBg, color: slateColor }}>No data</span>
                )}
              </div>

              {hasData && kpis ? (
                <>
                  {/* Health gauge + KPIs */}
                  <div className="flex gap-5 items-center">
                    <Gauge
                      value={kpis.health}
                      color={kpis.health >= 85 ? COLORS.green : kpis.health >= 70 ? COLORS.warning : COLORS.danger}
                      label="Health Score"
                      size={120}
                    />
                    <div className="flex-1 space-y-2 text-xs">
                      <div className="flex justify-between px-2.5 py-1.5 rounded-lg" style={{ background: cellBg }}>
                        <span style={{ color: slateColor }}>Execution</span>
                        <span className="font-bold" style={{ color: inkColor }}>{kpis.completion}%</span>
                      </div>
                      <div className="flex justify-between px-2.5 py-1.5 rounded-lg" style={{ background: cellBg }}>
                        <span style={{ color: slateColor }}>Pass Rate</span>
                        <span className="font-bold" style={{ color: COLORS.green }}>{kpis.passRate}%</span>
                      </div>
                      <div className="flex justify-between px-2.5 py-1.5 rounded-lg" style={{ background: cellBg }}>
                        <span style={{ color: slateColor }}>Open Defects</span>
                        <span className="font-bold" style={{ color: COLORS.danger }}>{kpis.openDefects}</span>
                      </div>
                      <div className="flex justify-between px-2.5 py-1.5 rounded-lg" style={{ background: cellBg }}>
                        <span style={{ color: slateColor }}>Total Test Cases</span>
                        <span className="font-bold" style={{ color: inkColor }}>{kpis.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] mb-1" style={{ color: slateColor }}>
                      <span>Execution Progress</span>
                      <span style={{ color: p.color }}>{kpis.completion}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: cellBg }}>
                      <motion.div className="h-full rounded-full" style={{ background: p.color }}
                        initial={{ width: 0 }} animate={{ width: `${kpis.completion}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
                    </div>
                  </div>

                  {/* Counts */}
                  <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px]">
                    {[
                      { label: "Total",   val: kpis.total,   color: inkColor },
                      { label: "Passed",  val: kpis.passed,  color: COLORS.green },
                      { label: "Failed",  val: kpis.failed,  color: COLORS.danger },
                      { label: "Not Run", val: kpis.notRun,  color: COLORS.faint },
                    ].map((s) => (
                      <div key={s.label} className="py-1.5 rounded-lg" style={{ background: cellBg }}>
                        <div className="font-extrabold text-sm" style={{ color: s.color }}>{s.val}</div>
                        <div style={{ color: slateColor }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8 text-sm" style={{ color: slateColor }}>
                  Import data to see health metrics
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>
    </motion.div>
  );
}
