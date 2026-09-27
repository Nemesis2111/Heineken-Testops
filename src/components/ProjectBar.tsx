import React from "react";
import { X } from "lucide-react";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";
import { PROJECTS } from "../data/mockData";

interface Props {
  activeProject: string;
  setActiveProject: (p: string) => void;
}

export default function ProjectBar({ activeProject, setActiveProject }: Props) {
  const dark = useDark();
  const activeColor = dc(dark, DARK.green, COLORS.blue);
  const inactiveColor = dc(dark, DARK.slate, COLORS.slate);
  const borderColor = dc(dark, DARK.border, COLORS.border);

  return (
    <div
      className="flex items-center gap-1 px-6 pt-3 pb-0 overflow-x-auto htcc-scroll"
      style={{ borderBottom: `1.5px solid ${borderColor}` }}
    >
      <Tab label="All Projects" active={activeProject === "all"} onClick={() => setActiveProject("all")}
        activeColor={activeColor} inactiveColor={inactiveColor} />

      {PROJECTS.map((p) => {
        const Icon = p.icon;
        const active = activeProject === p.id;
        const dotColor = p.health >= 85 ? COLORS.green : p.health >= 70 ? COLORS.warning : COLORS.danger;
        return (
          <button
            key={p.id}
            onClick={() => setActiveProject(active ? "all" : p.id)}
            className="shrink-0 relative flex items-center gap-1.5 px-3.5 pb-2.5 pt-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors focus:outline-none"
            style={{
              color: active ? activeColor : inactiveColor,
              borderBottom: active ? `2.5px solid ${activeColor}` : "2.5px solid transparent",
              marginBottom: -1.5,
              background: "transparent",
            }}
          >
            <Icon size={13} style={{ color: active ? activeColor : dc(dark, DARK.faint, COLORS.faint) }} />
            {p.name}
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
            {active && (
              <span
                className="ml-0.5 flex items-center opacity-50 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setActiveProject("all"); }}
              >
                <X size={10} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Tab({ label, active, onClick, activeColor, inactiveColor }: {
  label: string; active: boolean; onClick: () => void; activeColor: string; inactiveColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 relative px-3.5 pb-2.5 pt-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors focus:outline-none"
      style={{
        color: active ? activeColor : inactiveColor,
        borderBottom: active ? `2.5px solid ${activeColor}` : "2.5px solid transparent",
        marginBottom: -1.5,
        background: "transparent",
      }}
    >
      {label}
    </button>
  );
}
