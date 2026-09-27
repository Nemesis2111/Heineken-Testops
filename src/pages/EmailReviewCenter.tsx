import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle2, Paperclip, Mail } from "lucide-react";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import EmptyState from "../components/EmptyState";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { useActiveProject, computeKPIs } from "../lib/ProjectStore";

export default function EmailReviewCenter() {
  const dark = useDark();
  const { meta, store, id } = useActiveProject();
  const { executions, defects } = store;

  const kpis = computeKPIs(executions, defects);
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const steps = ["Generate Report", "Review Report", "Preview Email", "Send Email"];

  const [to, setTo] = useState("qa-leads@heineken.com");
  const [cc, setCc] = useState("procurement-pmo@heineken.com");
  const [subject, setSubject] = useState(`HEINEKEN TestOps Daily Report — ${meta.name}`);
  const [body, setBody] = useState("");

  const buildBody = () => {
    if (!kpis) {
      return `Hi team,\n\nNo project data is currently available for ${meta.name}.\n\nPlease import test execution data via the Excel Import Center to generate a detailed report.\n\nBest regards,\nTestOps Command Center`;
    }
    return (
      `Hi team,\n\nHere is today's testing summary for ${meta.name}:\n\n` +
      `• Total Executions: ${kpis.total}\n` +
      `• Passed: ${kpis.passed} (${kpis.passRate}%)\n` +
      `• Failed: ${kpis.failed}\n` +
      `• Blocked: ${kpis.blocked}\n` +
      `• In Progress: ${kpis.inProgress}\n` +
      `• Open Defects: ${kpis.openDefects}\n` +
      `• Completion: ${kpis.completion}%\n` +
      `• Project Health: ${kpis.health}/100\n\n` +
      `${kpis.openDefects > 10
        ? `Recommended focus: defect burn-down on ${meta.name} before UAT sign-off.`
        : `The program is ${kpis.health >= 85 ? "on track" : "progressing"} — continue monitoring daily.`
      }\n\n` +
      `Best regards,\nTestOps Command Center (AI-generated)`
    );
  };

  // Regenerate subject and body when project changes
  useEffect(() => {
    setSubject(`HEINEKEN TestOps Daily Report — ${meta.name} (${today})`);
    setBody(buildBody());
    setSent(false);
    setStep(0);
  }, [id, executions.length, defects.length]);

  const accent      = dc(dark, DARK.blue, COLORS.blue);
  const accentDark  = dc(dark, DARK.blue, COLORS.blueDark);
  const accentSoft  = dc(dark, "rgba(240,192,96,0.12)", COLORS.blueSoft);
  const slateColor  = dc(dark, DARK.slate, COLORS.slate);
  const faintColor  = dc(dark, DARK.faint, COLORS.faint);
  const borderColor = dc(dark, DARK.border, COLORS.border);
  const inputBg     = dc(dark, "rgba(0,135,61,0.08)", "rgba(255,255,255,0.7)");
  const inputColor  = dc(dark, DARK.body, COLORS.ink);
  const labelColor  = dc(dark, DARK.faint, COLORS.slate);
  const inactiveBg  = dc(dark, "rgba(5,18,10,0.5)", "rgba(255,255,255,.5)");
  const inkColor    = dc(dark, DARK.ink, COLORS.ink);

  const send = () => {
    setSent(true);
    setTimeout(() => setSent(false), 2600);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionTitle eyebrow={`STAKEHOLDER COMMS · ${meta.name.toUpperCase()}`} title="Email Review Center" />

      {/* Step progress */}
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => setStep(i)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold"
              style={
                i <= step
                  ? { background: accentSoft, color: accentDark }
                  : { background: inactiveBg, color: faintColor, border: `1px solid ${borderColor}` }
              }
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                style={{
                  background: i <= step ? accent : dc(dark, "rgba(0,135,61,0.2)", "#E2E8F0"),
                  color: i <= step ? (dark ? "#051409" : "white") : faintColor,
                }}
              >
                {i + 1}
              </span>
              {s}
            </button>
            {i < steps.length - 1 && <div className="w-6 h-px" style={{ background: borderColor }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Report preview KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis ? [
          { label: "Total Executions", val: kpis.total,             color: COLORS.blue },
          { label: "Pass Rate",        val: `${kpis.passRate}%`,    color: COLORS.green },
          { label: "Open Defects",     val: kpis.openDefects,       color: COLORS.danger },
          { label: "Completion",       val: `${kpis.completion}%`,  color: accentDark },
        ].map((s) => (
          <GlassCard key={s.label} className="p-3">
            <div className="htcc-display text-xl font-extrabold" style={{ color: s.color }}>{s.val}</div>
            <div className="text-[10px] font-medium" style={{ color: slateColor }}>{s.label}</div>
          </GlassCard>
        )) : (
          <div className="col-span-4 px-4 py-3 rounded-xl text-sm" style={{ color: slateColor, background: dc(dark, "rgba(0,135,61,0.08)", COLORS.surface) }}>
            No project data loaded — email will contain a placeholder message.
          </div>
        )}
      </div>

      {/* Email form */}
      <GlassCard className="p-5 space-y-4">
        {/* Project indicator */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold"
          style={{ background: `${meta.color}12`, color: meta.color, border: `1px solid ${meta.color}22` }}
        >
          📋 Generating report for: <strong>{meta.name}</strong>
          <span
            className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              background: kpis && kpis.health >= 85 ? `${COLORS.green}18` : `${COLORS.warning}18`,
              color: kpis && kpis.health >= 85 ? COLORS.green : COLORS.warning,
            }}
          >
            {kpis ? (kpis.health >= 85 ? "Healthy" : "Monitoring") : "No data"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold" style={{ color: labelColor }}>To</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm border outline-none" style={{ borderColor, background: inputBg, color: inputColor }} />
          </div>
          <div>
            <label className="text-[11px] font-semibold" style={{ color: labelColor }}>CC</label>
            <input value={cc} onChange={(e) => setCc(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm border outline-none" style={{ borderColor, background: inputBg, color: inputColor }} />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold" style={{ color: labelColor }}>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm border outline-none" style={{ borderColor, background: inputBg, color: inputColor }} />
        </div>

        <div>
          <label className="text-[11px] font-semibold" style={{ color: labelColor }}>Email Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="w-full mt-1 px-3 py-2.5 rounded-lg text-xs leading-relaxed border outline-none htcc-mono" style={{ borderColor, background: inputBg, color: inputColor }} />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: faintColor }}>
            <Paperclip size={13} /> TestOps_{meta.name.replace(/\s+/g, "_")}_Report.pdf attached
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(Math.min(3, step + 1))} className="px-4 py-2 rounded-xl text-xs font-semibold border" style={{ borderColor, color: slateColor }}>
              {step < 3 ? "Next Step" : "Preview Ready"}
            </button>
            <button onClick={send} className="btn-green text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5">
              <Send size={13} /> Send Email
            </button>
          </div>
        </div>

        <AnimatePresence>
          {sent && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: COLORS.greenSoft, color: COLORS.greenDark }}
            >
              <CheckCircle2 size={16} />
              Email sent successfully to {to} — <strong>{meta.name}</strong> daily report delivered!
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}
