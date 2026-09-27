import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { COLORS, DARK, dc } from "../lib/theme";
import { useDark } from "../lib/DarkContext";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  const dark = useDark();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center text-center py-20 px-6"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: dc(dark, "rgba(0,135,61,0.15)", "rgba(15,98,254,0.08)") }}
      >
        <Icon size={28} style={{ color: dc(dark, DARK.green, COLORS.blue), opacity: 0.7 }} />
      </div>
      <h3 className="htcc-display text-lg font-bold mb-2" style={{ color: dc(dark, DARK.ink, COLORS.ink) }}>
        {title}
      </h3>
      <p className="text-sm max-w-sm" style={{ color: dc(dark, DARK.slate, COLORS.slate) }}>
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 btn-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
