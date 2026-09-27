import React, { createContext, useContext, useReducer } from "react";
import type { TestCase, Defect } from "../types";
import type { MerlinWorkbook, MerlinDefect } from "./merlinTypes";
import { MERLIN_EMPTY } from "./merlinTypes";

export type ProjectId = "dbb-md1-lsit" | "merlin-intake-v5" | "srm-regression" | "wave2-sit";

export const PROJECT_META: Record<ProjectId, { name: string; shortName: string; color: string; description: string }> = {
  "dbb-md1-lsit":      { name: "DBB-MD1-LSIT",      shortName: "DBB-MD1",    color: "#00873D", description: "Local System Integration Testing" },
  "merlin-intake-v5":  { name: "Merlin Intake V5",   shortName: "Merlin V5",  color: "#0F62FE", description: "Intake process regression testing" },
  "srm-regression":    { name: "SRM Regression",     shortName: "SRM Reg",    color: "#DA1E28", description: "Supplier Relationship Management regression" },
  "wave2-sit":         { name: "Wave 2 SIT Status",  shortName: "Wave 2 SIT", color: "#8A3FFC", description: "Wave 2 System Integration Test" },
};

export const PROJECT_IDS = Object.keys(PROJECT_META) as ProjectId[];

export const PROJECT_LIST = PROJECT_IDS.map((id) => ({ id, ...PROJECT_META[id] }));

export interface UploadedFile {
  name: string;
  size: string;
  uploadedAt: string;
  rowCount: number;
  dataType: "executions" | "defects" | "mixed";
}

export interface ProjectStore {
  executions: TestCase[];
  defects: Defect[];
  uploadedFiles: UploadedFile[];
}

export type AppState = {
  activeProject: ProjectId;
  projects: Record<ProjectId, ProjectStore>;
  merlinWorkbook: MerlinWorkbook;
};

const EMPTY_STORE: ProjectStore = { executions: [], defects: [], uploadedFiles: [] };

const initialState: AppState = {
  activeProject: "dbb-md1-lsit",
  projects: {
    "dbb-md1-lsit":     { ...EMPTY_STORE },
    "merlin-intake-v5": { ...EMPTY_STORE },
    "srm-regression":   { ...EMPTY_STORE },
    "wave2-sit":        { ...EMPTY_STORE },
  },
  merlinWorkbook: { ...MERLIN_EMPTY },
};

type Action =
  | { type: "SET_PROJECT"; payload: ProjectId }
  | { type: "ADD_EXECUTIONS"; projectId: ProjectId; records: TestCase[]; file: UploadedFile }
  | { type: "ADD_DEFECTS";    projectId: ProjectId; records: Defect[];   file: UploadedFile }
  | { type: "REPLACE_EXECUTIONS"; projectId: ProjectId; records: TestCase[] }
  | { type: "REPLACE_DEFECTS";    projectId: ProjectId; records: Defect[] }
  | { type: "SET_MERLIN_WORKBOOK"; workbook: MerlinWorkbook };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_PROJECT":
      return { ...state, activeProject: action.payload };
    case "ADD_EXECUTIONS":
      return {
        ...state,
        projects: {
          ...state.projects,
          [action.projectId]: {
            ...state.projects[action.projectId],
            executions: [...state.projects[action.projectId].executions, ...action.records],
            uploadedFiles: [...state.projects[action.projectId].uploadedFiles, action.file],
          },
        },
      };
    case "ADD_DEFECTS":
      return {
        ...state,
        projects: {
          ...state.projects,
          [action.projectId]: {
            ...state.projects[action.projectId],
            defects: [...state.projects[action.projectId].defects, ...action.records],
            uploadedFiles: [...state.projects[action.projectId].uploadedFiles, action.file],
          },
        },
      };
    case "REPLACE_EXECUTIONS":
      return {
        ...state,
        projects: {
          ...state.projects,
          [action.projectId]: {
            ...state.projects[action.projectId],
            executions: action.records,
          },
        },
      };
    case "REPLACE_DEFECTS":
      return {
        ...state,
        projects: {
          ...state.projects,
          [action.projectId]: {
            ...state.projects[action.projectId],
            defects: action.records,
          },
        },
      };
    case "SET_MERLIN_WORKBOOK": {
      const wb = action.workbook;
      // ── Map Merlin Defects1 → Defect[] for the merlin-intake-v5 project ──────
      const merlinDefects: Defect[] = wb.defects.map((d: MerlinDefect) => ({
        key:        d.defectId,
        title:      d.summary,
        team:       d.assignee,
        assignee:   d.assignee,
        reporter:   d.reporter,
        sprint:     d.affectedOpco,
        priority:   d.priority,
        status:     d.status,
        project:    "Merlin Intake V5",
        labels:     d.severityRationale,
        components: d.affectedOpco,
        created:    d.defectCreatedDate,
        targetEnd:  d.expectedFixDate,
        progress:   0,
        estimate:   0,
      }));

      // ── Map Daily Status + COA SIT rows → TestCase[] ────────────────────────
      // Stamp execStart with today's date so the Daily Reports calendar highlights
      // the upload day and getActiveDates() returns a non-empty set.
      const importDate = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
      const merlinExecutions: TestCase[] = [];
      const addExecRow = (sheet: typeof wb.dailyStatus, phase: string) => {
        if (!sheet) return;
        const total  = Number(sheet.totalTc)     || 0;
        const pass   = Number(sheet.pass)         || 0;
        const fail   = Number(sheet.fail)         || 0;
        const inProg = Number(sheet.inProgress)   || 0;
        const blk    = Number(sheet.blocked)      || 0;
        const notEx  = Number(sheet.notExecuted)  || 0;
        const descop = Number(sheet.descoped)     || 0;
        const na     = Number(sheet.na)           || 0;
        const counts: { status: string; n: number }[] = [
          { status: "Passed",      n: pass   },
          { status: "Failed",      n: fail   },
          { status: "In Progress", n: inProg },
          { status: "Blocked",     n: blk    },
          { status: "Not Run",     n: notEx + descop + na },
        ];
        let idx = 0;
        for (const { status, n } of counts) {
          for (let i = 0; i < n; i++) {
            merlinExecutions.push({
              id: `merlin-${phase}-${idx++}`,
              directory: phase,
              name: `${phase} Test Case #${idx}`,
              status: status as TestCase["status"],
              project: "Merlin Intake V5",
              phase,
              assignedTo: "",
              execStart: importDate,   // ← stamped so calendar highlights today
              execEnd:   importDate,
              planStart: importDate,
              planEnd:   importDate,
              defects: 0,
              defectIds: "",
              requirements: "",
              role: "",
              stepRole: "",
              actualResult: "",
              stepStatus: status as TestCase["status"],
            });
          }
        }
        // If counts don't add up to totalTc, pad with Not Run
        const mapped = pass + fail + inProg + blk + notEx + descop + na;
        const remainder = total - mapped;
        for (let i = 0; i < remainder; i++) {
          merlinExecutions.push({
            id: `merlin-${phase}-${idx++}`,
            directory: phase,
            name: `${phase} Test Case #${idx}`,
            status: "Not Run",
            project: "Merlin Intake V5",
            phase,
            assignedTo: "",
            execStart: importDate,
            execEnd:   importDate,
            planStart: importDate,
            planEnd:   importDate,
            defects: 0,
            defectIds: "",
            requirements: "",
            role: "",
            stepRole: "",
            actualResult: "",
            stepStatus: "Not Run",
          });
        }
      };
      addExecRow(wb.dailyStatus, "SIT");
      addExecRow(wb.coaSit,      "COA SIT");

      return {
        ...state,
        merlinWorkbook: wb,
        projects: {
          ...state.projects,
          "merlin-intake-v5": {
            ...state.projects["merlin-intake-v5"],
            defects:    merlinDefects,
            executions: merlinExecutions,
          },
        },
      };
    }
    default:
      return state;
  }
}

const StoreContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function ProjectStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useProjectStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useProjectStore must be used within ProjectStoreProvider");
  return ctx;
}

export function useActiveProject() {
  const { state } = useProjectStore();
  const id = state.activeProject;
  return {
    id,
    meta: PROJECT_META[id],
    store: state.projects[id],
  };
}

/** KPI computation — purely from data, no hardcoded values */
export function computeKPIs(executions: TestCase[], defects: Defect[]) {
  const total = executions.length;
  if (total === 0) return null; // signal empty state
  const passed     = executions.filter((t) => t.status === "Passed").length;
  const failed     = executions.filter((t) => t.status === "Failed").length;
  const blocked    = executions.filter((t) => t.status === "Blocked").length;
  const inProgress = executions.filter((t) => t.status === "In Progress").length;
  const notRun     = executions.filter((t) => t.status === "Not Run").length;
  const openDefects = defects.filter((d) => d.status !== "Done").length;
  const completion  = Math.round(((passed + failed + blocked) / total) * 100);
  const passRate    = (passed + failed) > 0 ? Math.round((passed / (passed + failed)) * 100) : 0;
  const health      = Math.round(passRate * 0.6 + completion * 0.4);
  return { total, passed, failed, blocked, inProgress, notRun, openDefects, completion, passRate, health };
}

/** Group executions by date for trend charts */
export function buildExecutionTrend(executions: TestCase[]) {
  const byDate = new Map<string, { executed: number; passed: number; failed: number }>();
  for (const t of executions) {
    const dateStr = t.execStart && t.execStart !== "-"
      ? t.execStart.split(" ")[0]
      : t.planStart && t.planStart !== "-" ? t.planStart : null;
    if (!dateStr) continue;
    const existing = byDate.get(dateStr) ?? { executed: 0, passed: 0, failed: 0 };
    existing.executed++;
    if (t.status === "Passed")  existing.passed++;
    if (t.status === "Failed")  existing.failed++;
    byDate.set(dateStr, existing);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ day, ...v }));
}

/** Pass rate trend from execution trend */
export function buildPassRateTrend(trend: { day: string; executed: number; passed: number }[]) {
  return trend.map((d) => ({
    day: d.day,
    passRate: d.executed > 0 ? Math.round((d.passed / d.executed) * 100) : 0,
  }));
}

/** Group items by a string field */
export function groupBy(items: Record<string, unknown>[], key: string): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const val = String(item[key] ?? "Unknown").trim() || "Unknown";
    map.set(val, (map.get(val) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Get unique execution dates that have records */
export function getActiveDates(executions: TestCase[]): string[] {
  const dates = new Set<string>();
  for (const t of executions) {
    if (t.execStart && t.execStart !== "-") dates.add(t.execStart.split(" ")[0]);
    if (t.planStart && t.planStart !== "-") dates.add(t.planStart.split(" ")[0]);
  }
  return Array.from(dates).sort();
}

/** Get unique phases from executions */
export function getPhases(executions: TestCase[]): string[] {
  return [...new Set(executions.map((t) => t.phase).filter(Boolean))];
}
