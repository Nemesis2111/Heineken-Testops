import React from "react";
import { CheckCircle2, XCircle, PauseCircle, RefreshCw, CircleDot } from "lucide-react";
import { COLORS } from "../lib/theme";
import type { TestStatus } from "../types";

const STATUS_STYLE: Record<string, { bg: string; fg: string; icon: any }> = {
  Passed: { bg: COLORS.greenSoft, fg: COLORS.greenDark, icon: CheckCircle2 },
  Failed: { bg: COLORS.dangerSoft, fg: COLORS.danger, icon: XCircle },
  Blocked: { bg: COLORS.warningSoft, fg: "#B85400", icon: PauseCircle },
  "In Progress": { bg: COLORS.blueSoft, fg: COLORS.blueDark, icon: RefreshCw },
  "Not Run": { bg: "#F1F3F7", fg: "#5B6B85", icon: CircleDot },
};

export default function StatusTag({ status }: { status: TestStatus | string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE["Not Run"];
  const Icon = s.icon;
  return (
    <span className="tag" style={{ background: s.bg, color: s.fg }}>
      <Icon size={12} /> {status}
    </span>
  );
}
