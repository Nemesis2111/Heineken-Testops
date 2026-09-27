// Compatibility re-exports — this file is now a thin shim.
// All live data lives in ProjectStore (React Context).

export type { ProjectId } from "../lib/ProjectStore";
export {
  PROJECT_META,
  PROJECT_IDS,
  PROJECT_LIST,
  computeKPIs as computeProjectKPIs,
  getPhases as getProjectPhases,
} from "../lib/ProjectStore";

export type { AppState, ProjectStore, UploadedFile } from "../lib/ProjectStore";

export const STATUSES = ["Passed", "Failed", "Blocked", "In Progress", "Not Run"] as const;
export const PRIORITIES = ["Blocker (P1)", "Critical (P2)", "Major (P3)", "Minor (P4)"];
export const D_STATUSES = ["To Do", "In Progress", "Ready for review", "Done"];
