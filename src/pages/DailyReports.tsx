import React, { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Sparkles, Server, RefreshCw, Upload } from "lucide-react";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import Gauge from "../components/Gauge";
import EmptyState from "../components/EmptyState";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { useActiveProject, computeKPIs, getActiveDates, useProjectStore } from "../lib/ProjectStore";
import {
  checkServerHealth, getDailyReports, listFiles, downloadFileBuffer,
} from "../lib/api";
import type { ServerFileMeta } from "../lib/api";
import { useXlsxWorker } from "../lib/useXlsxWorker";

export default function DailyReports() {
  const dark = useDark();
  const { meta, store, id: projectId } = useActiveProject();
  const { dispatch } = useProjectStore();
  const { executions, defects } = store;
  const { parseMerlin, parseSingleSheet } = useXlsxWorker();

  const accent     = dc(dark, DARK.blue, COLORS.blue);
  const accentDark = dc(dark, DARK.blue, COLORS.blueDark);
  const accentSoft = dc(dark, "rgba(240,192,96,0.10)", COLORS.blueSoft);
  const inkColor   = dc(dark, DARK.ink, COLORS.ink);
  const slateColor = dc(dark, DARK.slate, COLORS.slate);
  const faintColor = dc(dark, DARK.faint, COLORS.faint);
  const borderColor = dc(dark, DARK.border, COLORS.border);
  const aiBg       = dc(dark, "linear-gradient(135deg, rgba(0,135,61,0.12), rgba(240,192,96,0.08))", "linear-gradient(135deg, rgba(15,98,254,0.06), rgba(0,135,61,0.06))");

  // ── Backend state ────────────────────────────────────────────────────────────
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [todayFiles, setTodayFiles] = useState<ServerFileMeta[]>([]);
  const [allServerFiles, setAllServerFiles] = useState<ServerFileMeta[]>([]);
  const [loadingFromServer, setLoadingFromServer] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [lastAutoLoad, setLastAutoLoad] = useState<string | null>(null);

  // ── Calendar ─────────────────────────────────────────────────────────────────
  const execActiveDates = useMemo(() => getActiveDates(executions), [executions]);

  // Only include server dates for the CURRENT project so other projects don't
  // pollute this project's calendar with dates that have no execution records.
  const serverActiveDates = useMemo(
    () => allServerFiles
      .filter((f) => f.projectId === projectId)
      .map((f) => f.reportDate)
      .filter(Boolean),
    [allServerFiles, projectId]
  );

  // Merged unique sorted active dates
  const activeDates = useMemo(() => {
    const merged = new Set([...execActiveDates, ...serverActiveDates]);
    return Array.from(merged).sort();
  }, [execActiveDates, serverActiveDates]);

  const today = new Date();
  const todayISO = today.toISOString().split("T")[0]; // "YYYY-MM-DD"
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthLabel = today.toLocaleString("default", { month: "long", year: "numeric" });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Auto-select: prefer today if it has data, else the latest active date
  useEffect(() => {
    if (activeDates.length === 0) return;
    if (selectedDate) return; // don't override a manual selection
    const preferred = activeDates.includes(todayISO)
      ? todayISO
      : activeDates[activeDates.length - 1];
    setSelectedDate(preferred);
  }, [activeDates, selectedDate, todayISO]);

  // ── Backend: check health & fetch today's files ───────────────────────────
  const refreshServerFiles = useCallback(async () => {
    const online = await checkServerHealth();
    setServerOnline(online);
    if (!online) return;
    const [todayList, allList] = await Promise.all([
      getDailyReports(projectId),
      listFiles({}),           // fetch ALL files across all projects for the count & calendar
    ]);
    setTodayFiles(todayList);
    setAllServerFiles(allList);
  }, [projectId]);

  useEffect(() => {
    refreshServerFiles();
  }, [refreshServerFiles]);

  // ── Shared file-load function (used by auto-load and manual Load button) ────
  const loadServerFile = useCallback(async (f: ServerFileMeta, silent = false) => {
    if (!silent) setLoadingFileId(f.id);
    setLoadingFromServer(true);
    try {
      const buf = await downloadFileBuffer(f.id);
      if (!buf) return;
      const file = new File([buf], f.originalName, { type: f.mimeType });

      if (f.fileType === "merlin") {
        const wb = await parseMerlin(file, () => {});
        dispatch({ type: "SET_MERLIN_WORKBOOK", workbook: wb });
      } else {
        const rows = await parseSingleSheet(file, () => {});
        if (rows.length === 0) return;
        const { rowToTestCase, rowToDefect, detectType } = await import("../lib/importHelpers");
        const type = f.fileType === "defects" ? "defect" : detectType(rows);
        if (type === "defect") {
          const parsed = rows.map((r, i) => rowToDefect(r, i)).filter(Boolean);
          if (parsed.length > 0) {
            dispatch({
              type: "ADD_DEFECTS",
              projectId: f.projectId as import("../lib/ProjectStore").ProjectId,
              records: parsed as import("../types").Defect[],
              file: { name: f.originalName, size: `${(f.size / 1024).toFixed(0)} KB`, uploadedAt: f.uploadDate, rowCount: parsed.length, dataType: "defects" },
            });
          }
        } else {
          const parsed = rows.map((r, i) => rowToTestCase(r, i)).filter(Boolean);
          if (parsed.length > 0) {
            dispatch({
              type: "ADD_EXECUTIONS",
              projectId: f.projectId as import("../lib/ProjectStore").ProjectId,
              records: parsed as import("../types").TestCase[],
              file: { name: f.originalName, size: `${(f.size / 1024).toFixed(0)} KB`, uploadedAt: f.uploadDate, rowCount: parsed.length, dataType: "executions" },
            });
          }
        }
      }
      setLastAutoLoad(f.id);
    } catch (e) {
      console.warn("[DailyReports] Load failed:", e);
    } finally {
      setLoadingFromServer(false);
      setLoadingFileId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, parseMerlin, parseSingleSheet]);

  // ── Auto-load latest server file if no local data ────────────────────────
  useEffect(() => {
    if (!serverOnline || executions.length > 0 || allServerFiles.length === 0) return;
    const latest =
      allServerFiles.find((f) => f.projectId === projectId) ?? allServerFiles[0];
    if (!latest || lastAutoLoad === latest.id) return;
    loadServerFile(latest, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverOnline, allServerFiles, executions.length, lastAutoLoad, projectId]);

  // ── Per-date stats ────────────────────────────────────────────────────────
  const dayStats = useMemo(() => {
    if (!selectedDate) return null;
    const dayExecs = executions.filter((t) => {
      const d = t.execStart && t.execStart !== "-" ? t.execStart.split(" ")[0] : t.planStart;
      return d === selectedDate || d?.startsWith(selectedDate);
    });
    if (dayExecs.length > 0) return computeKPIs(dayExecs, defects);
    // No executions matched the exact date.
    // If all executions share one import-date (Merlin pattern), show them all
    // regardless of which calendar date is selected — any highlighted date is valid.
    if (executions.length > 0) return computeKPIs(executions, defects);
    return null;
  }, [selectedDate, executions, defects]);

  // Server files stored for the selected date (any project) — shown in right panel
  // when there is no execution data to display
  const selectedDateServerFiles = useMemo(() => {
    if (!selectedDate) return [];
    return allServerFiles.filter((f) => f.reportDate === selectedDate);
  }, [selectedDate, allServerFiles]);

  const formatDate = (dateStr: string | null) => dateStr ?? "No date selected";

  const dayHasData = (d: number) => {
    const padded = String(d).padStart(2, "0");
    // Check current month + year matches
    const mm = String(month + 1).padStart(2, "0");
    const yyyy = String(year);
    return activeDates.some((date) => {
      // YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date === `${yyyy}-${mm}-${padded}`;
      }
      // dd/mm/yyyy format
      const parts = date.split("/");
      if (parts.length === 3) {
        return parts[0] === padded && parts[1] === mm && parts[2] === yyyy;
      }
      return false;
    });
  };

  // Get the canonical date string for a given day number in current month
  const getDateForDay = (d: number): string => {
    const padded = String(d).padStart(2, "0");
    const mm = String(month + 1).padStart(2, "0");
    const yyyy = String(year);
    // Return matching active date string (preserves original format) or ISO fallback
    return activeDates.find((date) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date === `${yyyy}-${mm}-${padded}`;
      const parts = date.split("/");
      return parts.length === 3 && parts[0] === padded && parts[1] === mm && parts[2] === yyyy;
    }) ?? `${yyyy}-${mm}-${padded}`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionTitle eyebrow={`DAILY REPORTING · ${meta.name.toUpperCase()}`} title="Daily Reports" />

      {/* ── Backend status bar ───────────────────────────────────────────────── */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: serverOnline === true ? COLORS.green : serverOnline === false ? COLORS.danger : COLORS.slate }}
              />
              <span className="text-xs font-semibold" style={{ color: serverOnline === true ? COLORS.greenDark : serverOnline === false ? COLORS.danger : slateColor }}>
                {serverOnline === true ? "Backend connected" : serverOnline === false ? "Backend offline" : "Checking…"}
              </span>
            </div>
            {serverOnline === true && (
              <>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(0,135,61,0.10)", color: COLORS.greenDark }}>
                  {todayFiles.length} file{todayFiles.length !== 1 ? "s" : ""} uploaded today
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.blueSoft, color: COLORS.blueDark }}>
                  {allServerFiles.length} total
                </span>
              </>
            )}
            {loadingFromServer && (
              <span className="text-[10px] flex items-center gap-1" style={{ color: COLORS.blue }}>
                <RefreshCw size={10} className="animate-spin" /> Loading from server…
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshServerFiles}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
              style={{ background: COLORS.blueSoft, color: COLORS.blueDark }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
            {serverOnline === false && (
              <span className="text-[10px]" style={{ color: faintColor }}>
                Run <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: dark ? "rgba(255,255,255,0.08)" : "#F1F5F9" }}>cd server &amp;&amp; npm run dev</code> to start
              </span>
            )}
          </div>
        </div>

        {/* Today's server files */}
        {serverOnline === true && todayFiles.length > 0 && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: faintColor }}>
              Files uploaded today
            </div>
            <div className="flex flex-wrap gap-2">
              {todayFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ background: COLORS.greenSoft, color: COLORS.greenDark }}
                >
                  <Server size={10} />
                  {f.originalName}
                  <span className="opacity-60 font-normal">
                    · {new Date(f.uploadDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>

      {/* ── All Server Files — load any file on demand ───────────────────────── */}
      {serverOnline === true && allServerFiles.length > 0 && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server size={14} style={{ color: COLORS.green }} />
              <span className="text-sm font-bold" style={{ color: inkColor }}>All Server Files</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: COLORS.greenSoft, color: COLORS.greenDark }}>
                {allServerFiles.length} files
              </span>
            </div>
            <span className="text-[10px]" style={{ color: faintColor }}>Click Load to restore any file into the dashboard</span>
          </div>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ background: COLORS.greenSoft }}>
                  {["File", "Project", "Report Date", "Type", "Uploaded", ""].map((h) => (
                    <th key={h} className="text-left px-2.5 py-2 font-semibold whitespace-nowrap" style={{ color: COLORS.greenDark }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allServerFiles.map((f) => (
                  <tr key={f.id} className="border-t" style={{ borderColor: dc(dark, DARK.gridLine, "#EEF2F9") }}>
                    <td className="px-2.5 py-2 max-w-[200px] truncate font-medium" style={{ color: inkColor }} title={f.originalName}>{f.originalName}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap font-semibold" style={{ color: COLORS.blue }}>{f.project}</td>
                    <td className="px-2.5 py-2 whitespace-nowrap font-mono" style={{ color: inkColor }}>{f.reportDate}</td>
                    <td className="px-2.5 py-2">
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                        style={{ background: f.fileType === "merlin" ? "rgba(100,62,254,0.10)" : COLORS.blueSoft,
                                 color: f.fileType === "merlin" ? "#6435FE" : COLORS.blueDark }}>
                        {f.fileType}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: faintColor }}>
                      {new Date(f.uploadDate).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-2.5 py-2">
                      <button
                        onClick={() => loadServerFile(f)}
                        disabled={loadingFileId === f.id || lastAutoLoad === f.id}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                        style={{ background: lastAutoLoad === f.id ? COLORS.greenSoft : COLORS.blueSoft,
                                 color: lastAutoLoad === f.id ? COLORS.greenDark : COLORS.blueDark }}
                      >
                        {loadingFileId === f.id
                          ? <><RefreshCw size={9} className="animate-spin" /> Loading…</>
                          : lastAutoLoad === f.id
                            ? <>✓ Loaded</>
                            : <><Upload size={9} /> Load</>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {executions.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={CalendarIcon}
            title="No testing activity recorded"
            description={
              serverOnline === true
                ? `No data found for ${meta.name}. Upload a file from Excel Import Center — it will be saved to the server and auto-loaded here each session.`
                : `Import a test execution file for ${meta.name} to view daily execution summaries and calendar activity.`
            }
          />
          {serverOnline === true && (
            <GlassCard className="p-4 flex items-center gap-3">
              <Upload size={16} style={{ color: COLORS.blue }} />
              <div className="text-xs" style={{ color: slateColor }}>
                <strong>Tip:</strong> Go to <strong>Excel Import Center</strong>, upload your daily file, and it will be automatically saved to the backend.
                Next time you open this page, the data loads automatically — no need to re-upload.
              </div>
            </GlassCard>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Calendar */}
          <GlassCard className="p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <span className="htcc-display font-bold text-sm" style={{ color: inkColor }}>{monthLabel}</span>
              <CalendarIcon size={16} style={{ color: faintColor }} />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] mb-1 font-semibold" style={{ color: faintColor }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const hasData = dayHasData(d);
                const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const dateStr = getDateForDay(d);
                const active = selectedDate === dateStr;
                return (
                  <button
                    key={d}
                    onClick={() => {
                      if (hasData) {
                        setSelectedDate(getDateForDay(d));
                      }
                    }}
                    className="aspect-square rounded-lg text-xs font-medium flex items-center justify-center transition-all relative"
                    style={
                      active
                        ? { background: dark ? `linear-gradient(135deg, ${DARK.green}, #00873D)` : `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.green})`, color: dark ? "#051409" : "white", fontWeight: 700 }
                        : hasData
                          ? { color: slateColor, background: dark ? "rgba(0,135,61,0.15)" : accentSoft, fontWeight: 600 }
                          : isToday
                            ? { color: inkColor, background: "transparent", fontWeight: 700, border: `1.5px solid ${accent}`, borderRadius: 8 }
                            : { color: faintColor, background: "transparent", opacity: 0.5 }
                    }
                  >
                    {d}
                    {hasData && !active && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: accent }} />}
                  </button>
                );
              })}
            </div>

            {/* Activity summary */}
            <div className="mt-4 px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: `${meta.color}14`, color: meta.color, border: `1px solid ${meta.color}22` }}>
              📋 {meta.name} · {activeDates.length} active date{activeDates.length !== 1 ? "s" : ""}
            </div>
            {/* Selected date label */}
            {selectedDate && (
              <div className="mt-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold flex items-center gap-1.5"
                style={{ background: dark ? "rgba(0,135,61,0.08)" : COLORS.blueSoft, color: dark ? COLORS.green : COLORS.blueDark }}>
                <CalendarIcon size={10} />
                Viewing: {selectedDate}
              </div>
            )}

            {/* Server hint */}
            {serverOnline === true && (
              <div className="mt-2 px-3 py-2 rounded-xl text-[10px] flex items-center gap-1.5" style={{ background: "rgba(0,135,61,0.06)", color: COLORS.greenDark }}>
                <Server size={10} />
                {allServerFiles.length} file{allServerFiles.length !== 1 ? "s" : ""} stored on server
                {" "}· {allServerFiles.filter((f) => f.projectId === projectId).length} for this project
              </div>
            )}
          </GlassCard>

          {/* Right panel */}
          <div className="lg:col-span-2 space-y-5">
            {dayStats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Executed",      val: dayStats.total,       color: accent },
                    { label: "Passed",        val: dayStats.passed,      color: COLORS.green },
                    { label: "Failed",        val: dayStats.failed,      color: COLORS.danger },
                    { label: "Open Defects",  val: dayStats.openDefects, color: COLORS.warning },
                  ].map((s) => (
                    <GlassCard key={s.label} className="p-3.5">
                      <div className="htcc-display text-xl font-extrabold" style={{ color: s.color }}>{s.val}</div>
                      <div className="text-[10px] font-medium" style={{ color: slateColor }}>{s.label}</div>
                    </GlassCard>
                  ))}
                </div>

                <GlassCard className="p-5">
                  <SectionTitle title={`Project Health · ${meta.name} · ${formatDate(selectedDate)}`} />
                  <div className="flex items-center gap-6">
                    <Gauge
                      value={dayStats.health}
                      color={dayStats.health >= 85 ? COLORS.green : dayStats.health >= 70 ? COLORS.warning : COLORS.danger}
                      label="Health Score"
                      size={110}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span style={{ color: slateColor }}>Pass Rate</span>
                        <span className="font-semibold" style={{ color: inkColor }}>{dayStats.passRate}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: slateColor }}>Completion</span>
                        <span className="font-semibold" style={{ color: inkColor }}>{dayStats.completion}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: slateColor }}>Blocked Cases</span>
                        <span className="font-semibold" style={{ color: inkColor }}>{dayStats.blocked}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: slateColor }}>In Progress</span>
                        <span className="font-semibold" style={{ color: inkColor }}>{dayStats.inProgress}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: slateColor }}>Not Run</span>
                        <span className="font-semibold" style={{ color: inkColor }}>{dayStats.notRun}</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-5" style={{ background: aiBg }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={15} style={{ color: accent }} />
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accentDark }}>
                      AI Daily Summary — {meta.name}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: dc(dark, DARK.body, COLORS.slate) }}>
                    On {formatDate(selectedDate)}, <strong>{meta.name}</strong>: {dayStats.total} cases executed with a {dayStats.passRate}% pass rate.
                    {" "}{dayStats.health < 70
                      ? "Risk is elevated — recommend a defect triage session before end of day."
                      : dayStats.health < 85
                        ? "Progress is steady; a few blockers need owner follow-up."
                        : "The program is tracking well against plan."
                    }
                    {" "}Completion: <strong>{dayStats.completion}%</strong>.
                  </p>
                </GlassCard>
              </>
            ) : (
              <GlassCard className="p-6 flex flex-col gap-4">
                {selectedDateServerFiles.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Server size={15} style={{ color: COLORS.green }} />
                      <span className="text-sm font-bold" style={{ color: inkColor }}>
                        {selectedDateServerFiles.length} file{selectedDateServerFiles.length !== 1 ? "s" : ""} stored for {selectedDate}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: slateColor }}>
                      These files are saved on the backend. Import the file for <strong>{meta.name}</strong> via Excel Import Center to see execution KPIs here.
                    </div>
                    <div className="space-y-2">
                      {selectedDateServerFiles.map((f) => (
                        <div key={f.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border text-[11px]"
                          style={{ borderColor, background: dc(dark, "rgba(0,135,61,0.06)", COLORS.greenSoft) }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <Server size={11} style={{ color: COLORS.green, flexShrink: 0 }} />
                            <span className="font-semibold truncate" style={{ color: inkColor }}>{f.originalName}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className="px-1.5 py-0.5 rounded-full font-semibold capitalize"
                              style={{ background: f.fileType === "merlin" ? "rgba(100,62,254,0.10)" : COLORS.blueSoft,
                                       color: f.fileType === "merlin" ? "#6435FE" : COLORS.blueDark, fontSize: 10 }}>
                              {f.fileType}
                            </span>
                            <span style={{ color: faintColor }}>{f.project}</span>
                            <span style={{ color: faintColor }}>
                              {new Date(f.uploadDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center py-6 text-center">
                    <CalendarIcon size={32} style={{ color: faintColor, opacity: 0.5, marginBottom: 12 }} />
                    <div className="text-sm font-semibold mb-1" style={{ color: slateColor }}>
                      {selectedDate ? "No testing activity recorded for this date." : "Select a date with activity from the calendar."}
                    </div>
                    <div className="text-xs" style={{ color: faintColor }}>
                      Dates with activity are highlighted on the calendar.
                    </div>
                  </div>
                )}
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
