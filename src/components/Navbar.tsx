import React, { useState, useEffect } from "react";
import { Search, Bell, Sparkles, User, Sun, Moon } from "lucide-react";
import { COLORS } from "../lib/theme";

export default function Navbar({ onAskAI, dark, onToggleDark }: { onAskAI: () => void; dark: boolean; onToggleDark: () => void }) {
  const [now, setNow] = useState(() => new Date());

  // Tick every minute so the date stays current
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="sticky top-0 z-30">
      <div className="glass scanline flex items-center gap-3 px-5 py-3" style={{ borderRadius: 0, borderLeft: "none", borderTop: "none" }}>
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search test cases, defects, requirements…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-white/70 border outline-none focus:ring-2"
            style={{ borderColor: COLORS.border }}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: COLORS.greenSoft, color: COLORS.greenDark }}>
            <span className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: COLORS.green }} />
            Live · Wave 1 Release
          </div>

          <div className="hidden lg:block htcc-mono text-xs text-slate-500 px-2">{dateStr}</div>

          <button
            onClick={onToggleDark}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: dark ? "rgba(0,135,61,0.18)" : "rgba(0,0,0,0.04)", color: dark ? "#52C97A" : COLORS.slate }}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100">
            <Bell size={17} className="text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: COLORS.danger }} />
          </button>

          <button
            onClick={onAskAI}
            className="btn-primary flex items-center gap-1.5 text-white text-xs font-semibold px-3.5 py-2 rounded-xl"
          >
            <Sparkles size={14} /> Ask AI
          </button>

          <button className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center border" style={{ borderColor: COLORS.border, background: COLORS.blueSoft }}>
            <User size={16} style={{ color: COLORS.blue }} />
          </button>
        </div>
      </div>
    </div>
  );
}
