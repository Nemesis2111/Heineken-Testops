import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ChevronRight, ChevronLeft, LayoutDashboard, ListChecks, Bug,
  FileSpreadsheet, Calendar as CalendarIcon, Brain, Mail, HeartPulse,
  CheckCircle2, AlertTriangle, Clock, FlaskConical,
} from "lucide-react";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { PROJECT_META, PROJECT_IDS, useProjectStore } from "../lib/ProjectStore";
import type { ProjectId } from "../lib/ProjectStore";

export const PAGES = [
  { id: "dashboard", label: "Executive Dashboard",    icon: LayoutDashboard },
  { id: "execution", label: "Test Execution Center",  icon: ListChecks },
  { id: "defects",   label: "Defect Command Center",  icon: Bug },
  { id: "merlin",    label: "Merlin Intake V5",       icon: FlaskConical },
  { id: "excel",     label: "Excel Import Center",    icon: FileSpreadsheet },
  { id: "reports",   label: "Daily Reports",          icon: CalendarIcon },
  { id: "ai",        label: "AI Insights",            icon: Brain },
  { id: "email",     label: "Email Review Center",    icon: Mail },
  { id: "health",    label: "Project Health",         icon: HeartPulse },
];

interface Props {
  page: string;
  setPage: (p: string) => void;
  activeProject: ProjectId;
  setActiveProject: (p: ProjectId) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}

const HEALTH_ICON = (health: number) =>
  health >= 85 ? CheckCircle2 : health >= 70 ? Clock : AlertTriangle;

const HEALTH_COLOR = (health: number) =>
  health >= 85 ? COLORS.green : health >= 70 ? COLORS.warning : COLORS.danger;

const PROJECT_LIST_SIDEBAR = PROJECT_IDS.map((id) => ({ id, ...PROJECT_META[id] }));

export default function Sidebar({ page, setPage, activeProject, setActiveProject, collapsed, setCollapsed }: Props) {
  const dark = useDark();
  const { state } = useProjectStore();

  const ink = dc(dark, DARK.ink, COLORS.ink);
  const slate = dc(dark, DARK.slate, COLORS.slate);
  const faint = dc(dark, DARK.faint, COLORS.faint);
  const border = dc(dark, DARK.border, COLORS.border);

  return (
    <aside
      className="h-screen sticky top-0 shrink-0 flex flex-col glass htcc-scroll overflow-y-auto"
      style={{ width: collapsed ? 68 : 272, borderRadius: 0, borderRight: `1px solid ${border}`, transition: "width .28s cubic-bezier(0.4,0,0.2,1)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 btn-primary">
          <Sparkles size={18} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="leading-tight min-w-0"
            >
              <div className="htcc-display font-bold text-[13px]" style={{ color: ink }}>HEINEKEN</div>
              <div className="htcc-mono text-[10px] font-medium" style={{ color: dc(dark, DARK.green, COLORS.green) }}>
                TestOps Command Center
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Project Switcher */}
      <div className="px-3 mb-3">
        {!collapsed && (
          <div className="px-2 pb-1.5 text-[10px] font-bold tracking-widest uppercase" style={{ color: faint }}>
            Projects
          </div>
        )}
        <nav className="space-y-1">
          {PROJECT_LIST_SIDEBAR.map((proj) => {
            const active = activeProject === proj.id;
            const projStore = state.projects[proj.id as ProjectId];
            const openDef = projStore.defects.filter((d) => d.status !== "Done").length;
            const hasData = projStore.executions.length > 0;
            const passedCount = projStore.executions.filter((e) => e.status === "Passed").length;
            const totalCount = projStore.executions.length;
            const healthScore = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
            const HealthIcon = hasData ? HEALTH_ICON(healthScore) : Clock;
            const healthColor = hasData ? HEALTH_COLOR(healthScore) : faint;

            return (
              <motion.button
                key={proj.id}
                onClick={() => setActiveProject(proj.id as ProjectId)}
                whileTap={{ scale: 0.97 }}
                className="relative w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left overflow-hidden"
                style={{
                  background: active
                    ? dark
                      ? `linear-gradient(120deg, rgba(0,135,61,0.28) 0%, rgba(0,100,41,0.14) 100%)`
                      : `linear-gradient(120deg, rgba(15,98,254,0.12) 0%, rgba(0,135,61,0.07) 100%)`
                    : "transparent",
                  border: active
                    ? `1px solid ${dark ? "rgba(0,135,61,0.45)" : "rgba(15,98,254,0.20)"}`
                    : "1px solid transparent",
                  transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                {/* Active left accent bar */}
                {active && (
                  <motion.div
                    layoutId="project-active-bar"
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                    style={{ background: dc(dark, DARK.green, COLORS.blue) }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Color dot */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: active
                      ? `${proj.color}22`
                      : dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: active ? proj.color : faint }}
                  />
                </div>

                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex-1 min-w-0"
                    >
                      <div
                        className="text-[12.5px] font-semibold truncate"
                        style={{ color: active ? dc(dark, DARK.ink, COLORS.ink) : slate }}
                      >
                        {proj.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {hasData ? (
                          <>
                            <HealthIcon size={9} style={{ color: healthColor }} />
                            <span className="text-[9.5px]" style={{ color: healthColor }}>
                              {healthScore}%
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px]" style={{ color: faint }}>No data</span>
                        )}
                        {openDef > 0 && (
                          <span
                            className="text-[8.5px] font-bold px-1 rounded-full"
                            style={{ background: `${COLORS.danger}18`, color: COLORS.danger }}
                          >
                            {openDef} bugs
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-2" style={{ height: 1, background: border }} />

      {/* Page Navigation */}
      <div className="px-3 flex-1">
        {!collapsed && (
          <div className="px-2 pb-1.5 text-[10px] font-bold tracking-widest uppercase" style={{ color: faint }}>
            Workspace
          </div>
        )}
        <nav className="space-y-0.5">
          {PAGES.map((p) => {
            const Icon = p.icon;
            const active = page === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPage(p.id)}
                className="nav-item w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left"
                style={{
                  background: active
                    ? dark
                      ? "linear-gradient(90deg, rgba(0,135,61,0.22), rgba(0,100,41,0.12))"
                      : "linear-gradient(90deg, rgba(15,98,254,0.10), rgba(0,135,61,0.06))"
                    : "transparent",
                  color: active ? dc(dark, DARK.green, COLORS.blueDark) : slate,
                  fontWeight: active ? 700 : 500,
                  borderLeft: active ? `2.5px solid ${dc(dark, DARK.green, COLORS.blue)}` : "2.5px solid transparent",
                  transition: "all 0.18s ease",
                }}
              >
                <Icon size={15} className="shrink-0" />
                {!collapsed && <span className="text-[13px]">{p.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="m-3 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
        style={{ color: faint }}
      >
        {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /> <span>Collapse</span></>}
      </button>
    </aside>
  );
}
