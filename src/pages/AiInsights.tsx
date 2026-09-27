import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Brain, Send, TrendingUp, Bug, CheckCircle2, Shield, AlertTriangle, Zap } from "lucide-react";
import GlassCard from "../components/GlassCard";
import SectionTitle from "../components/SectionTitle";
import EmptyState from "../components/EmptyState";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { useActiveProject, computeKPIs } from "../lib/ProjectStore";

const TONE_ICONS = {
  green:   CheckCircle2,
  danger:  Bug,
  accent:  Zap,
  warning: AlertTriangle,
};

export default function AiInsights() {
  const dark = useDark();
  const { meta, store, id } = useActiveProject();
  const { executions, defects } = store;

  const kpis = computeKPIs(executions, defects);

  const accent      = dc(dark, DARK.blue, COLORS.blue);
  const accentDark  = dc(dark, DARK.blue, COLORS.blueDark);
  const inkColor    = dc(dark, DARK.ink, COLORS.ink);
  const slateColor  = dc(dark, DARK.slate, COLORS.slate);
  const faintColor  = dc(dark, DARK.faint, COLORS.faint);
  const borderColor = dc(dark, DARK.border, COLORS.border);
  const aiBubbleBg  = dc(dark, "rgba(5,18,10,0.70)", "#F1F3F7");
  const headerBg    = dc(dark, "linear-gradient(90deg, rgba(0,135,61,0.12), rgba(240,192,96,0.08))", "linear-gradient(90deg, rgba(15,98,254,0.06), rgba(0,135,61,0.06))");

  const TONE_COLOR: Record<string, string> = {
    green: COLORS.green,
    danger: COLORS.danger,
    accent,
    warning: COLORS.warning,
  };

  // Derive insights from real KPIs
  const insights = kpis ? [
    {
      tone: "green" as const,
      text: `Pass rate for ${meta.name} is ${kpis.passRate}% — ${kpis.passRate >= 80 ? "trending positively" : "below target, needs attention"}.`,
    },
    {
      tone: "danger" as const,
      text: `${kpis.openDefects} open defects in ${meta.name}. ${defects.filter((d) => d.priority?.includes("P1") || d.priority?.includes("P2")).length} are high priority.`,
    },
    {
      tone: "accent" as const,
      text: `${kpis.completion}% of test cases have been executed for ${meta.name}. ${kpis.notRun} remain not run.`,
    },
    {
      tone: kpis.passRate >= 80 ? "green" as const : "warning" as const,
      text: `${meta.name} testing velocity — ${kpis.passed} passed, ${kpis.failed} failed, ${kpis.blocked} blocked, ${kpis.inProgress} in progress.`,
    },
    {
      tone: kpis.health >= 85 ? "green" as const : "warning" as const,
      text: `${meta.name} health score: ${kpis.health}/100. ${kpis.health >= 85 ? "Program is on track for UAT sign-off." : "Defect burn-down focus required before UAT."}`,
    },
    {
      tone: "accent" as const,
      text: `Completion: ${kpis.completion}%, Pass Rate: ${kpis.passRate}%. ${kpis.openDefects > 0 ? `Resolve ${kpis.openDefects} open defects to improve project health.` : "No open defects — excellent status."}`,
    },
  ] : [];

  // Q&A pairs derived from real data
  const qaItems = kpis ? [
    {
      q: "How many defects are open?",
      a: () => `There are ${kpis.openDefects} open defects in ${meta.name}. ${defects.filter((d) => d.priority?.includes("P1") || d.priority?.includes("P2")).length} are high priority (P1/P2) requiring immediate attention.`,
    },
    {
      q: "Show today's execution summary.",
      a: () => `${meta.name}: ${kpis.total} cases total · ${kpis.passed} passed (${kpis.passRate}%) · ${kpis.failed} failed · ${kpis.blocked} blocked · ${kpis.inProgress} in progress.`,
    },
    {
      q: "Generate executive update.",
      a: () => `${meta.name} program health: ${kpis.health >= 85 ? "Healthy" : kpis.health >= 70 ? "Stable" : "At Risk"} (${kpis.passRate}% pass rate, ${kpis.health}/100 health). ${kpis.passed} cases passed out of ${kpis.total} executed. ${kpis.openDefects} defects remain open. ${kpis.health >= 85 ? "On track for UAT sign-off." : "Defect burn-down focus required."}`,
    },
    {
      q: "What is the project completion?",
      a: () => `${meta.name} is ${kpis.completion}% complete. ${kpis.passed} test cases passed, ${kpis.failed} failed, ${kpis.blocked} blocked, ${kpis.notRun} not yet run.`,
    },
  ] : [];

  const [messages, setMessages] = useState([
    {
      from: "ai",
      text: `Hi, I'm your TestOps copilot for **${meta.name}**. ${kpis ? `Current status: ${kpis.total} test cases, ${kpis.passRate}% pass rate, ${kpis.openDefects} open defects.` : "No data loaded yet — upload an Excel file to get started."} Ask me anything below.`,
    },
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Reset chat when project or data changes
  useEffect(() => {
    setMessages([
      {
        from: "ai",
        text: `Hi, I'm your TestOps copilot for **${meta.name}**. ${kpis ? `Current status: ${kpis.total} test cases, ${kpis.passRate}% pass rate, ${kpis.openDefects} open defects.` : "No data loaded yet — upload an Excel file to get started."} Ask me anything below.`,
      },
    ]);
  }, [id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = (q: string) => {
    setMessages((m) => [...m, { from: "user", text: q }]);
    const match = qaItems.find((qa) => qa.q === q);
    const answer = match
      ? match.a()
      : kpis
        ? `For ${meta.name}: ${kpis.total} test cases, ${kpis.passRate}% pass rate, health score ${kpis.health}/100. ${kpis.openDefects} open defects.`
        : `No data is loaded for ${meta.name}. Please import an Excel file from the Excel Import Center.`;
    setTimeout(() => setMessages((m) => [...m, { from: "ai", text: answer }]), 500);
  };

  const send = () => {
    if (!input.trim()) return;
    ask(input.trim());
    setInput("");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <SectionTitle eyebrow={`AI COPILOT · ${meta.name.toUpperCase()}`} title="AI Insights" />

      {/* Insights cards — only shown when data is available */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {insights.map((insight, i) => {
            const Icon = TONE_ICONS[insight.tone] ?? Sparkles;
            const c = TONE_COLOR[insight.tone];
            return (
              <GlassCard key={i} className="p-4 flex gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c}22` }}>
                  <Icon size={16} style={{ color: c }} />
                </div>
                <p className="text-xs leading-relaxed" style={{ color: dc(dark, DARK.body, COLORS.slate) }}>{insight.text}</p>
              </GlassCard>
            );
          })}
        </div>
      )}

      {!kpis && (
        <GlassCard className="p-5">
          <div className="text-sm" style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>
            No execution data is loaded for <strong>{meta.name}</strong>. Import an Excel or CSV file from the Excel Import Center to enable AI-generated insights.
          </div>
        </GlassCard>
      )}

      {/* Chatbot */}
      <GlassCard className="p-0 overflow-hidden">
        <div
          className="flex items-center gap-2 px-5 py-3.5"
          style={{ borderBottom: `1px solid ${borderColor}`, background: headerBg }}
        >
          <Brain size={16} style={{ color: accent }} />
          <span className="text-sm font-bold" style={{ color: inkColor }}>TestOps Copilot</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}18`, color: meta.color }}>
            {meta.name}
          </span>
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: COLORS.greenSoft, color: COLORS.greenDark }}>
            Online
          </span>
        </div>

        <div ref={listRef} className="p-5 space-y-3 htcc-scroll overflow-y-auto" style={{ maxHeight: 320 }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed"
                style={
                  m.from === "user"
                    ? {
                        background: dark
                          ? `linear-gradient(135deg, ${DARK.green}, #00873D)`
                          : `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.blueDark})`,
                        color: dark ? "#051409" : "white",
                        borderBottomRightRadius: 4,
                      }
                    : {
                        background: aiBubbleBg,
                        color: dc(dark, DARK.body, inkColor),
                        borderBottomLeftRadius: 4,
                      }
                }
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {qaItems.length > 0 && (
          <div className="px-5 pb-3 flex gap-2 flex-wrap border-t" style={{ borderColor }}>
            <div className="w-full pt-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: faintColor }}>
              Quick questions
            </div>
            {qaItems.map((qa) => (
              <button
                key={qa.q}
                onClick={() => ask(qa.q)}
                className="text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all hover:border-blue-300"
                style={{ borderColor, color: accentDark }}
              >
                {qa.q}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 p-3" style={{ borderTop: `1px solid ${borderColor}` }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Ask about ${meta.name} execution, defects, pass rate…`}
            className="flex-1 px-3.5 py-2 rounded-xl text-xs border outline-none"
            style={{
              borderColor,
              background: dc(dark, "rgba(0,135,61,0.08)", "rgba(255,255,255,0.7)"),
              color: dc(dark, DARK.body, inkColor),
            }}
          />
          <button onClick={send} className="btn-primary text-white p-2.5 rounded-xl">
            <Send size={14} />
          </button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
