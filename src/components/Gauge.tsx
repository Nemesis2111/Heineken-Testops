import React from "react";
import { DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";

interface Props {
  value: number;
  color: string;
  label: string;
  size?: number;
}

export default function Gauge({ value, color, label, size = 120 }: Props) {
  const dark = useDark();

  const trackColor = dc(dark, DARK.gaugeTrack, "#E8EEF8");
  const labelColor = dc(dark, DARK.slate, "#64748B");
  const subColor   = dc(dark, DARK.faint,  "#94A3B8");
                     
  // SVG geometry
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = size * 0.095;          // ring thickness scales with size
  const r = (size - strokeW) / 2 - 2;   // radius leaving room for stroke
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(100, Math.max(0, value));
  const dash = (progress / 100) * circumference;
  const gap  = circumference - dash;

  // font sizes relative to gauge size
  const valSize  = Math.round(size * 0.265);
  const subSize  = Math.round(size * 0.10);
  const lblSize  = Math.round(size * 0.095);

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* ring + centered text — all in one SVG */}
      <svg width={size} height={size} style={{ display: "block" }}>
        {/* track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* progress arc — start at top (rotate -90°) */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`, transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* value number */}
        <text
          x={cx} y={cy - subSize * 0.5}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="'Sora', ui-sans-serif, system-ui"
          fontWeight={800}
          fontSize={valSize}
          fill={color}
        >
          {value}
        </text>
        {/* / 100 sub-label */}
        <text
          x={cx} y={cy + valSize * 0.42}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily="'Inter', ui-sans-serif, system-ui"
          fontWeight={500}
          fontSize={subSize}
          fill={subColor}
        >
          / 1002
        </text>
      </svg>

      {/* label below the ring */}
      <span
        style={{
          fontSize: lblSize,
          fontWeight: 600,
          color: labelColor,
          textAlign: "center",
          maxWidth: size,
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </div>
  );
}
