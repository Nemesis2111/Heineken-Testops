import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Sparkles, Server } from "lucide-react";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import StatusTag from "../components/StatusTag";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import type { TestCase, Defect, TestStatus } from "../types";
import { useProjectStore, useActiveProject, PROJECT_LIST } from "../lib/ProjectStore";
import type { ProjectId, UploadedFile } from "../lib/ProjectStore";
import { STATUSES } from "../data/projectsConfig";
import { useXlsxWorker } from "../lib/useXlsxWorker";
import { parseMerlinWorkbook } from "../lib/parseMerlinWorkbook";
import type { MerlinValidationError } from "../lib/parseMerlinWorkbook";
import type { MerlinWorkbook } from "../lib/merlinTypes";
import { uploadFile, checkServerHealth, listFiles, deleteFile } from "../lib/api";
import type { ServerFileMeta } from "../lib/api";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Converts an Excel date serial (e.g. "46238.584") to "dd/mm/yyyy". Returns the value unchanged if not a serial. */
function excelDateToStr(raw: string | undefined): string {
  if (!raw) return "-";
  const num = Number(raw);
  if (!isNaN(num) && num > 1000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${d.getUTCFullYear()}`;
    }
  }
  return raw || "-";
}


function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
    return obj;
  });
}

const VALID_STATUSES = new Set<string>(["Passed", "Failed", "Blocked", "In Progress", "Not Run"]);

function toStatus(v: string): TestStatus {
  const s = STATUSES.find((s) => s.toLowerCase() === v?.toLowerCase());
  return (s ?? "Not Run") as TestStatus;
}

/**
 * Flexible column getter — strips spaces/underscores/hyphens and does
 * SUBSTRING matching so "tDirectory" matches "directory", "Assigned To"
 * matches "assignedto", "Executed Start" matches "executedstart", etc.
 */
function makeGetter(row: Record<string, string>) {
  return (...keys: string[]): string => {
    for (const k of keys) {
      const needle = k.toLowerCase().replace(/[\s_\-#]/g, "");
      // Exact normalised match first
      for (const rk of Object.keys(row)) {
        if (rk.toLowerCase().replace(/[\s_\-#]/g, "") === needle && row[rk]) return row[rk];
      }
      // Substring match (header contains the key)
      for (const rk of Object.keys(row)) {
        if (rk.toLowerCase().replace(/[\s_\-#]/g, "").includes(needle) && row[rk]) return row[rk];
      }
    }
    return "";
  };
}

function rowToTestCase(row: Record<string, string>, idx: number): TestCase | null {
  const g = makeGetter(row);

  // Real xlsx column names from the four project files:
  //   tDirectory | Id | Name | Status | Test Case Version | Assigned To
  //   Executed Start | Executed End | Planned Start Date | Planned End Date
  //   Defects | Defect IDs | Requirements | Test Step # | Test Step Description | Test Step
  const id = g("Id", "id", "testid", "tcid", "testcaseid", "test case id", "Test Case ID") || `TR-IMP-${idx + 1}`;
  const name = g("Name", "name", "testname", "testcasename", "title", "Test Case Name");
  if (!name && !id.startsWith("TR-IMP")) return null;

  const rawStatus = g("Status", "status", "result", "executionstatus", "exec status");
  const status = toStatus(rawStatus);

  const defectsRaw = g("Defects", "defects", "defectcount", "DefectCount", "bugs");
  const defectsNum = parseInt(defectsRaw) || 0;

  return {
    id,
    name:             name || id,
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
    stepStatus:       status,
  };
}

function rowToDefect(row: Record<string, string>, idx: number): Defect | null {
  const g = makeGetter(row);

  // Real defect column names:
  //   Type | Issue key | Summary | Assignee | Reporter | Priority | Status
  //   Created | Target End | Aging | Comments
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
    created:    excelDateToStr(g("Created", "created", "createdon", "create date", "Create Date")),
    targetEnd:  excelDateToStr(g("Target End", "TargetEnd", "targetend", "duedate", "due date", "Due Date")),
    progress:   parseInt(g("progress", "completion", "Progress")) || 0,
    estimate:   parseFloat(g("estimate", "storypoints", "effort", "Estimate")) || 1,
  };
}

function detectType(rows: Record<string, string>[]): "testcase" | "defect" {
  if (!rows.length) return "testcase";
  const headers = Object.keys(rows[0]).map((h) => h.toLowerCase().replace(/[\s_\-#]/g, ""));

  // Strong signals for defect sheets
  const defectSignals = ["issuekey", "issue key", "reporter", "issuetype", "fixversion", "aging", "targetend"];
  // Strong signals for test execution sheets
  const tcSignals = ["tdirectory", "executedstart", "executedend", "plannedstart", "plannedend",
                     "teststep", "testcaseversion", "assignedto"];

  const dScore = defectSignals.filter((s) => headers.some((h) => h.includes(s.replace(/[\s]/g, "")))).length;
  const tScore = tcSignals.filter((s) => headers.some((h) => h.includes(s.replace(/[\s]/g, "")))).length;

  if (dScore > tScore) return "defect";

  // If status values look like test execution statuses, treat as testcase
  const statusKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("status"));
  if (statusKey) {
    const hasValidStatus = rows.some((r) => VALID_STATUSES.has(r[statusKey]));
    if (hasValidStatus) return "testcase";
  }

  // Default: if we have a "Name" or "Id" column → testcase
  if (headers.some((h) => h === "name" || h === "id")) return "testcase";

  return dScore > 0 ? "defect" : "testcase";
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onNavigate?: (page: string) => void;
}

type ImportState = "idle" | "parsing" | "done" | "error";

interface MerlinImportStatus {
  fileName: string;
  sheetNames: string[];
  dailyStatus: { loaded: boolean; records: number };
  coaSit: { loaded: boolean; records: number };
  defects: { loaded: boolean; records: number };
}

export default function ExcelImportCenter({ onNavigate }: Props) {
  const dark = useDark();
  const { dispatch } = useProjectStore();
  const { id: activeProjectId, meta } = useActiveProject();
  const { parseMerlin, parseSingleSheet } = useXlsxWorker();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [importState, setImportState] = useState<ImportState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [lastImport, setLastImport] = useState<{ name: string; count: number; type: string; isMerlin?: boolean } | null>(null);
  const [merlinStatus, setMerlinStatus] = useState<MerlinImportStatus | null>(null);
  const [previewRows, setPreviewRows] = useState<TestCase[]>([]);
  const [targetProject, setTargetProject] = useState<ProjectId>(activeProjectId);
  const [recentFiles, setRecentFiles] = useState<{ name: string; size: string; when: string; count: string; project: string }[]>([]);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [backendSaved, setBackendSaved] = useState(false);

  // Check backend health on mount
  React.useEffect(() => {
    checkServerHealth().then(setServerOnline);
  }, []);

  const accent = dc(dark, DARK.blue, COLORS.blue);
  const accentSoft = dc(dark, "rgba(240,192,96,0.10)", COLORS.blueSoft);
  const inkColor = dc(dark, DARK.ink, COLORS.ink);
  const slateColor = dc(dark, DARK.slate, COLORS.slate);
  const faintColor = dc(dark, DARK.faint, COLORS.faint);
  const borderColor = dc(dark, DARK.border, COLORS.border);
  const gridLine = dc(dark, DARK.gridLine, "#EEF2F9");
  const cardBg = dc(dark, "rgba(5,18,10,0.55)", "rgba(255,255,255,0.55)");
  const dragBorder = dragging ? accent : borderColor;

  const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  async function processFile(file: File) {
    setImportState("parsing");
    setProgress(10);
    setError("");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();

      // ── Merlin multi-sheet workbook — triggered by project selector ────────
      // User must select "Merlin Intake V5" from the target project dropdown.
      // Filename is NOT used to detect Merlin — the project selector is the trigger.
      if ((ext === "xlsx" || ext === "xls") && targetProject === "merlin-intake-v5") {
        setProgress(20);
        // Use the direct (non-worker) parse path — more reliable across all browsers
        const result = await parseMerlinWorkbook(file);
        setProgress(70);

        // Check for validation error (type-narrowed)
        if ("type" in result) {
          const ve = result as MerlinValidationError;
          const checklist = ve.present.map((s) => `${s.found ? "✓" : "✗"} ${s.name}`).join("\n");
          throw new Error(
            `Invalid Merlin Intake V5 workbook.\n\nRequired sheets:\n${checklist}\n\nMissing: ${ve.missing.join(", ")}\nFound in file: ${ve.sheetNames.join(", ") || "none"}`
          );
        }

        // At this point result is guaranteed to be MerlinWorkbook
        const wb = result as MerlinWorkbook;
        setProgress(90);

        dispatch({ type: "SET_MERLIN_WORKBOOK", workbook: wb });

        // ── Persist to backend ───────────────────────────────────────────────
        if (serverOnline) {
          try {
            const saved = await uploadFile({
              file,
              projectId: "merlin-intake-v5",
              project: "Merlin Intake V5",
              notes: `Auto-saved from Excel Import Center — ${wb.defects.length} defects`,
            });
            setBackendSaved(true);
          } catch (uploadErr) {
            console.warn("[backend] Upload failed (non-blocking):", uploadErr);
          }
        }

        // Build per-sheet import status
        setMerlinStatus({
          fileName: wb.fileName,
          sheetNames: wb.sheetNames,
          dailyStatus: { loaded: wb.dailyStatus !== null, records: wb.dailyStatus ? 1 : 0 },
          coaSit: { loaded: wb.coaSit !== null, records: wb.coaSit ? 1 : 0 },
          defects: { loaded: wb.defects.length > 0, records: wb.defects.length },
        });

        const totalRecords = wb.defects.length + (wb.dailyStatus ? 1 : 0) + (wb.coaSit ? 1 : 0);

        setLastImport({ name: file.name, count: totalRecords, type: "Merlin sheets", isMerlin: true });
        setRecentFiles((f) => [{
          name: file.name,
          size: `${(file.size / 1024).toFixed(0)} KB`,
          when: `Today, ${now()}`,
          count: `${wb.sheetNames.length} sheets · ${wb.defects.length} defects`,
          project: "Merlin Intake V5",
        }, ...f]);
        setProgress(100);
        setImportState("done");

        // Auto-navigate to Merlin Dashboard if onNavigate is provided
        if (onNavigate) setTimeout(() => onNavigate("merlin"), 1200);
        return;
      }

      // ── General xlsx/csv — also runs in worker for xlsx ────────────────────
      let rows: Record<string, string>[];
      if (ext === "xlsx" || ext === "xls") {
        rows = await parseSingleSheet(file, (pct) => setProgress(pct));
      } else {
        setProgress(30);
        rows = parseCsv(await file.text());
      }

      setProgress(65);
      if (rows.length === 0) throw new Error("No data rows found. Make sure the file has a header row.");

      const type = detectType(rows);
      setProgress(80);

      const targetProjectName = PROJECT_LIST.find((p) => p.id === targetProject)?.name ?? "Imported";
      const fileSize = `${(file.size / 1024).toFixed(0)} KB`;

      if (type === "defect") {
        const parsed = rows.map((r, i) => rowToDefect(r, i)).filter(Boolean) as Defect[];
        if (parsed.length === 0) throw new Error("Could not map any rows to defects. Check column headers.");

        const uploadedFile: UploadedFile = {
          name: file.name,
          size: fileSize,
          uploadedAt: new Date().toISOString(),
          rowCount: parsed.length,
          dataType: "defects",
        };
        dispatch({ type: "ADD_DEFECTS", projectId: targetProject, records: parsed, file: uploadedFile });
        setLastImport({ name: file.name, count: parsed.length, type: "defects" });
        setRecentFiles((f) => [{ name: file.name, size: fileSize, when: `Today, ${now()}`, count: `${parsed.length} defects`, project: targetProjectName }, ...f]);
        setPreviewRows([]);
        // Persist to backend
        if (serverOnline) {
          uploadFile({ file, projectId: targetProject, project: targetProjectName, notes: `${parsed.length} defects` })
            .then(() => setBackendSaved(true))
            .catch((e) => console.warn("[backend] Upload failed:", e));
        }
      } else {
        const parsed = rows.map((r, i) => rowToTestCase(r, i)).filter(Boolean) as TestCase[];
        if (parsed.length === 0) throw new Error("Could not map any rows to test cases. Check column headers.");

        const uploadedFile: UploadedFile = {
          name: file.name,
          size: fileSize,
          uploadedAt: new Date().toISOString(),
          rowCount: parsed.length,
          dataType: "executions",
        };
        dispatch({ type: "ADD_EXECUTIONS", projectId: targetProject, records: parsed, file: uploadedFile });
        setPreviewRows(parsed.slice(0, 6));
        setLastImport({ name: file.name, count: parsed.length, type: "test cases" });
        setRecentFiles((f) => [{ name: file.name, size: fileSize, when: `Today, ${now()}`, count: `${parsed.length} test cases`, project: targetProjectName }, ...f]);
        // Persist to backend
        if (serverOnline) {
          uploadFile({ file, projectId: targetProject, project: targetProjectName, notes: `${parsed.length} test cases` })
            .then(() => setBackendSaved(true))
            .catch((e) => console.warn("[backend] Upload failed:", e));
        }
      }

      setProgress(100);
      setImportState("done");
    } catch (e: any) {
      setError(e?.message || "Failed to parse file.");
      setImportState("error");
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionTitle
        eyebrow={`DATA INGESTION · ${meta.name.toUpperCase()}`}
        title="Excel Import Center"
        right={
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: COLORS.greenSoft, color: COLORS.greenDark }}>
            Import to populate all sections
          </span>
        }
      />

      {/* hidden real file input */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv" className="hidden" onChange={handleFileInput} />

      {/* Drop zone */}
      <GlassCard
        hover={false}
        className="flex flex-col items-center justify-center text-center"
        style={{ border: `2px dashed ${dragBorder}`, background: cardBg, padding: dragging ? "3.5rem 2.5rem" : "2.5rem" }}
      >
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className="w-full flex flex-col items-center"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 btn-primary">
            <Upload size={26} className="text-white" />
          </div>
          <div className="htcc-display font-bold text-lg mb-1" style={{ color: inkColor }}>
            Drop your Excel / CSV file here
          </div>
          <div className="text-sm" style={{ color: faintColor }}>
            Supports .xlsx, .xls, .csv — headers auto-detected · updates all sections instantly
          </div>

          {/* Backend server status */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
            style={{
              background: serverOnline === true
                ? "rgba(0,135,61,0.08)"
                : serverOnline === false
                  ? "rgba(218,30,40,0.08)"
                  : "rgba(100,62,254,0.05)",
              color: serverOnline === true ? COLORS.greenDark : serverOnline === false ? COLORS.danger : slateColor,
              border: `1px solid ${serverOnline === true ? "rgba(0,135,61,0.2)" : serverOnline === false ? "rgba(218,30,40,0.2)" : "rgba(100,62,254,0.15)"}`,
            }}>
            <Server size={12} />
            {serverOnline === true && <span><strong>Backend connected</strong> — files will be persisted to the server and available in Daily Reports across sessions.</span>}
            {serverOnline === false && <span><strong>Backend offline</strong> — files are processed locally only. Start the server with <code className="px-1 rounded" style={{ background: "rgba(218,30,40,0.12)" }}>cd server &amp;&amp; npm run dev</code> to enable daily persistence.</span>}
            {serverOnline === null && <span>Checking backend connection…</span>}
          </div>

          {/* Merlin workbook hint */}
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
            style={{ background: "rgba(100,62,254,0.07)", color: "#6435FE", border: "1px solid rgba(100,62,254,0.18)" }}>
            <Sparkles size={12} />
            <span><strong>Merlin Intake V5?</strong> Select <strong>Merlin Intake V5</strong> from the "Import into" dropdown below, then drop or browse for the workbook. All 3 sheets (Daily Status, COA SIT, Defects) will be auto-parsed.</span>
          </div>

          {/* Target project selector */}
          <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: slateColor }}>
            <span className="text-xs font-semibold">Import into:</span>
            <select
              value={targetProject}
              onChange={(e) => setTargetProject(e.target.value as ProjectId)}
              className="px-3 py-1.5 rounded-lg border text-xs outline-none"
              style={{ borderColor, background: cardBg, color: inkColor }}
            >
              {PROJECT_LIST.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importState === "parsing"}
            className="mt-4 btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50"
          >
            Browse & Import
          </button>
        </div>

        {/* progress bar */}
        {importState === "parsing" && (
          <div className="w-full max-w-md mt-5">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: slateColor }}>
              <span>Parsing file…</span><span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: dc(dark, "rgba(0,135,61,0.15)", "#F1F5F9") }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent}, ${COLORS.green})` }} />
            </div>
          </div>
        )}

        {/* success / error banner */}
        <AnimatePresence>
          {importState === "done" && lastImport && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full max-w-xl mt-5 flex flex-col gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
              style={lastImport.isMerlin
                ? { background: "rgba(100,62,254,0.10)", color: "#4820C8" }
                : { background: COLORS.greenSoft, color: COLORS.greenDark }}>
              <div className="flex items-center gap-2.5">
                {lastImport.isMerlin ? <Sparkles size={16} /> : <CheckCircle2 size={16} />}
                {lastImport.isMerlin
                  ? <span>Merlin Intake V5 workbook parsed — <strong>Daily Status, COA SIT &amp; Defects</strong> loaded. Navigating to dashboard…</span>
                  : <span>Imported <strong>{lastImport.count} {lastImport.type}</strong> from {lastImport.name} — all sections updated</span>
                }
                <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => { setImportState("idle"); setBackendSaved(false); }}><X size={14} /></button>
              </div>
              {backendSaved && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg self-start"
                  style={{ background: "rgba(0,135,61,0.12)", color: COLORS.greenDark }}>
                  <Server size={11} />
                  Saved to server — will auto-load in Daily Reports next session
                </div>
              )}
            </motion.div>
          )}
          {importState === "error" && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full max-w-xl mt-5 flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: COLORS.dangerSoft, color: COLORS.danger }}>
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {/* Preserve newlines for multi-line validation errors */}
              <pre className="whitespace-pre-wrap font-sans text-sm flex-1">{error}</pre>
              <button className="ml-auto opacity-60 hover:opacity-100 shrink-0" onClick={() => setImportState("idle")}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Navigate to dashboard after import */}
      {importState === "done" && onNavigate && (
        <div className="flex flex-wrap gap-3">
          {lastImport?.isMerlin ? (
            <>
              <button onClick={() => onNavigate("merlin")} className="btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2">
                <Sparkles size={14} />
                View Merlin Dashboard
              </button>
              <button onClick={() => onNavigate("excel")} className="text-sm font-semibold px-5 py-2.5 rounded-xl border" style={{ borderColor, color: slateColor }}>
                Import Another File
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onNavigate("dashboard")} className="btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                View Dashboard
              </button>
              <button onClick={() => onNavigate("execution")} className="text-sm font-semibold px-5 py-2.5 rounded-xl border" style={{ borderColor, color: slateColor }}>
                View Test Executions
              </button>
            </>
          )}
        </div>
      )}

      {/* Merlin Import Status Panel — shown after a Merlin workbook is imported */}
      {merlinStatus && (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} style={{ color: "#6435FE" }} />
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#6435FE" }}>
                Merlin Intake V5
              </div>
              <div className="text-xs font-semibold" style={{ color: inkColor }}>{merlinStatus.fileName}</div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              {
                label: "Daily Status",
                loaded: merlinStatus.dailyStatus.loaded,
                detail: merlinStatus.dailyStatus.loaded
                  ? "Summary row loaded · A1, B2–B3, H1–H2, A8–H8, A13/15/17 cells mapped"
                  : "Sheet not found in workbook",
              },
              {
                label: "COA SIT",
                loaded: merlinStatus.coaSit.loaded,
                detail: merlinStatus.coaSit.loaded
                  ? "Summary row loaded · A1, B2–B3, H1–H2, A8–H8, A13/15/17 cells mapped"
                  : "Sheet not found in workbook",
              },
              {
                label: "Defects",
                loaded: merlinStatus.defects.loaded,
                detail: merlinStatus.defects.loaded
                  ? `${merlinStatus.defects.records} defect records loaded from rows 2 onward`
                  : "No defect records found",
              },
            ].map(({ label, loaded, detail }) => (
              <div key={label} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: loaded ? "rgba(0,135,61,0.07)" : "rgba(218,30,40,0.07)" }}>
                {loaded
                  ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" style={{ color: COLORS.green }} />
                  : <AlertCircle size={15} className="shrink-0 mt-0.5" style={{ color: COLORS.danger }} />
                }
                <div>
                  <div className="text-xs font-bold" style={{ color: loaded ? COLORS.greenDark : COLORS.danger }}>
                    {loaded ? `✓ ${label} loaded` : `✗ ${label} not loaded`}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: slateColor }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 flex items-center gap-2 text-[10px]" style={{ borderTop: `1px solid ${borderColor}`, color: slateColor }}>
            <span>Sheets found: {merlinStatus.sheetNames.join(", ") || "—"}</span>
          </div>
        </GlassCard>
      )}

      {/* format guide */}
      <GlassCard className="p-4">
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: faintColor }}>Expected Column Headers</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] font-semibold mb-1" style={{ color: COLORS.green }}>Test Case file (.xlsx / .csv)</div>
            <div className="htcc-mono text-[10px] leading-relaxed px-3 py-2 rounded-lg" style={{ background: dc(dark, "rgba(0,135,61,0.08)", "#F8FAF8"), color: slateColor }}>
              ID, Name, Status, Project, Phase, AssignedTo,<br />
              ExecStart, ExecEnd, DefectIDs, Requirements,<br />
              Role, ActualResult
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold mb-1" style={{ color: COLORS.danger }}>Defect file (.xlsx / .csv)</div>
            <div className="htcc-mono text-[10px] leading-relaxed px-3 py-2 rounded-lg" style={{ background: dc(dark, "rgba(218,30,40,0.06)", "#FFF8F8"), color: slateColor }}>
              Key, Title, Assignee, Reporter, Sprint,<br />
              Priority, Status, Project, Labels,<br />
              TargetEnd, Progress, Estimate
            </div>
          </div>
        </div>
        <div className="text-[10px] mt-2" style={{ color: faintColor }}>
          💡 Column names are flexible — "TestCaseID", "test_id", "Test ID" all work. Type (test case vs defect) is auto-detected from your headers.
        </div>
      </GlassCard>

      {/* ── Backend Stored Files ──────────────────────────────────────────────── */}
      {serverOnline && <BackendFileHistory borderColor={borderColor} gridLine={gridLine} inkColor={inkColor} faintColor={faintColor} slateColor={slateColor} cardBg={cardBg} dark={dark} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* recently uploaded */}
        <GlassCard className="p-5">
          <SectionTitle title="Recently Uploaded This Session" />
          {recentFiles.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileSpreadsheet size={28} style={{ color: faintColor, opacity: 0.4, marginBottom: 8 }} />
              <div className="text-xs" style={{ color: faintColor }}>No files uploaded yet. Import an Excel or CSV file above.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl row-hover">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: COLORS.greenSoft }}>
                    <FileSpreadsheet size={16} style={{ color: COLORS.green }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate" style={{ color: inkColor }}>{f.name}</div>
                    <div className="text-[10px]" style={{ color: faintColor }}>{f.size} · {f.when} · {f.count}</div>
                    <div className="text-[10px] font-semibold mt-0.5" style={{ color: COLORS.blue }}>{f.project}</div>
                  </div>
                  <CheckCircle2 size={15} style={{ color: COLORS.green }} />
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* preview table */}
        <GlassCard className="p-5">
          <SectionTitle title={previewRows.length ? "Imported Data Preview" : "Data Preview"} right={
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: accentSoft, color: dc(dark, DARK.blue, COLORS.blueDark) }}>
              {previewRows.length} preview rows
            </span>
          } />
          {previewRows.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="text-xs" style={{ color: faintColor }}>Import a test execution file to preview parsed rows here.</div>
            </div>
          ) : (
            <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor }}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ background: accentSoft }}>
                    {["ID", "Name", "Status", "Assigned To", "Project"].map((h) => (
                      <th key={h} className="text-left px-2.5 py-2 font-semibold whitespace-nowrap" style={{ color: dc(dark, DARK.blue, COLORS.blueDark) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: gridLine }}>
                      <td className="px-2.5 py-2 htcc-mono" style={{ color: dc(dark, DARK.body, "inherit") }}>{r.id}</td>
                      <td className="px-2.5 py-2 max-w-[160px] truncate" style={{ color: dc(dark, DARK.body, "inherit") }}>{r.name}</td>
                      <td className="px-2.5 py-2"><StatusTag status={r.status} /></td>
                      <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: dc(dark, DARK.body, "inherit") }}>{r.assignedTo}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: dc(dark, DARK.body, "inherit") }}>{r.project}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </motion.div>
  );
}

// ─── BackendFileHistory sub-component ────────────────────────────────────────

function BackendFileHistory({
  borderColor, gridLine, inkColor, faintColor, slateColor, cardBg, dark,
}: {
  borderColor: string;
  gridLine: string;
  inkColor: string;
  faintColor: string;
  slateColor: string;
  cardBg: string;
  dark: boolean;
}) {
  const [files, setFiles] = React.useState<ServerFileMeta[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    listFiles({}).then((f) => { setFiles(f); setLoading(false); });
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    await deleteFile(id);
    load();
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server size={15} style={{ color: COLORS.green }} />
          <span className="text-sm font-bold" style={{ color: inkColor }}>Server-Stored Files</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.greenSoft, color: COLORS.greenDark }}>
            {files.length} files
          </span>
        </div>
        <button onClick={load} className="text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all hover:opacity-80"
          style={{ background: COLORS.blueSoft, color: COLORS.blueDark }}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-xs py-4 text-center" style={{ color: faintColor }}>Loading…</div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Server size={24} style={{ color: faintColor, opacity: 0.35, marginBottom: 8 }} />
          <div className="text-xs" style={{ color: faintColor }}>No files stored on server yet for this project.</div>
        </div>
      ) : (
        <div className="overflow-x-auto htcc-scroll rounded-xl border" style={{ borderColor }}>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ background: COLORS.greenSoft }}>
                {["File", "Project", "Report Date", "Uploaded", "Type", "Size", ""].map((h) => (
                  <th key={h} className="text-left px-2.5 py-2 font-semibold whitespace-nowrap" style={{ color: COLORS.greenDark }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-t row-hover" style={{ borderColor: gridLine }}>
                  <td className="px-2.5 py-2 max-w-[200px] truncate" style={{ color: inkColor }} title={f.originalName}>{f.originalName}</td>
                  <td className="px-2.5 py-2 whitespace-nowrap font-semibold" style={{ color: COLORS.blue }}>{f.project}</td>
                  <td className="px-2.5 py-2 htcc-mono whitespace-nowrap" style={{ color: inkColor }}>{f.reportDate}</td>
                  <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: slateColor }}>
                    {new Date(f.uploadDate).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                      style={{ background: f.fileType === "merlin" ? "rgba(100,62,254,0.10)" : COLORS.blueSoft, color: f.fileType === "merlin" ? "#6435FE" : COLORS.blueDark }}>
                      {f.fileType}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 htcc-mono whitespace-nowrap" style={{ color: slateColor }}>
                    {(f.size / 1024).toFixed(0)} KB
                  </td>
                  <td className="px-2.5 py-2">
                    <button onClick={() => handleDelete(f.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(218,30,40,0.08)", color: COLORS.danger }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
