import React from "react";
import { COLORS } from "../lib/theme";

const PRIORITY_STYLE: Record<string, string> = {
  "Blocker (P1)": COLORS.danger,
  "Critical (P2)": "#B85400",
  "Major (P3)": COLORS.blue,
  "Minor (P4)": COLORS.faint,
};

export default function PriorityTag({ p }: { p: string }) {
  const c = PRIORITY_STYLE[p] || COLORS.slate;
  return (
    <span className="tag" style={{ background: "#F1F3F7", color: c, border: `1px solid ${c}33` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c }} />
      {p}
    </span>
  );
}


