import React from "react";
import { motion } from "framer-motion";

interface Props {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
}

export default function GlassCard({ children, className = "", hover = true, style = {} }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`glass ${hover ? "glass-hover" : ""} rounded-2xl ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  );
}


