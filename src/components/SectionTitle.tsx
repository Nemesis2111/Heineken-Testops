import React from "react";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";

interface Props {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}

export default function SectionTitle({ eyebrow, title, right }: Props) {
  const dark = useDark();
  return (
    <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
      <div>
        {eyebrow && (
          <div className="htcc-mono text-[11px] font-semibold tracking-wider" style={{ color: dc(dark, DARK.faint, COLORS.blue) }}>
            {eyebrow}
          </div>
        )}
        <h2 className="htcc-display text-xl font-bold" style={{ color: dc(dark, DARK.ink, COLORS.ink) }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}
