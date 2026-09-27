/**
 * importHelpers.ts
 * ─────────────────────────────────────────────────────────────
 * Shared row-mapping helpers extracted from ExcelImportCenter
 * so they can be dynamically imported by DailyReports auto-load.
 */

import type { TestCase, Defect, TestStatus } from "../types";
import { STATUSES } from "../data/projectsConfig";

const VALID_STATUSES = new Set<string>(["Passed", "Failed", "Blocked", "In Progress", "Not Run"]);

function toStatus(v: string): TestStatus {
  const s = STATUSES.find((s) => s.toLowerCase() === v?.toLowerCase());
  return (s ?? "Not Run") as TestStatus;
}

export function makeGetter(row: Record<string, string>) {
  return (...keys: string[]): string => {
    for (const k of keys) {
      const needle = k.toLowerCase().replace(/[\s_\-#]/g, "");
      for (const rk of Object.keys(row)) {
        if (rk.toLowerCase().replace(/[\s_\-#]/g, "") === needle && row[rk]) return row[rk];
      }
      for (const rk of Object.keys(row)) {
        if (rk.toLowerCase().replace(/[\s_\-#]/g, "").includes(needle) && row[rk]) return row[rk];
      }
    }
    return "";
  };
}

export function rowToTestCase(row: Record<string, string>, idx: number): TestCase | null {
  const g = makeGetter(row);
  const id = g("Id", "id", "testid", "tcid", "testcaseid", "test case id", "Test Case ID") || `TR-IMP-${idx + 1}`;
  const name = g("Name", "name", "testname", "testcasename", "title", "Test Case Name");
  if (!name && !id.startsWith("TR-IMP")) return null;

  const rawStatus = g("Status", "status", "result", "executionstatus", "exec status");
  const status = toStatus(rawStatus);
  const defectsNum = parseInt(g("Defects", "defects", "defectcount", "DefectCount", "bugs")) || 0;

  return {
    id,
    name: name || id,
    status,
    project:          g("project", "projectname", "Project") || "Imported",
    phase:            g("phase", "testphase", "stage", "Phase") || "UAT",
    assignedTo:       g("Assigned To", "AssignedTo", "assignedto", "assignee", "tester", "owner") || "Unassigned",
    directory:        g("tDirectory", "directory", "folder", "path", "Directory") || "-",
    execStart:        g("Executed Start", "ExecutedStart", "execstart", "startdate", "ExecutionStart") || "-",
    execEnd:          g("Executed End", "ExecutedEnd", "execend", "enddate", "ExecutionEnd") || "-",
    planStart:        g("Planned Start Date", "PlannedStartDate", "planstart", "plannedstart", "planned start") || "-",
    planEnd:          g("Planned End Date", "PlannedEndDate", "planend", "plannedend", "planned end") || "-",
    defects:          defectsNum,
    defectIds:        g("Defect IDs", "DefectIDs", "defectids", "defectid", "bugid", "Defect ID") || "-",
    requirements:     g("Requirements", "requirements", "req", "reqid", "story", "Requirement") || "-",
    testCaseVersion:  g("Test Case Version", "TestCaseVersion", "testcaseversion", "version", "Version") || "",
    testStepNum:      g("Test Step #", "TestStep#", "teststep#", "stepnum", "step #", "Step #") || "",
    testStepDescription: g("Test Step Description", "TestStepDescription", "stepdescription", "step description") || "",
    testStep:         g("Test Step", "TestStep", "teststep", "step") || "",
    role:             g("role", "userrole", "Role") || "-",
    stepRole:         g("steprole", "testrole", "Step Role") || "-",
    actualResult:     g("actualresult", "actual", "ActualResult", "actual result") ||
                      (status === "Passed" ? "As expected" : status === "Not Run" ? "-" : "Deviation observed"),
    stepStatus: status,
  };
}

export function rowToDefect(row: Record<string, string>, idx: number): Defect | null {
  const g = makeGetter(row);
  const key   = g("Issue key", "IssueKey", "issuekey", "key", "id", "defectid", "Key", "Issue Key");
  const title = g("Summary", "summary", "title", "description", "name", "Title");
  if (!key && !title) return null;

  return {
    key:        key || `DEF-IMP-${idx + 1}`,
    title:      title || key,
    team:       g("team", "squad", "Team", "Component") || "Imported",
    assignee:   g("Assignee", "assignee", "assignedto", "owner") || "Unassigned",
    reporter:   g("Reporter", "reporter", "reportedby") || "Unassigned",
    sprint:     g("Sprint", "sprint", "iteration", "release", "Fix Version") || "Imported",
    priority:   g("Priority", "priority", "severity") || "Major",
    status:     g("Status", "status", "state") || "To Do",
    project:    g("project", "projectname", "Project") || "Imported",
    labels:     g("Labels", "labels", "tags", "label") || "-",
    components: g("Components", "components", "component", "module", "Type") || "-",
    created:    g("Created", "created", "createdon", "create date", "Create Date") || "-",
    targetEnd:  g("Target End", "TargetEnd", "targetend", "duedate", "due date", "Due Date") || "-",
    progress:   parseInt(g("progress", "completion", "Progress")) || 0,
    estimate:   parseFloat(g("estimate", "storypoints", "effort", "Estimate")) || 1,
  };
}

export function detectType(rows: Record<string, string>[]): "testcase" | "defect" {
  if (!rows.length) return "testcase";
  const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().replace(/[\s_\-#]/g, ""));
  const defectSignals = ["issuekey", "issue key", "reporter", "issuetype", "fixversion", "aging", "targetend"];
  const tcSignals = ["tdirectory", "executedstart", "executedend", "plannedstart", "plannedend",
                     "teststep", "testcaseversion", "assignedto"];
  const dScore = defectSignals.filter((s) => headers.some((h) => h.includes(s.replace(/[\s]/g, "")))).length;
  const tScore = tcSignals.filter((s) => headers.some((h) => h.includes(s.replace(/[\s]/g, "")))).length;
  if (dScore > tScore) return "defect";
  const statusKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("status"));
  if (statusKey) {
    const hasValidStatus = rows.some((r) => VALID_STATUSES.has(r[statusKey]));
    if (hasValidStatus) return "testcase";
  }
  if (headers.some((h) => h === "name" || h === "id")) return "testcase";
  return dScore > 0 ? "defect" : "testcase";
}
