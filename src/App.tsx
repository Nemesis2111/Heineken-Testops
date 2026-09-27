import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import { useDarkMode } from "./lib/useDarkMode";
import { DarkContext } from "./lib/DarkContext";
import { ProjectStoreProvider, useProjectStore, PROJECT_META, PROJECT_IDS } from "./lib/ProjectStore";
import type { ProjectId } from "./lib/ProjectStore";

import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import TestExecutionCenter from "./pages/TestExecutionCenter";
import DefectCommandCenter from "./pages/DefectCommandCenter";
import MerlinDashboard from "./pages/MerlinDashboard";
import ExcelImportCenter from "./pages/ExcelImportCenter";
import DailyReports from "./pages/DailyReports";
import AiInsights from "./pages/AiInsights";
import EmailReviewCenter from "./pages/EmailReviewCenter";
import ProjectHealthDashboard from "./pages/ProjectHealthDashboard";

function AppInner() {
  const [dark, setDark] = useDarkMode();
  const [page, setPage] = React.useState("dashboard");
  const [collapsed, setCollapsed] = React.useState(false);
  const { state, dispatch } = useProjectStore();
  const activeProject = state.activeProject;
  const setActiveProject = (id: ProjectId) => dispatch({ type: "SET_PROJECT", payload: id });

  const goToAI = () => setPage("ai");

  return (
    <DarkContext.Provider value={dark}>
      <div className="htcc-bg min-h-screen flex" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui" }}>
        <Sidebar
          page={page}
          setPage={setPage}
          activeProject={activeProject}
          setActiveProject={setActiveProject}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        <div className="flex-1 min-w-0 flex flex-col">
          <Navbar onAskAI={goToAI} dark={dark} onToggleDark={() => setDark((d) => !d)} />

          {/* Project tab strip */}
          <div
            className="flex items-center gap-3 px-6 py-2.5 border-b overflow-x-auto"
            style={{
              borderColor: dark ? "rgba(0,135,61,0.22)" : "rgba(15,98,254,0.10)",
              background: dark ? "rgba(5,18,10,0.5)" : "rgba(248,250,255,0.8)",
            }}
          >
            {PROJECT_IDS.map((id) => {
              const p = PROJECT_META[id];
              const active = activeProject === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setActiveProject(id);
                    if (id === "merlin-intake-v5") setPage("merlin");
                  }}
                  className="relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all"
                  style={{
                    background: active ? `${p.color}14` : "transparent",
                    color: active ? p.color : dark ? "#8DC8A0" : "#5B6B85",
                    border: active ? `1px solid ${p.color}33` : "1px solid transparent",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? p.color : dark ? "#52A872" : "#8895AB" }} />
                  {p.name}
                  {active && (
                    <motion.div
                      layoutId="proj-tab-indicator"
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                      style={{ background: p.color }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <main className="p-6 flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${page}-${activeProject}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                {page === "dashboard" && <ExecutiveDashboard />}
                {page === "execution" && <TestExecutionCenter />}
                {page === "defects"   && <DefectCommandCenter />}
                {page === "merlin"    && <MerlinDashboard onImport={() => setPage("excel")} onNavigate={setPage} />}
                {page === "excel"     && <ExcelImportCenter onNavigate={setPage} />}
                {page === "reports"   && <DailyReports />}
                {page === "ai"        && <AiInsights />}
                {page === "email"     && <EmailReviewCenter />}
                {page === "health"    && <ProjectHealthDashboard />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </DarkContext.Provider>
  );
}

export default function App() {
  return (
    <ProjectStoreProvider>
      <AppInner />
    </ProjectStoreProvider>
  );
}
