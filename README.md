# HEINEKEN TestOps Command Center

A futuristic, enterprise-grade QA/testing command center for the HEINEKEN procurement program — built with React, TypeScript, TailwindCSS, Framer Motion, Recharts, and Lucide icons. No backend required; all data is realistic mock data generated client-side.

## Getting Started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically http://localhost:5173).

To build for production:

```bash
npm run build
npm run preview
```

## What's inside

- **Sidebar** — navigation across 8 workspace pages plus the 7 project tabs (IronClad, HeiKey, SRM, Zycus iSupplier, Zycus iContract, POSM, OCP). Selecting a project scopes the data on every page.
- **Executive Dashboard** — animated KPI cards, execution trend, pass-rate trend, project health gauges, defect density, testing velocity, and a weekly heatmap.
- **Test Execution Center** — tabs for UT / SIT / UAT / Dry Run / Dress Rehearsal, progress ring, and a searchable/filterable/sortable/paginated table with column visibility toggles.
- **Defect Command Center** — Jira-style kanban (drag cards between columns), full table (empty columns auto-hide), and analytics (priority/status distribution, by sprint, by assignee, aging trend).
- **Excel Import Center** — drag-and-drop uploader with simulated progress, recent files list, and a parsed-data preview.
- **Daily Reports** — clickable calendar that drives a per-day testing/defect/health summary plus an AI summary box.
- **AI Insights** — insight cards and a working canned-response chatbot (ask about open defects, today's summary, busiest sprint, or request an executive update).
- **Email Review Center** — a generate → review → preview → send workflow with an editable, AI-drafted report and a send confirmation animation.
- **Project Health Dashboard** — radial health gauges and key stats for all 7 projects.

## Project structure

```
src/
  components/   Shared UI: Sidebar, Navbar, GlassCard, StatusTag, PriorityTag, Gauge, SectionTitle
  data/         mockData.ts — all mock data generators and constants
  lib/          theme.ts (design tokens), useCountUp.ts (KPI counter animation)
  pages/        One file per page (Executive Dashboard, Test Execution Center, etc.)
  types.ts      Shared TypeScript interfaces
  App.tsx       App shell / routing between pages
  main.tsx      Vite/React entry point
  index.css     Tailwind + design system (glassmorphism, gradients, animations)
```

## Notes

- Colors are IBM Blue (`#0F62FE`) and Heineken Green (`#00873D`) on a white/frosted-glass light theme, defined in `tailwind.config.js` and `src/lib/theme.ts`.
- All data is deterministically generated mock data (see `src/data/mockData.ts`) — swap in real API calls or file parsing whenever you're ready to connect a backend.
- This was verified with `npm install && npm run build` to compile cleanly before packaging.
